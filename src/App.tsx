import { useState } from "react";
import { useStore } from "./store/useStore";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./components/LoginPage";
import { Dashboard } from "./components/Dashboard";
import { FriendsView } from "./components/FriendsView";
import { FriendDetail } from "./components/FriendDetail";
import { GroupsView } from "./components/GroupsView";
import { ActivityView } from "./components/ActivityView";
import { AccountView } from "./components/AccountView";
import { AddExpenseDialog } from "./components/AddExpenseDialog";
import { SettleUpDialog } from "./components/SettleUpDialog";
import {
  Users,
  UsersRound,
  Activity,
  User,
  Plus,
  Handshake,
  LayoutDashboard,
} from "lucide-react";
import type { Expense } from "./types";

type Tab = "dashboard" | "friends" | "groups" | "activity" | "account";

export default function App() {
  const { user: authUser, isAuthenticated } = useAuth();

  if (!isAuthenticated || !authUser) {
    return <LoginPage />;
  }

  return <AuthenticatedApp key={authUser.id} authUserId={authUser.id} />;
}

function AuthenticatedApp({ authUserId }: { authUserId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const store = useStore(authUserId);

  if (store.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-teal mb-2">SplitEase</h1>
          <p className="text-charcoal-light text-sm">Loading your data...</p>
        </div>
      </div>
    );
  }

  const handleFriendClick = (userId: string) => {
    setSelectedFriend(userId);
    setActiveTab("friends");
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setShowAddExpense(true);
  };

  const handleAddExpenseClose = (open: boolean) => {
    setShowAddExpense(open);
    if (!open) setEditingExpense(null);
  };

  // Determine preselected group: when on group detail page
  const preselectedGroupId =
    activeTab === "groups" && selectedGroupId ? selectedGroupId : null;

  const renderContent = () => {
    if (activeTab === "friends" && selectedFriend) {
      return (
        <FriendDetail
          users={store.users}
          friendId={selectedFriend}
          balances={store.balances}
          expenses={store.expenses}
          payments={store.payments}
          currentUserId={store.currentUserId}
          onBack={() => setSelectedFriend(null)}
          onSettleUp={store.settleUp}
          onEditExpense={handleEditExpense}
          onRemoveExpense={store.removeExpense}
        />
      );
    }

    switch (activeTab) {
      case "dashboard":
        return (
          <Dashboard
            users={store.users}
            totalBalance={store.totalBalance}
            totalOwed={store.totalOwed}
            totalOwe={store.totalOwe}
            balances={store.balances}
            simplifiedDebts={store.simplifiedDebts}
            onFriendClick={handleFriendClick}
            onSettleAll={store.settleAll}
          />
        );
      case "friends":
        return (
          <FriendsView
            users={store.users}
            balances={store.balances}
            currentUserId={store.currentUserId}
            friendIds={store.friendIds}
            onFriendClick={handleFriendClick}
            onAddFriend={store.addFriend}
            onRemoveFriend={store.removeFriend}
            onInviteFriend={store.inviteFriend}
          />
        );
      case "groups":
        return (
          <GroupsView
            users={store.users}
            groups={store.groups}
            expenses={store.expenses}
            currentUserId={store.currentUserId}
            onAddGroup={store.addGroup}
            onEditGroup={store.editGroup}
            onRemoveGroup={store.removeGroup}
            getGroupBalanceInCurrency={store.getGroupBalanceInCurrency}
            getGroupSimplifiedDebts={store.getGroupSimplifiedDebts}
            onEditExpense={handleEditExpense}
            onRemoveExpense={store.removeExpense}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
          />
        );
      case "activity":
        return <ActivityView activities={store.activities} />;
      case "account":
        return (
          <AccountView
            totalBalance={store.totalBalance}
            totalOwed={store.totalOwed}
            totalOwe={store.totalOwe}
          />
        );
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "dashboard", label: "Home", icon: LayoutDashboard },
    { id: "friends", label: "Friends", icon: Users },
    { id: "groups", label: "Groups", icon: UsersRound },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "account", label: "Account", icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <header className="bg-teal text-white px-4 py-4 flex items-center justify-between sticky top-0 z-30">
        <h1 className="text-xl font-bold tracking-tight">SplitEase</h1>
        <button
          onClick={() => setShowSettleUp(true)}
          className="flex items-center gap-1 text-sm bg-white/20 rounded-lg px-3 py-1.5 hover:bg-white/30 transition-colors"
        >
          <Handshake size={16} /> Settle Up
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        {renderContent()}
      </main>

      {/* FAB - Add Expense */}
      <button
        onClick={() => {
          setEditingExpense(null);
          setShowAddExpense(true);
        }}
        className="fixed bottom-24 right-4 md:right-auto md:left-1/2 md:translate-x-[calc(256px-28px)] w-14 h-14 bg-teal text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-dark transition-colors z-20"
      >
        <Plus size={28} />
      </button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-200 z-30">
        <div className="flex">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                if (id !== "friends") setSelectedFriend(null);
                if (id !== "groups") setSelectedGroupId(null);
              }}
              className={`flex-1 flex flex-col items-center py-2 pt-3 transition-colors ${
                activeTab === id
                  ? "text-teal"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] mt-1 font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Dialogs */}
      <AddExpenseDialog
        open={showAddExpense}
        onOpenChange={handleAddExpenseClose}
        currentUserId={store.currentUserId}
        users={store.users}
        groups={store.groups}
        onAddExpense={store.addExpense}
        onEditExpense={store.editExpense}
        editingExpense={editingExpense}
        preselectedGroupId={preselectedGroupId}
      />
      <SettleUpDialog
        open={showSettleUp}
        onOpenChange={setShowSettleUp}
        users={store.users}
        balances={store.balances}
        onSettleUp={store.settleUp}
      />
    </div>
  );
}
