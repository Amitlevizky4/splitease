import { Router, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

// POST /api/payments - Record a payment
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { toUserId, amount, currency, groupId } = req.body;

    if (!toUserId || !amount || !currency) {
      res.status(400).json({ error: "Missing required fields" });
      return;
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

    const toUser = await prisma.user.findUnique({ where: { id: toUserId } });

    await prisma.activity.create({
      data: {
        type: "payment",
        description: `Paid ${toUser?.name ?? "someone"}`,
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

// POST /api/payments/settle-all - Settle all debts (receives list of payments to create)
router.post("/settle-all", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { payments: paymentsList } = req.body;
    // paymentsList: Array<{ fromUserId, toUserId, amount, currency }>

    if (!paymentsList || paymentsList.length === 0) {
      res.json({ count: 0 });
      return;
    }

    const now = new Date();
    const createdPayments = [];

    for (const p of paymentsList) {
      const payment = await prisma.payment.create({
        data: {
          fromUserId: p.fromUserId,
          toUserId: p.toUserId,
          amount: p.amount,
          currency: p.currency,
          date: now,
        },
      });
      createdPayments.push(payment);
    }

    const userIdSet = new Set<string>();
    for (const p of paymentsList as Array<{
      fromUserId: string;
      toUserId: string;
    }>) {
      userIdSet.add(p.fromUserId);
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
          create: allUserIds.map((id: string) => ({ userId: id })),
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
