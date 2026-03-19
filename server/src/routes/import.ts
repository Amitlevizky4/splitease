import { Router, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

interface ImportExpenseInput {
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  paidBy: string;
  splits: Array<{ userId: string; amount: number }>;
  splitMethod: string;
}

// POST /api/import/splitwise - Bulk import expenses from Splitwise CSV
router.post("/splitwise", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { groupId, expenses } = req.body as {
      groupId: string;
      expenses: ImportExpenseInput[];
    };

    if (!groupId || !Array.isArray(expenses) || expenses.length === 0) {
      res.status(400).json({ error: "groupId and non-empty expenses array are required" });
      return;
    }

    // Verify user is admin of the group
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const membership = group.members.find((m) => m.userId === userId);
    if (!membership || membership.role !== "admin") {
      res.status(403).json({ error: "Only group admins can import expenses" });
      return;
    }

    const memberIds = group.members.map((m) => m.userId);

    let createdCount = 0;

    for (const exp of expenses) {
      const parsedDate = new Date(exp.date);
      if (isNaN(parsedDate.getTime())) continue;
      if (typeof exp.amount !== "number" || exp.amount <= 0) continue;

      // Verify all participants are group members
      const allParticipants = [exp.paidBy, ...exp.splits.map((s) => s.userId)];
      const allInGroup = allParticipants.every((pid) => memberIds.includes(pid));
      if (!allInGroup) continue;

      // Filter out splits with zero amount
      const validSplits = exp.splits.filter((s) => s.amount > 0);
      if (validSplits.length === 0) continue;

      await prisma.expense.create({
        data: {
          description: String(exp.description).slice(0, 200),
          amount: exp.amount,
          currency: exp.currency,
          category: exp.category,
          date: parsedDate,
          paidBy: exp.paidBy,
          splitMethod: exp.splitMethod,
          groupId,
          splits: {
            create: validSplits.map((s) => ({
              userId: s.userId,
              amount: s.amount,
            })),
          },
        },
      });

      await prisma.activity.create({
        data: {
          type: "expense",
          description: `Imported "${String(exp.description).slice(0, 100)}" in ${group.name}`,
          amount: exp.amount,
          currency: exp.currency,
          date: parsedDate,
          groupId,
          userId,
          relatedUsers: {
            create: validSplits.map((s) => ({ userId: s.userId })),
          },
        },
      });

      createdCount++;
    }

    res.json({ count: createdCount });
  } catch (error) {
    console.error("Import expenses error:", error);
    res.status(500).json({ error: "Failed to import expenses" });
  }
});

export { router as importRouter };
