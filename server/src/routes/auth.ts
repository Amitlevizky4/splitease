import { Router, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../index.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "splitease-dev-secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post("/google", async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: "Missing Google credential" });
      return;
    }

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      res.status(401).json({ error: "Invalid Google token" });
      return;
    }

    const googleId = `google-${payload.sub}`;
    const email = payload.email || "";
    const name = payload.name || payload.email || "Unknown";
    const avatar = payload.picture || "👤";

    // Find or create user
    let user = await prisma.user.findUnique({ where: { id: googleId } });
    if (!user) {
      user = await prisma.user.create({
        data: { id: googleId, name, email, avatar },
      });

      // Auto-accept pending invitations for this email
      const pendingInvitations = await prisma.invitation.findMany({
        where: { email, status: "pending" },
      });

      for (const inv of pendingInvitations) {
        // Create bidirectional friendship
        await prisma.friendship
          .create({
            data: { userId: inv.inviterId, friendId: googleId },
          })
          .catch(() => {
            /* already exists */
          });
        await prisma.friendship
          .create({
            data: { userId: googleId, friendId: inv.inviterId },
          })
          .catch(() => {
            /* already exists */
          });

        // Add to group if invitation has a groupId
        if (inv.groupId) {
          await prisma.groupMember
            .create({
              data: {
                groupId: inv.groupId,
                userId: googleId,
                role: "expense_only",
              },
            })
            .catch(() => {
              /* already a member */
            });
        }

        // Mark invitation as accepted
        await prisma.invitation.update({
          where: { id: inv.id },
          data: { status: "accepted" },
        });
      }
    } else {
      // Update profile info on each login
      user = await prisma.user.update({
        where: { id: googleId },
        data: { name, avatar, email },
      });
    }

    // Generate session JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Verify existing token
router.get("/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export { router as authRouter };
