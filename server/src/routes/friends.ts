import { Router, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

// POST /api/friends - Add a friend by email (if they exist)
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const friend = await prisma.user.findUnique({ where: { email } });
    if (!friend) {
      res
        .status(404)
        .json({
          error:
            "No user found with this email. Use the invite feature to send them an invitation.",
        });
      return;
    }

    if (friend.id === userId) {
      res.status(400).json({ error: "You cannot add yourself as a friend" });
      return;
    }

    const existing = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId: friend.id } },
    });
    if (existing) {
      res.status(400).json({ error: "Already friends with this user" });
      return;
    }

    await prisma.friendship.create({ data: { userId, friendId: friend.id } });
    await prisma.friendship
      .create({ data: { userId: friend.id, friendId: userId } })
      .catch(() => {
        /* exists */
      });

    res.json({
      id: friend.id,
      name: friend.name,
      email: friend.email,
      avatar: friend.avatar,
    });
  } catch (error) {
    console.error("Add friend error:", error);
    res.status(500).json({ error: "Failed to add friend" });
  }
});

// DELETE /api/friends/:friendId - Remove a friend
router.delete("/:friendId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const friendId = req.params.friendId as string;

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Remove friend error:", error);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

export { router as friendsRouter };
