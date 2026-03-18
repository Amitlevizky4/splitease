import { Router, Response } from "express";
import crypto from "crypto";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { sendInvitationEmail } from "../services/email.js";

const router = Router();
router.use(authMiddleware);

// POST /api/invitations - Send an invitation email
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { email, groupId } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // They already have an account - just add as friend
      if (existingUser.id === userId) {
        res.status(400).json({ error: "You cannot invite yourself" });
        return;
      }

      // Create friendship if not exists
      await prisma.friendship
        .create({
          data: { userId, friendId: existingUser.id },
        })
        .catch(() => {
          /* exists */
        });
      await prisma.friendship
        .create({
          data: { userId: existingUser.id, friendId: userId },
        })
        .catch(() => {
          /* exists */
        });

      // Add to group if specified
      if (groupId) {
        await prisma.groupMember
          .create({
            data: { groupId, userId: existingUser.id, role: "expense_only" },
          })
          .catch(() => {
            /* already a member */
          });
      }

      res.json({
        status: "added",
        message: `${existingUser.name} already has an account and has been added as your friend.`,
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          avatar: existingUser.avatar,
        },
      });
      return;
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: { email, inviterId: userId, status: "pending" },
    });
    if (existingInvitation) {
      res
        .status(400)
        .json({ error: "You already have a pending invitation to this email" });
      return;
    }

    // Create invitation
    const token = crypto.randomBytes(32).toString("hex");
    const inviter = await prisma.user.findUnique({ where: { id: userId } });

    await prisma.invitation.create({
      data: {
        email,
        inviterId: userId,
        groupId: groupId || null,
        token,
      },
    });

    // Get group name if applicable
    let groupName: string | undefined;
    if (groupId) {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      groupName = group?.name;
    }

    // Send email
    const emailSent = await sendInvitationEmail(
      email,
      inviter?.name ?? "Someone",
      groupName,
    );

    res.json({
      status: "invited",
      message: emailSent
        ? `Invitation sent to ${email}. They'll be added when they sign up.`
        : `Invitation created for ${email}. Email sending is not configured - they can sign up directly.`,
    });
  } catch (error) {
    console.error("Invitation error:", error);
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

// GET /api/invitations - List pending invitations sent by the user
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const invitations = await prisma.invitation.findMany({
      where: { inviterId: userId },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        groupId: inv.groupId,
        status: inv.status,
        createdAt: inv.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    console.error("List invitations error:", error);
    res.status(500).json({ error: "Failed to list invitations" });
  }
});

export { router as invitationsRouter };
