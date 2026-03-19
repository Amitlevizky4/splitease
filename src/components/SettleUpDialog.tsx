import { useState } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import type { User, Balance, Currency } from "@/types";
import { Avatar } from "./ui/Avatar";
import { formatCurrency, currencySymbols, convertFromUSD } from "@/lib/utils";

interface SettleUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: User[]
  balances: Balance[]
  onSettleUp: (toUserId: string, amount: number, currency: Currency) => void
}

const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'ILS', 'CAD', 'AUD', 'CHF', 'CNY', 'INR']

export function SettleUpDialog({ open, onOpenChange, users, balances, onSettleUp }: SettleUpDialogProps) {
  const [selectedFriend, setSelectedFriend] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')

  const oweBalances = balances.filter(b => b.amount < -0.01)

  const handleFriendSelect = (userId: string) => {
    setSelectedFriend(userId)
    const bal = balances.find(b => b.userId === userId)
    if (bal) {
      // Convert USD balance to selected currency
      const converted = convertFromUSD(Math.abs(bal.amount), currency)
      setAmount(converted.toFixed(currency === 'JPY' ? 0 : 2))
    }
  }

  const handleCurrencyChange = (newCurrency: Currency) => {
    setCurrency(newCurrency)
    if (selectedFriend) {
      const bal = balances.find(b => b.userId === selectedFriend)
      if (bal) {
        const converted = convertFromUSD(Math.abs(bal.amount), newCurrency)
        setAmount(converted.toFixed(newCurrency === 'JPY' ? 0 : 2))
      }
    }
  }

  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = () => {
    setShowConfirm(true);
  };

  const handleConfirmedSubmit = () => {
    const amt = parseFloat(amount);
    if (!selectedFriend || isNaN(amt) || amt <= 0) return;
    onSettleUp(selectedFriend, amt, currency);
    setSelectedFriend("");
    setAmount("");
    setCurrency("USD");
    setShowConfirm(false);
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange} title="Settle Up">
      <div className="space-y-4">
        {oweBalances.length === 0 ? (
          <p className="text-center text-charcoal-light py-4">You don't owe anyone!</p>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-2">Pay who?</label>
              <div className="space-y-2">
                {oweBalances.map(balance => {
                  const user = users.find(u => u.id === balance.userId)
                  if (!user) return null
                  return (
                    <button
                      key={balance.userId}
                      onClick={() => handleFriendSelect(balance.userId)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                        selectedFriend === balance.userId
                          ? 'bg-teal-light ring-2 ring-teal'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatar} name={user.name} size="md" />
                        <span className="font-medium text-sm text-charcoal">{user.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-danger">
                        you owe {formatCurrency(Math.abs(balance.amount))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedFriend && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      label={`Amount (${currencySymbols[currency]})`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-sm font-medium text-charcoal-light mb-1.5">Currency</label>
                    <select
                      value={currency}
                      onChange={e => handleCurrencyChange(e.target.value as Currency)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/50"
                    >
                      {currencies.map(c => (
                        <option key={c} value={c}>{currencySymbols[c]} {c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button className="w-full" onClick={handleSubmit}>
                  Record Payment
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </Dialog>

    <Dialog open={showConfirm} onOpenChange={setShowConfirm} title="Confirm Payment">
      <div className="space-y-4">
        <p className="text-sm text-charcoal">
          Are you sure you want to record a payment of{" "}
          <strong>{currencySymbols[currency]}{amount}</strong> to{" "}
          <strong>{users.find(u => u.id === selectedFriend)?.name}</strong>?
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleConfirmedSubmit}>
            Confirm
          </Button>
        </div>
      </div>
    </Dialog>
    </>
  )
}
