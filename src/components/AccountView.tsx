import { useState } from "react";
import { Card } from "./ui/Card";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { Settings, Bell, HelpCircle, LogOut } from "lucide-react";

interface AccountViewProps {
  totalBalance: number;
  totalOwed: number;
  totalOwe: number;
}

export function AccountView({
  totalBalance,
  totalOwed,
  totalOwe,
}: AccountViewProps) {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!user) return null;

  const isGooglePicture = user.avatar.startsWith("http");

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="p-6 text-center">
        {isGooglePicture ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-16 h-16 rounded-full mx-auto"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-5xl">{user.avatar}</span>
        )}
        <h2 className="text-xl font-bold text-charcoal mt-2">{user.name}</h2>
        <p className="text-sm text-charcoal-light">{user.email}</p>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-charcoal-light">Balance</p>
            <p
              className={`font-bold ${totalBalance >= 0 ? "text-teal" : "text-danger"}`}
            >
              {totalBalance >= 0 ? "+" : "-"}
              {formatCurrency(totalBalance)}
            </p>
          </div>
          <div>
            <p className="text-xs text-charcoal-light">Owed</p>
            <p className="font-bold text-teal">{formatCurrency(totalOwed)}</p>
          </div>
          <div>
            <p className="text-xs text-charcoal-light">Owe</p>
            <p className="font-bold text-danger">{formatCurrency(totalOwe)}</p>
          </div>
        </div>
      </Card>

      <Card className="divide-y divide-gray-100">
        {[
          { icon: Settings, label: "Settings", onClick: undefined },
          { icon: Bell, label: "Notifications", onClick: undefined },
          { icon: HelpCircle, label: "Help & Support", onClick: undefined },
          {
            icon: LogOut,
            label: "Sign Out",
            onClick: () => setShowLogoutConfirm(true),
          },
        ].map(({ icon: Icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex items-center gap-3 w-full p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <Icon size={20} className="text-charcoal-light" />
            <span className="text-sm font-medium text-charcoal">{label}</span>
          </button>
        ))}
      </Card>

      <Dialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign Out"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Are you sure you want to sign out?
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
