import { useState } from "react";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import type { User, Expense, Payment, Balance } from "@/types";
import { categoryIcons } from "@/data/mockData";
import { Avatar } from "./ui/Avatar";

interface FriendDetailProps {
  users: User[];
  friendId: string;
  balances: Balance[];
  expenses: Expense[];
  payments: Payment[];
  currentUserId: string;
  onBack: () => void;
  onSettleUp: (userId: string, amount: number) => void;
  onEditExpense: (expense: Expense) => void;
  onRemoveExpense: (id: string) => void;
}

export function FriendDetail({
  users,
  friendId,
  balances,
  expenses,
  payments,
  currentUserId,
  onBack,
  onSettleUp,
  onEditExpense,
  onRemoveExpense,
}: FriendDetailProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const friend = users.find((u) => u.id === friendId);
  const balance = balances.find((b) => b.userId === friendId);
  const amount = balance?.amount ?? 0;

  const sharedExpenses = expenses.filter(
    (e) =>
      e.splits.some((s) => s.userId === currentUserId) &&
      e.splits.some((s) => s.userId === friendId),
  );

  const sharedPayments = payments.filter(
    (p) =>
      (p.fromUserId === currentUserId && p.toUserId === friendId) ||
      (p.fromUserId === friendId && p.toUserId === currentUserId),
  );

  if (!friend) return null;

  const handleSettleUp = () => {
    if (amount < 0) {
      onSettleUp(friendId, Math.abs(amount));
      setShowSettleConfirm(false);
    }
  };

  const handleDeleteExpense = () => {
    if (confirmDeleteId) {
      onRemoveExpense(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-teal font-medium text-sm"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <Card className="p-6 text-center">
        <Avatar src={friend.avatar} name={friend.name} size="xl" />
        <h2 className="text-xl font-bold text-charcoal mt-2">{friend.name}</h2>
        <p className="text-sm text-charcoal-light">{friend.email}</p>
        <div className="mt-4">
          {Math.abs(amount) < 0.01 ? (
            <p className="text-charcoal-light">All settled up!</p>
          ) : amount > 0 ? (
            <p className="text-lg">
              <span className="text-charcoal-light">owes you </span>
              <span className="font-bold text-teal">
                {formatCurrency(amount)}
              </span>
            </p>
          ) : (
            <p className="text-lg">
              <span className="text-charcoal-light">you owe </span>
              <span className="font-bold text-danger">
                {formatCurrency(Math.abs(amount))}
              </span>
            </p>
          )}
          <p className="text-xs text-charcoal-light mt-1">
            (balance shown in USD)
          </p>
        </div>
        {amount < -0.01 && (
          <Button
            className="mt-4"
            onClick={() => setShowSettleConfirm(true)}
          >
            Settle Up {formatCurrency(Math.abs(amount))}
          </Button>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-charcoal mb-3">Shared Expenses</h3>
        <div className="space-y-3">
          {sharedExpenses.map((expense) => {
            const paidByName =
              expense.paidBy === currentUserId
                ? "You"
                : users.find((u) => u.id === expense.paidBy)?.name;
            return (
              <div
                key={expense.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {categoryIcons[expense.category]}
                  </span>
                  <div>
                    <p className="font-medium text-sm text-charcoal">
                      {expense.description}
                    </p>
                    <p className="text-xs text-charcoal-light">
                      {paidByName} paid{" "}
                      {formatCurrency(expense.amount, expense.currency)} ·{" "}
                      {formatDate(expense.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditExpense(expense)}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    title="Edit expense"
                  >
                    <Pencil size={13} className="text-charcoal-light" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(expense.id)}
                    className="p-1 rounded hover:bg-red-50 transition-colors"
                    title="Delete expense"
                  >
                    <Trash2 size={13} className="text-danger" />
                  </button>
                </div>
              </div>
            );
          })}
          {sharedPayments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">💸</span>
                <div>
                  <p className="font-medium text-sm text-charcoal">
                    {payment.fromUserId === currentUserId
                      ? `You paid ${friend.name}`
                      : `${friend.name} paid you`}
                  </p>
                  <p className="text-xs text-charcoal-light">
                    {formatCurrency(payment.amount, payment.currency)} ·{" "}
                    {formatDate(payment.date)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {sharedExpenses.length === 0 && sharedPayments.length === 0 && (
            <p className="text-center text-charcoal-light py-4 text-sm">
              No shared expenses yet
            </p>
          )}
        </div>
      </Card>

      {/* Delete Expense Confirmation */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={() => setConfirmDeleteId(null)}
        title="Delete Expense"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Are you sure you want to delete this expense?
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDeleteExpense}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Settle Up Confirmation */}
      <Dialog
        open={showSettleConfirm}
        onOpenChange={setShowSettleConfirm}
        title="Settle Up"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Are you sure you want to settle up{" "}
            <strong>{formatCurrency(Math.abs(amount))}</strong> with{" "}
            <strong>{friend.name}</strong>?
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowSettleConfirm(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSettleUp}>
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
