import { useState, useCallback, useMemo, useEffect } from "react";
import type {
  User,
  Expense,
  Group,
  Payment,
  ActivityItem,
  Balance,
  Currency,
} from "../types";
import { convertToUSD, convertCurrency, formatCurrency } from "../lib/utils";
import * as api from "../lib/api";

export function useStore(authUserId: string) {
  const CURRENT_USER_ID = authUserId;
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Refresh all data from server
  const refreshData = useCallback(async () => {
    try {
      const data = await api.fetchData();
      setUsers(data.users.map((u) => ({ ...u })));
      setGroups(
        data.groups.map((g) => ({
          ...g,
          currency: g.currency as Currency,
          memberRoles: g.memberRoles as Record<
            string,
            "admin" | "expense_only"
          >,
        })),
      );
      setExpenses(
        data.expenses.map((e) => ({
          ...e,
          date: new Date(e.date),
          currency: e.currency as Currency,
          category: e.category as Expense["category"],
          splitMethod: e.splitMethod as Expense["splitMethod"],
        })),
      );
      setPayments(
        data.payments.map((p) => ({
          ...p,
          date: new Date(p.date),
          currency: p.currency as Currency,
        })),
      );
      setActivities(
        data.activities.map((a) => ({
          ...a,
          date: new Date(a.date),
          type: a.type as ActivityItem["type"],
          currency: a.currency as Currency | undefined,
        })),
      );
      setFriendIds(data.friendIds);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const getUserName = useCallback(
    (id: string) => {
      return users.find((u) => u.id === id)?.name ?? "Unknown";
    },
    [users],
  );

  // Calculate net balances in USD between current user and all others
  const balances = useMemo((): Balance[] => {
    const balanceMap = new Map<string, number>();

    users
      .filter((u) => u.id !== CURRENT_USER_ID)
      .forEach((u) => {
        balanceMap.set(u.id, 0);
      });

    for (const expense of expenses) {
      if (expense.paidBy === CURRENT_USER_ID) {
        for (const split of expense.splits) {
          if (split.userId !== CURRENT_USER_ID) {
            const amountUSD = convertToUSD(split.amount, expense.currency);
            balanceMap.set(
              split.userId,
              (balanceMap.get(split.userId) ?? 0) + amountUSD,
            );
          }
        }
      } else {
        const mySplit = expense.splits.find(
          (s) => s.userId === CURRENT_USER_ID,
        );
        if (mySplit) {
          const amountUSD = convertToUSD(mySplit.amount, expense.currency);
          balanceMap.set(
            expense.paidBy,
            (balanceMap.get(expense.paidBy) ?? 0) - amountUSD,
          );
        }
      }
    }

    for (const payment of payments) {
      const amountUSD = convertToUSD(payment.amount, payment.currency);
      if (payment.fromUserId === CURRENT_USER_ID) {
        balanceMap.set(
          payment.toUserId,
          (balanceMap.get(payment.toUserId) ?? 0) + amountUSD,
        );
      } else if (payment.toUserId === CURRENT_USER_ID) {
        balanceMap.set(
          payment.fromUserId,
          (balanceMap.get(payment.fromUserId) ?? 0) - amountUSD,
        );
      }
    }

    return Array.from(balanceMap.entries()).map(([userId, amount]) => ({
      userId,
      amount: Math.round(amount * 100) / 100,
    }));
  }, [CURRENT_USER_ID, expenses, payments, users]);

  // Simplified debts using greedy algorithm (all in USD)
  const simplifiedDebts = useMemo(() => {
    const netBalances = new Map<string, number>();
    const allUserIds = users.map((u) => u.id);
    allUserIds.forEach((id) => netBalances.set(id, 0));

    for (const expense of expenses) {
      for (const split of expense.splits) {
        if (split.userId !== expense.paidBy) {
          const amountUSD = convertToUSD(split.amount, expense.currency);
          netBalances.set(
            split.userId,
            (netBalances.get(split.userId) ?? 0) - amountUSD,
          );
          netBalances.set(
            expense.paidBy,
            (netBalances.get(expense.paidBy) ?? 0) + amountUSD,
          );
        }
      }
    }

    for (const payment of payments) {
      const amountUSD = convertToUSD(payment.amount, payment.currency);
      netBalances.set(
        payment.fromUserId,
        (netBalances.get(payment.fromUserId) ?? 0) + amountUSD,
      );
      netBalances.set(
        payment.toUserId,
        (netBalances.get(payment.toUserId) ?? 0) - amountUSD,
      );
    }

    const creditors: { id: string; amount: number }[] = [];
    const debtors: { id: string; amount: number }[] = [];

    netBalances.forEach((amount, id) => {
      if (amount > 0.01) creditors.push({ id, amount });
      else if (amount < -0.01) debtors.push({ id, amount: -amount });
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const debts: { from: string; to: string; amount: number }[] = [];
    let i = 0,
      j = 0;

    while (i < debtors.length && j < creditors.length) {
      const transferAmount = Math.min(debtors[i].amount, creditors[j].amount);
      if (transferAmount > 0.01) {
        debts.push({
          from: debtors[i].id,
          to: creditors[j].id,
          amount: Math.round(transferAmount * 100) / 100,
        });
      }
      debtors[i].amount -= transferAmount;
      creditors[j].amount -= transferAmount;
      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }

    return debts;
  }, [expenses, payments, users]);

  const totalBalance = useMemo(() => {
    return balances.reduce((sum, b) => sum + b.amount, 0);
  }, [balances]);

  const totalOwed = useMemo(() => {
    return balances
      .filter((b) => b.amount > 0)
      .reduce((sum, b) => sum + b.amount, 0);
  }, [balances]);

  const totalOwe = useMemo(() => {
    return balances
      .filter((b) => b.amount < 0)
      .reduce((sum, b) => sum + Math.abs(b.amount), 0);
  }, [balances]);

  // Friend CRUD — now backed by API
  const addFriend = useCallback(
    async (email: string) => {
      const friend = await api.addFriendByEmail(email);
      await refreshData();
      return friend.id;
    },
    [refreshData],
  );

  const removeFriend = useCallback(
    async (id: string) => {
      await api.removeFriend(id);
      await refreshData();
    },
    [refreshData],
  );

  const inviteFriend = useCallback(
    async (email: string, groupId?: string) => {
      const result = await api.sendInvitation({ email, groupId });
      if (result.status === "added") {
        await refreshData();
      }
      return result;
    },
    [refreshData],
  );

  const addExpense = useCallback(
    async (expense: Omit<Expense, "id">) => {
      await api.createExpense({
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        date: expense.date.toISOString(),
        paidBy: expense.paidBy,
        splits: expense.splits,
        splitMethod: expense.splitMethod,
        groupId: expense.groupId,
      });
      await refreshData();
    },
    [refreshData],
  );

  const editExpense = useCallback(
    async (id: string, expense: Omit<Expense, "id">) => {
      await api.updateExpense(id, {
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        date: expense.date.toISOString(),
        paidBy: expense.paidBy,
        splits: expense.splits,
        splitMethod: expense.splitMethod,
        groupId: expense.groupId,
      });
      await refreshData();
    },
    [refreshData],
  );

  const removeExpense = useCallback(
    async (id: string) => {
      await api.deleteExpense(id);
      await refreshData();
    },
    [refreshData],
  );

  const addGroup = useCallback(
    async (group: Omit<Group, "id">) => {
      await api.createGroup({
        name: group.name,
        emoji: group.emoji,
        currency: group.currency,
        members: group.memberIds.map((userId) => ({
          userId,
          role: group.memberRoles[userId] || "expense_only",
        })),
      });
      await refreshData();
      return "";
    },
    [refreshData],
  );

  const editGroup = useCallback(
    async (id: string, updates: Partial<Omit<Group, "id">>) => {
      const existing = groups.find((g) => g.id === id);
      if (!existing) return;

      const memberIds = updates.memberIds ?? existing.memberIds;
      const memberRoles = updates.memberRoles ?? existing.memberRoles;

      await api.updateGroup(id, {
        name: updates.name ?? existing.name,
        emoji: updates.emoji ?? existing.emoji,
        currency: updates.currency ?? existing.currency,
        members: memberIds.map((userId) => ({
          userId,
          role: memberRoles[userId] || "expense_only",
        })),
      });
      await refreshData();
    },
    [groups, refreshData],
  );

  const removeGroup = useCallback(
    async (id: string) => {
      await api.deleteGroup(id);
      await refreshData();
    },
    [refreshData],
  );

  const settleUp = useCallback(
    async (toUserId: string, amount: number, currency: Currency = "USD") => {
      await api.createPayment({ toUserId, amount, currency });
      await refreshData();
    },
    [refreshData],
  );

  const settleAll = useCallback(async () => {
    const paymentsToCreate: {
      fromUserId: string;
      toUserId: string;
      amount: number;
      currency: string;
    }[] = [];

    for (const debt of simplifiedDebts) {
      if (debt.from === CURRENT_USER_ID || debt.to === CURRENT_USER_ID) {
        paymentsToCreate.push({
          fromUserId: debt.from,
          toUserId: debt.to,
          amount: debt.amount,
          currency: "USD",
        });
      }
    }

    if (paymentsToCreate.length === 0) return 0;

    const result = await api.settleAllPayments(paymentsToCreate);
    await refreshData();
    return result.count;
  }, [CURRENT_USER_ID, simplifiedDebts, refreshData]);

  // Compute simplified debts for a specific group, in the group's currency
  const getGroupSimplifiedDebts = useCallback(
    (
      group: Group,
    ): {
      from: string;
      to: string;
      amount: number;
      explanation: string[];
    }[] => {
      const groupExpenses = expenses.filter((e) => e.groupId === group.id);
      const groupPayments = payments.filter((p) => p.groupId === group.id);

      const netBalances = new Map<string, number>();
      group.memberIds.forEach((id) => netBalances.set(id, 0));

      const explanationLines: string[] = [];

      for (const expense of groupExpenses) {
        const payerName = getUserName(expense.paidBy);
        for (const split of expense.splits) {
          if (split.userId !== expense.paidBy) {
            const amountInGroupCurrency = convertCurrency(
              split.amount,
              expense.currency,
              group.currency,
            );
            netBalances.set(
              split.userId,
              (netBalances.get(split.userId) ?? 0) - amountInGroupCurrency,
            );
            netBalances.set(
              expense.paidBy,
              (netBalances.get(expense.paidBy) ?? 0) + amountInGroupCurrency,
            );
            explanationLines.push(
              `${getUserName(split.userId)} owes ${payerName} ${formatCurrency(amountInGroupCurrency, group.currency)} for "${expense.description}"`,
            );
          }
        }
      }

      for (const payment of groupPayments) {
        const amountInGroupCurrency = convertCurrency(
          payment.amount,
          payment.currency,
          group.currency,
        );
        netBalances.set(
          payment.fromUserId,
          (netBalances.get(payment.fromUserId) ?? 0) + amountInGroupCurrency,
        );
        netBalances.set(
          payment.toUserId,
          (netBalances.get(payment.toUserId) ?? 0) - amountInGroupCurrency,
        );
        explanationLines.push(
          `${getUserName(payment.fromUserId)} paid ${getUserName(payment.toUserId)} ${formatCurrency(amountInGroupCurrency, group.currency)}`,
        );
      }

      const creditors: { id: string; amount: number }[] = [];
      const debtors: { id: string; amount: number }[] = [];

      netBalances.forEach((amount, id) => {
        if (amount > 0.01) creditors.push({ id, amount });
        else if (amount < -0.01) debtors.push({ id, amount: -amount });
      });

      creditors.sort((a, b) => b.amount - a.amount);
      debtors.sort((a, b) => b.amount - a.amount);

      const netSummaryLines: string[] = [];
      netBalances.forEach((amount, id) => {
        if (Math.abs(amount) > 0.01) {
          const name = getUserName(id);
          netSummaryLines.push(
            amount > 0
              ? `${name}: net +${formatCurrency(amount, group.currency)}`
              : `${name}: net -${formatCurrency(Math.abs(amount), group.currency)}`,
          );
        }
      });

      const debts: {
        from: string;
        to: string;
        amount: number;
        explanation: string[];
      }[] = [];
      let i = 0,
        j = 0;

      while (i < debtors.length && j < creditors.length) {
        const transferAmount = Math.min(debtors[i].amount, creditors[j].amount);
        if (transferAmount > 0.01) {
          const rounded = Math.round(transferAmount * 100) / 100;
          debts.push({
            from: debtors[i].id,
            to: creditors[j].id,
            amount: rounded,
            explanation: [
              "How this was calculated:",
              "",
              "Raw debts from expenses:",
              ...explanationLines,
              "",
              "Net balances after all transactions:",
              ...netSummaryLines,
              "",
              `Simplified: ${getUserName(debtors[i].id)} pays ${getUserName(creditors[j].id)} ${formatCurrency(rounded, group.currency)}`,
            ],
          });
        }
        debtors[i].amount -= transferAmount;
        creditors[j].amount -= transferAmount;
        if (debtors[i].amount < 0.01) i++;
        if (creditors[j].amount < 0.01) j++;
      }

      return debts;
    },
    [expenses, payments, getUserName],
  );

  // Get group balance in group's currency
  const getGroupBalanceInCurrency = useCallback(
    (group: Group): number => {
      const groupExpenses = expenses.filter((e) => e.groupId === group.id);
      const groupPayments = payments.filter((p) => p.groupId === group.id);
      let balanceUSD = 0;

      for (const expense of groupExpenses) {
        if (expense.paidBy === CURRENT_USER_ID) {
          const othersShare = expense.splits
            .filter((s) => s.userId !== CURRENT_USER_ID)
            .reduce((sum, s) => sum + s.amount, 0);
          balanceUSD += convertToUSD(othersShare, expense.currency);
        } else {
          const mySplit = expense.splits.find(
            (s) => s.userId === CURRENT_USER_ID,
          );
          if (mySplit)
            balanceUSD -= convertToUSD(mySplit.amount, expense.currency);
        }
      }

      for (const payment of groupPayments) {
        const amountUSD = convertToUSD(payment.amount, payment.currency);
        if (payment.fromUserId === CURRENT_USER_ID) {
          balanceUSD += amountUSD;
        } else if (payment.toUserId === CURRENT_USER_ID) {
          balanceUSD -= amountUSD;
        }
      }

      return convertCurrency(balanceUSD, "USD", group.currency);
    },
    [CURRENT_USER_ID, expenses, payments],
  );

  return {
    users,
    expenses,
    groups,
    payments,
    activities,
    balances,
    simplifiedDebts,
    totalBalance,
    totalOwed,
    totalOwe,
    addExpense,
    editExpense,
    removeExpense,
    addGroup,
    editGroup,
    removeGroup,
    settleUp,
    settleAll,
    addFriend,
    removeFriend,
    inviteFriend,
    getGroupBalanceInCurrency,
    getGroupSimplifiedDebts,
    currentUserId: CURRENT_USER_ID,
    friendIds,
    loading,
    refreshData,
  };
}
