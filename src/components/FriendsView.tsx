import { useState } from "react";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { Input } from "./ui/Input";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Mail, Copy, Check } from "lucide-react";
import type { User, Balance } from "@/types";
import { Avatar } from "./ui/Avatar";

interface FriendsViewProps {
  users: User[];
  balances: Balance[];
  currentUserId: string;
  friendIds: string[];
  onFriendClick: (userId: string) => void;
  onAddFriend: (email: string) => Promise<string>;
  onRemoveFriend: (id: string) => Promise<void>;
  onInviteFriend: (
    email: string,
    groupId?: string,
  ) => Promise<{ status: string; message: string; inviteLink?: string }>;
}

export function FriendsView({
  users,
  balances,
  currentUserId,
  friendIds,
  onFriendClick,
  onAddFriend,
  onRemoveFriend,
  onInviteFriend,
}: FriendsViewProps) {
  const friends = users.filter(
    (u) => u.id !== currentUserId && friendIds.includes(u.id),
  );
  const [showInvite, setShowInvite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSending(true);
    setInviteError(null);
    setInviteMessage(null);
    setInviteLink(null);

    try {
      // First try to add as friend (if they have an account)
      await onAddFriend(email);
      setInviteMessage(`Friend added successfully!`);
      setEmail("");
      setTimeout(() => {
        setShowInvite(false);
        setInviteMessage(null);
      }, 1500);
    } catch {
      // User doesn't exist yet, create invitation and get shareable link
      try {
        const result = await onInviteFriend(email);
        setInviteMessage(result.message);
        if (result.inviteLink) {
          setInviteLink(result.inviteLink);
        }
        setEmail("");
      } catch (err) {
        setInviteError(
          err instanceof Error ? err.message : "Failed to send invitation",
        );
      }
    }

    setSending(false);
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (id: string) => {
    await onRemoveFriend(id);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-charcoal">Friends</h2>
        <Button
          size="sm"
          onClick={() => {
            setEmail("");
            setInviteError(null);
            setInviteMessage(null);
            setShowInvite(true);
          }}
        >
          <Plus size={16} className="mr-1" /> Add Friend
        </Button>
      </div>

      {friends.map((friend) => {
        const balance = balances.find((b) => b.userId === friend.id);
        const amount = balance?.amount ?? 0;

        return (
          <Card
            key={friend.id}
            className="p-4"
            onClick={() => onFriendClick(friend.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar src={friend.avatar} name={friend.name} size="lg" />
                <div>
                  <p className="font-medium text-charcoal">{friend.name}</p>
                  <p className="text-xs text-charcoal-light">{friend.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-2">
                  {Math.abs(amount) < 0.01 ? (
                    <p className="text-sm text-charcoal-light">settled up</p>
                  ) : amount > 0 ? (
                    <>
                      <p className="text-xs text-charcoal-light">owes you</p>
                      <p className="font-bold text-teal">
                        {formatCurrency(amount)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-charcoal-light">you owe</p>
                      <p className="font-bold text-danger">
                        {formatCurrency(amount)}
                      </p>
                    </>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(friend.id);
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  title="Remove friend"
                >
                  <Trash2 size={14} className="text-danger" />
                </button>
              </div>
            </div>
          </Card>
        );
      })}

      {friends.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-charcoal-light">
            No friends yet. Invite someone to get started!
          </p>
        </Card>
      )}

      {/* Invite Friend Dialog */}
      <Dialog
        open={showInvite}
        onOpenChange={(open) => {
          setShowInvite(open);
          if (!open) {
            setInviteLink(null);
            setCopied(false);
          }
        }}
        title="Add Friend"
      >
        <div className="space-y-4">
          {inviteLink ? (
            <>
              <p className="text-sm text-teal">{inviteMessage}</p>
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 bg-transparent text-xs text-charcoal truncate outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 px-3 py-1.5 bg-teal text-white text-xs rounded-lg hover:bg-teal-dark transition-colors shrink-0"
                >
                  {copied ? (
                    <>
                      <Check size={14} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-charcoal-light">
                Share this link with your friend via WhatsApp, SMS, or any
                messaging app. They'll be added as your friend when they sign
                in.
              </p>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => {
                  setShowInvite(false);
                  setInviteLink(null);
                  setInviteMessage(null);
                  setCopied(false);
                }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-charcoal-light">
                Enter their email address. If they already have a SplitEase
                account, they'll be added instantly. Otherwise, you'll get a
                shareable invite link.
              </p>
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
              />
              {inviteMessage && (
                <p className="text-sm text-teal">{inviteMessage}</p>
              )}
              {inviteError && (
                <p className="text-sm text-danger">{inviteError}</p>
              )}
              <Button
                className="w-full"
                onClick={handleInvite}
                disabled={!email.trim() || sending}
              >
                <Mail size={16} className="mr-1" />
                {sending ? "Sending..." : "Add / Invite Friend"}
              </Button>
            </>
          )}
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
        title="Remove Friend"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Are you sure you want to remove{" "}
            <strong>{users.find((u) => u.id === confirmDelete)?.name}</strong>?
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Remove
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
