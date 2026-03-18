import { Router, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function isValidAmount(val: unknown): val is number {
  return typeof val === "number" && isFinite(val) && val > 0;
}

// POST /api/expenses - Create an expense
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      description,
      amount,
      currency,
      category,
      date,
      paidBy,
      splits,
      splitMethod,
      groupId,
    } = req.body;

    if (
      !description ||
      !amount ||
      !currency ||
      !category ||
      !date ||
      !paidBy ||
      !splits ||
      !splitMethod
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (!isValidAmount(amount)) {
      res.status(400).json({ error: "Amount must be a positive number" });
      return;
    }

    // Validate date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ error: "Invalid date" });
      return;
    }

    const typedSplits = splits as Array<{ userId: string; amount: number }>;

    // Validate all split amounts are positive
    for (const s of typedSplits) {
      if (!isValidAmount(s.amount)) {
        res
          .status(400)
          .json({ error: "All split amounts must be positive numbers" });
        return;
      }
    }

    // Verify the current user is involved (either payer or in splits)
    const isInvolved =
      paidBy === userId || typedSplits.some((s) => s.userId === userId);
    if (!isInvolved) {
      res
        .status(403)
        .json({
          error:
            "You must be involved in the expense (as payer or participant)",
        });
      return;
    }

    // Verify paidBy user exists
    const payer = await prisma.user.findUnique({ where: { id: paidBy } });
    if (!payer) {
      res.status(400).json({ error: "Payer user not found" });
      return;
    }

    // Verify all split users exist
    const splitUserIds = typedSplits.map((s) => s.userId);
    const splitUsers = await prisma.user.findMany({
      where: { id: { in: splitUserIds } },
    });
    if (splitUsers.length !== splitUserIds.length) {
      res.status(400).json({ error: "One or more split users not found" });
      return;
    }

    // If groupId, verify user is a member and all participants are members
    if (groupId) {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: { members: true },
      });
      if (!group) {
        res.status(400).json({ error: "Group not found" });
        return;
      }

      const memberIds = group.members.map((m) => m.userId);
      if (!memberIds.includes(userId)) {
        res.status(403).json({ error: "You are not a member of this group" });
        return;
      }

      // Verify payer and all split users are group members
      const allParticipants = [paidBy, ...splitUserIds];
      for (const pid of allParticipants) {
        if (!memberIds.includes(pid)) {
          res
            .status(400)
            .json({ error: "All participants must be group members" });
          return;
        }
      }
    }

    const expense = await prisma.expense.create({
      data: {
        description: String(description).slice(0, 200),
        amount,
        currency,
        category,
        date: parsedDate,
        paidBy,
        splitMethod,
        groupId: groupId || null,
        splits: {
          create: typedSplits.map((s) => ({
            userId: s.userId,
            amount: s.amount,
          })),
        },
      },
      include: { splits: true },
    });

    let actDescription = `Added "${String(description).slice(0, 100)}"`;
    if (groupId) {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (group) actDescription += ` in ${group.name}`;
    }

    await prisma.activity.create({
      data: {
        type: "expense",
        description: actDescription,
        amount,
        currency,
        date: parsedDate,
        groupId: groupId || null,
        userId,
        relatedUsers: {
          create: typedSplits.map((s) => ({ userId: s.userId })),
        },
      },
    });

    res.json({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category,
      date: expense.date.toISOString(),
      paidBy: expense.paidBy,
      splits: expense.splits.map((s) => ({
        userId: s.userId,
        amount: s.amount,
      })),
      splitMethod: expense.splitMethod,
      groupId: expense.groupId ?? undefined,
    });
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

// PUT /api/expenses/:id - Update an expense
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const {
      description,
      amount,
      currency,
      category,
      date,
      paidBy,
      splits,
      splitMethod,
      groupId,
    } = req.body;

    if (!isValidAmount(amount)) {
      res.status(400).json({ error: "Amount must be a positive number" });
      return;
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ error: "Invalid date" });
      return;
    }

    const typedSplits = splits as Array<{ userId: string; amount: number }>;
    for (const s of typedSplits) {
      if (!isValidAmount(s.amount)) {
        res
          .status(400)
          .json({ error: "All split amounts must be positive numbers" });
        return;
      }
    }

    // Verify the expense exists
    const existing = await prisma.expense.findUnique({
      where: { id },
      include: { splits: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }

    // Authorization: user must be the payer, in the splits, or admin of the group
    const isCurrentPayer = existing.paidBy === userId;
    const isInSplits = existing.splits.some((s) => s.userId === userId);
    let isGroupAdmin = false;
    if (existing.groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: existing.groupId, userId } },
      });
      isGroupAdmin = membership?.role === "admin";
    }

    if (!isCurrentPayer && !isInSplits && !isGroupAdmin) {
      res
        .status(403)
        .json({ error: "You do not have permission to edit this expense" });
      return;
    }

    await prisma.expenseSplit.deleteMany({ where: { expenseId: id } });

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        description: String(description).slice(0, 200),
        amount,
        currency,
        category,
        date: parsedDate,
        paidBy,
        splitMethod,
        groupId: groupId || null,
        splits: {
          create: typedSplits.map((s) => ({
            userId: s.userId,
            amount: s.amount,
          })),
        },
      },
      include: { splits: true },
    });

    await prisma.activity.create({
      data: {
        type: "expense",
        description: `Edited "${String(description).slice(0, 100)}"`,
        amount,
        currency,
        date: new Date(),
        groupId: groupId || null,
        userId,
        relatedUsers: {
          create: typedSplits.map((s) => ({ userId: s.userId })),
        },
      },
    });

    res.json({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category,
      date: expense.date.toISOString(),
      paidBy: expense.paidBy,
      splits: expense.splits.map((s) => ({
        userId: s.userId,
        amount: s.amount,
      })),
      splitMethod: expense.splitMethod,
      groupId: expense.groupId ?? undefined,
    });
  } catch (error) {
    console.error("Update expense error:", error);
    res.status(500).json({ error: "Failed to update expense" });
  }
});

// DELETE /api/expenses/:id - Delete an expense
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { splits: true },
    });
    if (!expense) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }

    // Authorization: user must be the payer, or admin of the group
    const isCurrentPayer = expense.paidBy === userId;
    let isGroupAdmin = false;
    if (expense.groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: expense.groupId, userId } },
      });
      isGroupAdmin = membership?.role === "admin";
    }

    if (!isCurrentPayer && !isGroupAdmin) {
      res
        .status(403)
        .json({ error: "You do not have permission to delete this expense" });
      return;
    }

    await prisma.expense.delete({ where: { id } });

    await prisma.activity.create({
      data: {
        type: "expense",
        description: `Deleted "${expense.description}"`,
        date: new Date(),
        groupId: expense.groupId,
        userId,
        relatedUsers: {
          create: expense.splits.map((s) => ({ userId: s.userId })),
        },
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete expense error:", error);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

export { router as expensesRouter };
