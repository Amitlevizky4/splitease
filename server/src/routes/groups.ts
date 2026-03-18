import { Router, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

// POST /api/groups - Create a group
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, emoji, currency, members } = req.body;

    if (!name || !emoji || !currency) {
      res.status(400).json({ error: "Name, emoji, and currency are required" });
      return;
    }

    const group = await prisma.group.create({
      data: {
        name,
        emoji,
        currency,
        members: {
          create: (members || []).map(
            (m: { userId: string; role: string }) => ({
              userId: m.userId,
              role: m.role || "expense_only",
            }),
          ),
        },
      },
      include: { members: true },
    });

    await prisma.activity.create({
      data: {
        type: "group_created",
        description: `Created "${name}"`,
        date: new Date(),
        groupId: group.id,
        userId,
        relatedUsers: {
          create: (members || []).map((m: { userId: string }) => ({
            userId: m.userId,
          })),
        },
      },
    });

    res.json({
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      currency: group.currency,
      memberIds: group.members.map((m) => m.userId),
      memberRoles: Object.fromEntries(
        group.members.map((m) => [m.userId, m.role]),
      ),
    });
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({ error: "Failed to create group" });
  }
});

// PUT /api/groups/:id - Update a group
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const { name, emoji, currency, members } = req.body;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    });
    if (!membership || membership.role !== "admin") {
      res.status(403).json({ error: "Only admins can edit groups" });
      return;
    }

    await prisma.group.update({
      where: { id },
      data: { name, emoji, currency },
    });

    if (members) {
      await prisma.groupMember.deleteMany({ where: { groupId: id } });
      for (const m of members as Array<{ userId: string; role: string }>) {
        await prisma.groupMember.create({
          data: {
            groupId: id,
            userId: m.userId,
            role: m.role || "expense_only",
          },
        });
      }
    }

    const updatedGroup = await prisma.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!updatedGroup) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    res.json({
      id: updatedGroup.id,
      name: updatedGroup.name,
      emoji: updatedGroup.emoji,
      currency: updatedGroup.currency,
      memberIds: updatedGroup.members.map((m) => m.userId),
      memberRoles: Object.fromEntries(
        updatedGroup.members.map((m) => [m.userId, m.role]),
      ),
    });
  } catch (error) {
    console.error("Update group error:", error);
    res.status(500).json({ error: "Failed to update group" });
  }
});

// DELETE /api/groups/:id - Delete a group
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    });
    if (!membership || membership.role !== "admin") {
      res.status(403).json({ error: "Only admins can delete groups" });
      return;
    }

    const group = await prisma.group.findUnique({ where: { id } });

    await prisma.expense.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    await prisma.payment.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    // Delete related activities' relatedUsers first
    const groupActivities = await prisma.activity.findMany({
      where: { groupId: id },
    });
    for (const act of groupActivities) {
      await prisma.activityRelatedUser.deleteMany({
        where: { activityId: act.id },
      });
    }
    await prisma.activity.deleteMany({ where: { groupId: id } });

    await prisma.group.delete({ where: { id } });

    if (group) {
      await prisma.activity.create({
        data: {
          type: "group_created",
          description: `Deleted group "${group.name}"`,
          date: new Date(),
          userId,
          relatedUsers: { create: [{ userId }] },
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete group error:", error);
    res.status(500).json({ error: "Failed to delete group" });
  }
});

export { router as groupsRouter };
