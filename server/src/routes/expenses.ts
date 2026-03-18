import { Router, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

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
      !splits
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (!membership) {
        res.status(403).json({ error: "You are not a member of this group" });
        return;
      }
    }

    const expense = await prisma.expense.create({
      data: {
        description,
        amount,
        currency,
        category,
        date: new Date(date),
        paidBy,
        splitMethod,
        groupId: groupId || null,
        splits: {
          create: (splits as Array<{ userId: string; amount: number }>).map(
            (s) => ({
              userId: s.userId,
              amount: s.amount,
            }),
          ),
        },
      },
      include: { splits: true },
    });

    let actDescription = `Added "${description}"`;
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
        date: new Date(date),
        groupId: groupId || null,
        userId,
        relatedUsers: {
          create: (splits as Array<{ userId: string }>).map((s) => ({
            userId: s.userId,
          })),
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

    await prisma.expenseSplit.deleteMany({ where: { expenseId: id } });

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        description,
        amount,
        currency,
        category,
        date: new Date(date),
        paidBy,
        splitMethod,
        groupId: groupId || null,
        splits: {
          create: (splits as Array<{ userId: string; amount: number }>).map(
            (s) => ({
              userId: s.userId,
              amount: s.amount,
            }),
          ),
        },
      },
      include: { splits: true },
    });

    await prisma.activity.create({
      data: {
        type: "expense",
        description: `Edited "${description}"`,
        amount,
        currency,
        date: new Date(),
        groupId: groupId || null,
        userId,
        relatedUsers: {
          create: (splits as Array<{ userId: string }>).map((s) => ({
            userId: s.userId,
          })),
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
