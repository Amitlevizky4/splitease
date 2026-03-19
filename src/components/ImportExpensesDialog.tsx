import { useState, useRef } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Avatar } from "./ui/Avatar";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { importSplitwiseExpenses } from "@/lib/api";
import type { User, Group } from "@/types";

interface ImportExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
  users: User[];
  currentUserId: string;
  onImportComplete: () => void;
}

type Step = "upload" | "mapping" | "preview" | "done";

interface ParsedExpense {
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  payerName: string;
  shares: Record<string, number>;
}

interface NameMapping {
  csvName: string;
  userId: string | null;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (line.trim() === "") continue;

    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          fields.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }

  return rows;
}

function parseSplitwiseCSV(text: string): {
  csvNames: string[];
  expenses: ParsedExpense[];
} {
  const rows = parseCSV(text);
  if (rows.length < 2) return { csvNames: [], expenses: [] };

  const header = rows[0];
  // Person names start from column index 5 (after Date, Description, Category, Cost, Currency)
  const csvNames = header.slice(5).filter((name) => name.trim() !== "");

  const expenses: ParsedExpense[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 6) continue;

    const description = row[1];
    if (!description || description.toLowerCase().includes("total balance"))
      continue;

    const cost = parseFloat(row[3]);
    if (isNaN(cost) || cost <= 0) continue;

    const currency = row[4];
    const date = row[0];

    const shares: Record<string, number> = {};
    let payerName = "";
    let mostNegative = 0;

    for (let j = 0; j < csvNames.length; j++) {
      const value = parseFloat(row[5 + j]);
      if (isNaN(value)) continue;

      if (value < mostNegative) {
        mostNegative = value;
        payerName = csvNames[j];
      }
      shares[csvNames[j]] = value;
    }

    if (!payerName) continue;

    expenses.push({
      description,
      amount: cost,
      currency,
      category: "other",
      date,
      payerName,
      shares,
    });
  }

  return { csvNames, expenses };
}

function autoMatchUser(
  csvName: string,
  users: User[],
): string | null {
  const lower = csvName.toLowerCase();
  for (const user of users) {
    const userName = user.name.toLowerCase();
    if (userName.includes(lower) || lower.includes(userName)) {
      return user.id;
    }
    // Also check first name
    const firstName = userName.split(" ")[0];
    const csvFirst = lower.split(" ")[0];
    if (firstName === csvFirst && firstName.length > 2) {
      return user.id;
    }
  }
  return null;
}

export function ImportExpensesDialog({
  open,
  onOpenChange,
  group,
  users,
  currentUserId,
  onImportComplete,
}: ImportExpensesDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [csvNames, setCsvNames] = useState<string[]>([]);
  const [parsedExpenses, setParsedExpenses] = useState<ParsedExpense[]>([]);
  const [nameMappings, setNameMappings] = useState<NameMapping[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groupMembers = group.memberIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => u !== undefined);

  const resetState = () => {
    setStep("upload");
    setCsvNames([]);
    setParsedExpenses([]);
    setNameMappings([]);
    setIsImporting(false);
    setImportedCount(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { csvNames: names, expenses } = parseSplitwiseCSV(text);

      if (names.length === 0 || expenses.length === 0) {
        setError(
          "Could not parse any expenses from the CSV. Make sure it is a valid Splitwise export.",
        );
        return;
      }

      setCsvNames(names);
      setParsedExpenses(expenses);

      const mappings: NameMapping[] = names.map((name) => ({
        csvName: name,
        userId: autoMatchUser(name, groupMembers),
      }));
      setNameMappings(mappings);
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (csvName: string, userId: string) => {
    setNameMappings((prev) =>
      prev.map((m) =>
        m.csvName === csvName ? { ...m, userId: userId || null } : m,
      ),
    );
  };

  const allMapped = nameMappings.every((m) => m.userId !== null);

  const buildImportExpenses = () => {
    const mappingMap = new Map(
      nameMappings.map((m) => [m.csvName, m.userId!]),
    );

    return parsedExpenses.map((exp) => {
      const payerUserId = mappingMap.get(exp.payerName)!;

      const splits: Array<{ userId: string; amount: number }> = [];

      for (const [csvName, value] of Object.entries(exp.shares)) {
        const userId = mappingMap.get(csvName);
        if (!userId) continue;

        let shareAmount: number;
        if (csvName === exp.payerName) {
          // Payer's share = cost + their negative value (e.g., 17 + (-8.50) = 8.50)
          shareAmount = exp.amount + value;
        } else {
          // Other people's share is their positive value
          shareAmount = value;
        }

        if (Math.abs(shareAmount) < 0.01) continue;
        if (shareAmount < 0) continue;

        splits.push({ userId, amount: Math.round(shareAmount * 100) / 100 });
      }

      return {
        description: exp.description,
        amount: exp.amount,
        currency: exp.currency,
        category: exp.category,
        date: exp.date,
        paidBy: payerUserId,
        splits,
        splitMethod: "exact" as const,
      };
    });
  };

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);

    try {
      const expenses = buildImportExpenses();
      const result = await importSplitwiseExpenses({
        groupId: group.id,
        expenses,
      });

      setImportedCount(result.count);
      setStep("done");
      onImportComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import expenses",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const previewExpenses = step === "preview" ? buildImportExpenses() : [];

  const getUserName = (userId: string) => {
    if (userId === currentUserId) return "You";
    return users.find((u) => u.id === userId)?.name ?? "Unknown";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title="Import from Splitwise"
    >
      <div className="space-y-4">
        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-charcoal-light">
              <FileSpreadsheet size={16} />
              <span>Upload a CSV file exported from Splitwise</span>
            </div>

            <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal hover:bg-gray-50 transition-colors">
              <Upload size={32} className="text-charcoal-light" />
              <span className="text-sm text-charcoal-light">
                Click to select a CSV file
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {error && (
              <div className="flex items-center gap-2 text-sm text-danger">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Name Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-charcoal-light">
              Match CSV names to group members. Found{" "}
              <strong>{parsedExpenses.length}</strong> expenses with{" "}
              <strong>{csvNames.length}</strong> people.
            </p>

            <div className="space-y-3">
              {nameMappings.map((mapping) => (
                <div
                  key={mapping.csvName}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-charcoal min-w-[120px]">
                    {mapping.csvName}
                  </span>
                  <span className="text-charcoal-light text-sm">→</span>
                  <select
                    value={mapping.userId ?? ""}
                    onChange={(e) =>
                      handleMappingChange(mapping.csvName, e.target.value)
                    }
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/50"
                  >
                    <option value="">Select a member...</option>
                    {groupMembers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.id === currentUserId ? "You" : user.name}
                      </option>
                    ))}
                  </select>
                  {mapping.userId && (
                    <Check size={16} className="text-teal flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={resetState}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!allMapped}
                onClick={() => setStep("preview")}
              >
                Preview
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-charcoal-light">
              Review <strong>{previewExpenses.length}</strong> expenses to
              import into <strong>{group.name}</strong>
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {previewExpenses.map((exp, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">
                        {exp.description}
                      </p>
                      <p className="text-xs text-charcoal-light">
                        {getUserName(exp.paidBy)} paid {exp.amount.toFixed(2)}{" "}
                        {exp.currency} · {exp.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-teal">
                        {exp.amount.toFixed(2)} {exp.currency}
                      </p>
                      <p className="text-xs text-charcoal-light">
                        {exp.splits.length} split
                        {exp.splits.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {exp.splits.map((s) => {
                      const user = users.find((u) => u.id === s.userId);
                      return (
                        <span
                          key={s.userId}
                          className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-0.5"
                        >
                          <Avatar
                            src={user?.avatar}
                            name={user?.name ?? "?"}
                            size="sm"
                          />
                          {getUserName(s.userId)}: {s.amount.toFixed(2)}
                        </span>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-danger">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setStep("mapping")}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting
                  ? "Importing..."
                  : `Import ${previewExpenses.length} Expenses`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 bg-teal/10 rounded-full flex items-center justify-center mx-auto">
              <Check size={24} className="text-teal" />
            </div>
            <div>
              <p className="text-lg font-semibold text-charcoal">
                Import Complete
              </p>
              <p className="text-sm text-charcoal-light mt-1">
                Successfully imported{" "}
                <strong>{importedCount}</strong> expenses into{" "}
                <strong>{group.name}</strong>
              </p>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
