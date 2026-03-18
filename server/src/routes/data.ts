import { Router, Response } from 'express'
import { prisma } from '../index.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'

const router = Router()

// GET /api/data - Fetch all data for the current user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    // Get user's groups
    const groupMemberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: { include: { user: true } },
          },
        },
      },
    })

    const groups = groupMemberships.map(gm => ({
      id: gm.group.id,
      name: gm.group.name,
      emoji: gm.group.emoji,
      currency: gm.group.currency,
      memberIds: gm.group.members.map(m => m.userId),
      memberRoles: Object.fromEntries(gm.group.members.map(m => [m.userId, m.role])),
    }))

    const groupIds = groups.map(g => g.id)

    // Get friends
    const friendships = await prisma.friendship.findMany({
      where: { userId },
      include: { friend: true },
    })

    // Collect all relevant user IDs (self + friends + group members)
    const allUserIds = new Set<string>([userId])
    friendships.forEach(f => allUserIds.add(f.friendId))
    groupMemberships.forEach(gm => gm.group.members.forEach(m => allUserIds.add(m.userId)))

    const allUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
    })
    const users = allUsers.map(u => ({
      id: u.id,
      name: u.id === userId ? u.name : u.name,
      email: u.email,
      avatar: u.avatar,
    }))

    // Get friend IDs for filtering
    const friendIds = friendships.map(f => f.friendId)

    // Get expenses: in user's groups OR involving the user directly
    const expenses = await prisma.expense.findMany({
      where: {
        OR: [
          { groupId: { in: groupIds } },
          { splits: { some: { userId } } },
          { paidBy: userId },
        ],
      },
      include: { splits: true },
      orderBy: { date: 'desc' },
    })

    const formattedExpenses = expenses.map(e => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      category: e.category,
      date: e.date.toISOString(),
      paidBy: e.paidBy,
      splits: e.splits.map(s => ({ userId: s.userId, amount: s.amount })),
      splitMethod: e.splitMethod,
      groupId: e.groupId ?? undefined,
    }))

    // Get payments involving the user
    const payments = await prisma.payment.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
          { groupId: { in: groupIds } },
        ],
      },
      orderBy: { date: 'desc' },
    })

    const formattedPayments = payments.map(p => ({
      id: p.id,
      fromUserId: p.fromUserId,
      toUserId: p.toUserId,
      amount: p.amount,
      currency: p.currency,
      date: p.date.toISOString(),
      groupId: p.groupId ?? undefined,
    }))

    // Get activities
    const activities = await prisma.activity.findMany({
      where: {
        OR: [
          { userId },
          { relatedUsers: { some: { userId } } },
          { groupId: { in: groupIds } },
        ],
      },
      include: { relatedUsers: true },
      orderBy: { date: 'desc' },
      take: 50,
    })

    const formattedActivities = activities.map(a => ({
      id: a.id,
      type: a.type,
      description: a.description,
      amount: a.amount ?? undefined,
      currency: a.currency ?? undefined,
      date: a.date.toISOString(),
      relatedUsers: a.relatedUsers.map(ru => ru.userId),
      groupId: a.groupId ?? undefined,
    }))

    res.json({
      users,
      groups,
      expenses: formattedExpenses,
      payments: formattedPayments,
      activities: formattedActivities,
      friendIds,
    })
  } catch (error) {
    console.error('Data fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch data' })
  }
})

export { router as dataRouter }
