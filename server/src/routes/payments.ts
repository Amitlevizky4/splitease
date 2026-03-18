import { Router, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function isValidAmount(val: unknown): val is number {
  return typeof val === "number" && isFinite(val) && val > 0;
}

// POST /api/payments - Record a payment
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { toUserId, amount, currency, groupId } = req.body;

    if (!toUserId || !amount || !currency) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (!isValidAmount(amount)) {
      res.status(400).json({ error: "Amount must be a positive number" });
      return;
    }

    if (toUserId === userId) {
      res.status(400).json({ error: "Cannot pay yourself" });
      return;
    }

    // Verify recipient exists
    const toUser = await prisma.user.findUnique({ where: { id: toUserId } });
    if (!toUser) {
      res.status(400).json({ error: "Recipient user not found" });
      return;
    }

    // If groupId, verify both users are members
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
      if (!memberIds.includes(userId) || !memberIds.includes(toUserId)) {
        res.status(403).json({ error: "Both users must be group members" });
        return;
      }
    }

    const payment = await prisma.payment.create({
      data: {
        fromUserId: userId,
        toUserId,
        amount,
        currency,
        date: new Date(),
        groupId: groupId || null,
      },
    });

    await prisma.activity.create({
      data: {
        type: "payment",
        description: `Paid ${toUser.name}`,
        amount,
        currency,
        date: new Date(),
        userId,
        relatedUsers: {
          create: [{ userId }, { userId: toUserId }],
        },
      },
    });

    res.json({
      id: payment.id,
      fromUserId: payment.fromUserId,
      toUserId: payment.toUserId,
      amount: payment.amount,
      currency: payment.currency,
      date: payment.date.toISOString(),
      groupId: payment.groupId ?? undefined,
    });
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// POST /api/payments/settle-all - Settle all debts
router.post("/settle-all", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { payments: paymentsList } = req.body;

    if (!paymentsList || paymentsList.length === 0) {
      res.json({ count: 0 });
      return;
    }

    const now = new Date();
    const createdPayments = [];

    for (const p of paymentsList as Array<{
      fromUserId: string;
      toUserId: string;
      amount: number;
      currency: string;
    }>) {
      // CRITICAL: Only allow payments where the current user is the sender
      if (p.fromUserId !== userId) {
        res
          .status(403)
          .json({
            error: "You can only settle payments from your own account",
          });
        return;
      }

      if (!isValidAmount(p.amount)) {
        res.status(400).json({ error: "All amounts must be positive numbers" });
        return;
      }

      if (p.toUserId === userId) {
        res.status(400).json({ error: "Cannot pay yourself" });
        return;
      }

      // Verify recipient exists
      const recipient = await prisma.user.findUnique({
        where: { id: p.toUserId },
      });
      if (!recipient) {
        res.status(400).json({ error: `Recipient ${p.toUserId} not found` });
        return;
      }

      const payment = await prisma.payment.create({
        data: {
          fromUserId: userId,
          toUserId: p.toUserId,
          amount: p.amount,
          currency: p.currency,
          date: now,
        },
      });
      createdPayments.push(payment);
    }

    const userIdSet = new Set<string>();
    userIdSet.add(userId);
    for (const p of createdPayments) {
      userIdSet.add(p.toUserId);
    }
    const allUserIds = Array.from(userIdSet);

    await prisma.activity.create({
      data: {
        type: "settle_all",
        description: `All balances settled (${createdPayments.length} payments recorded)`,
        date: now,
        userId,
        relatedUsers: {
          create: allUserIds.map((id) => ({ userId: id })),
        },
      },
    });

    res.json({ count: createdPayments.length });
  } catch (error) {
    console.error("Settle all error:", error);
    res.status(500).json({ error: "Failed to settle all" });
  }
});

export { router as paymentsRouter };
