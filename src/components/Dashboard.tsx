import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, ArrowRight, CheckCircle } from 'lucide-react'
import type { User, Balance } from '@/types'
import { Avatar } from './ui/Avatar'

interface DashboardProps {
  users: User[]
  totalBalance: number
  totalOwed: number
  totalOwe: number
  balances: Balance[]
  simplifiedDebts: { from: string; to: string; amount: number }[]
  onFriendClick: (userId: string) => void
  onSettleAll: () => number | Promise<number>
}

export function Dashboard({ users, totalBalance, totalOwed, totalOwe, balances, simplifiedDebts, onFriendClick, onSettleAll }: DashboardProps) {
  const getUserName = (id: string) => users.find(u => u.id === id)?.name ?? 'Unknown'
  const getUserAvatar = (id: string) => users.find(u => u.id === id)?.avatar ?? '👤'

  const handleSettleAll = async () => {
    const count = await onSettleAll()
    if (count === 0) {
      alert('Nothing to settle - all balances are already zero!')
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Balance Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <Wallet size={20} className="mx-auto mb-1 text-teal" />
          <p className="text-xs text-charcoal-light">Total balance</p>
          <p className={`text-lg font-bold ${totalBalance >= 0 ? 'text-teal' : 'text-danger'}`}>
            {totalBalance >= 0 ? '+' : '-'}{formatCurrency(totalBalance)}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <TrendingUp size={20} className="mx-auto mb-1 text-teal" />
          <p className="text-xs text-charcoal-light">You are owed</p>
          <p className="text-lg font-bold text-teal">
            {formatCurrency(totalOwed)}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <TrendingDown size={20} className="mx-auto mb-1 text-danger" />
          <p className="text-xs text-charcoal-light">You owe</p>
          <p className="text-lg font-bold text-danger">
            {formatCurrency(totalOwe)}
          </p>
        </Card>
      </div>

      {/* Friend Balances */}
      <Card className="p-4">
        <h3 className="font-semibold text-charcoal mb-3">Balances by Friend</h3>
        <div className="space-y-3">
          {balances.filter(b => Math.abs(b.amount) > 0.01).map(balance => {
            const user = users.find(u => u.id === balance.userId)
            if (!user) return null
            return (
              <div
                key={balance.userId}
                className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onFriendClick(balance.userId)}
              >
                <div className="flex items-center gap-3">
                  <Avatar src={user.avatar} name={user.name} size="md" />
                  <span className="font-medium text-charcoal">{user.name}</span>
                </div>
                <span className={`font-semibold ${balance.amount >= 0 ? 'text-teal' : 'text-danger'}`}>
                  {balance.amount >= 0
                    ? `owes you ${formatCurrency(balance.amount)}`
                    : `you owe ${formatCurrency(balance.amount)}`}
                </span>
              </div>
            )
          })}
          {balances.filter(b => Math.abs(b.amount) > 0.01).length === 0 && (
            <p className="text-center text-charcoal-light py-4">All settled up!</p>
          )}
        </div>
      </Card>

      {/* Simplified Debts */}
      {simplifiedDebts.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-charcoal">Simplified Debts</h3>
              <p className="text-xs text-charcoal-light">Optimized payments to settle all balances (in USD)</p>
            </div>
            <Button size="sm" onClick={handleSettleAll}>
              <CheckCircle size={14} className="mr-1" /> Settle All
            </Button>
          </div>
          <div className="space-y-2">
            {simplifiedDebts.map((debt, i) => (
              <div key={i} className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg text-sm">
                <Avatar src={getUserAvatar(debt.from)} name={getUserName(debt.from)} size="sm" />
                <span className="font-medium">{getUserName(debt.from)}</span>
                <ArrowRight size={16} className="text-charcoal-light" />
                <Avatar src={getUserAvatar(debt.to)} name={getUserName(debt.to)} size="sm" />
                <span className="font-medium">{getUserName(debt.to)}</span>
                <span className="ml-auto font-bold text-teal">{formatCurrency(debt.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
