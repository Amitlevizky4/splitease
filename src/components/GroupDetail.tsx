import { useState } from 'react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { formatCurrency, formatDate, convertCurrency, currencySymbols } from '@/lib/utils'
import { ArrowLeft, Pencil, Trash2, ArrowRight, Info, X, Upload } from 'lucide-react'
import type { User, Group, Expense } from '@/types'
import { categoryIcons } from '@/data/mockData'
import { Avatar } from './ui/Avatar'
import { ImportExpensesDialog } from './ImportExpensesDialog'

interface GroupDebt {
  from: string
  to: string
  amount: number
  explanation: string[]
}

interface GroupDetailProps {
  users: User[]
  group: Group
  expenses: Expense[]
  currentUserId: string
  onBack: () => void
  onEditExpense: (expense: Expense) => void
  onRemoveExpense: (id: string) => void
  groupDebts: GroupDebt[]
  onImportComplete: () => void
}

export function GroupDetail({ users, group, expenses, currentUserId, onBack, onEditExpense, onRemoveExpense, groupDebts, onImportComplete }: GroupDetailProps) {
  const members = group.memberIds.map(id => users.find(u => u.id === id)).filter(Boolean)
  const [showExplanation, setShowExplanation] = useState<number | null>(null)
  const [showImport, setShowImport] = useState(false)
  const myRole = group.memberRoles[currentUserId] ?? 'expense_only'
  const isAdmin = myRole === 'admin'

  const getName = (id: string) => id === currentUserId ? 'You' : (users.find(u => u.id === id)?.name ?? 'Unknown')
  const getAvatar = (id: string) => users.find(u => u.id === id)?.avatar ?? '👤'

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1 text-teal font-medium text-sm">
        <ArrowLeft size={16} /> Back
      </button>

      <Card className="p-6 text-center">
        <span className="text-5xl">{group.emoji}</span>
        <h2 className="text-xl font-bold text-charcoal mt-2">{group.name}</h2>
        <p className="text-sm text-charcoal-light mt-1">Currency: {currencySymbols[group.currency]} {group.currency}</p>
        <div className="flex justify-center gap-2 mt-3 flex-wrap">
          {members.map(m => m && (
            <span key={m.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-1">
              <Avatar src={m.avatar} name={m.name} size="sm" /> {m.id === currentUserId ? 'You' : m.name}
              {group.memberRoles[m.id] === 'admin' && (
                <span className="text-[10px] text-teal font-semibold">admin</span>
              )}
            </span>
          ))}
        </div>
        {isAdmin && (
          <Button size="sm" className="mt-3" onClick={() => setShowImport(true)}>
            <Upload size={14} className="mr-1" /> Import from Splitwise
          </Button>
        )}
      </Card>

      {/* Smart Settle Section */}
      {groupDebts.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-charcoal mb-1">Smart Settle</h3>
          <p className="text-xs text-charcoal-light mb-3">Optimized payments to settle this group</p>
          <div className="space-y-2">
            {groupDebts.map((debt, i) => (
              <div key={i} className="relative">
                <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg text-sm">
                  <Avatar src={getAvatar(debt.from)} name={getName(debt.from)} size="sm" />
                  <span className="font-medium">{getName(debt.from)}</span>
                  <ArrowRight size={16} className="text-charcoal-light" />
                  <Avatar src={getAvatar(debt.to)} name={getName(debt.to)} size="sm" />
                  <span className="font-medium">{getName(debt.to)}</span>
                  <span className="ml-auto font-bold text-teal">{formatCurrency(debt.amount, group.currency)}</span>
                  <button
                    onClick={() => setShowExplanation(showExplanation === i ? null : i)}
                    className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                    title="How was this calculated?"
                  >
                    <Info size={14} className="text-charcoal-light" />
                  </button>
                </div>
                {showExplanation === i && (
                  <div className="mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-md text-xs text-charcoal-light animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-charcoal text-sm">Calculation breakdown</span>
                      <button onClick={() => setShowExplanation(null)} className="p-0.5 rounded hover:bg-gray-100">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {debt.explanation.map((line, j) => (
                        <p key={j} className={line === '' ? 'h-2' : line.startsWith('How') || line.startsWith('Raw') || line.startsWith('Net') || line.startsWith('Simplified') ? 'font-semibold text-charcoal' : ''}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {groupDebts.length === 0 && expenses.length > 0 && (
        <Card className="p-4 text-center">
          <p className="text-sm text-teal font-medium">All settled up in this group!</p>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="font-semibold text-charcoal mb-3">Expenses</h3>
        <div className="space-y-3">
          {expenses.sort((a, b) => b.date.getTime() - a.date.getTime()).map(expense => {
            const paidBy = expense.paidBy === currentUserId ? 'You' : users.find(u => u.id === expense.paidBy)?.name
            const mySplit = expense.splits.find(s => s.userId === currentUserId)
            const myAmount = mySplit?.amount ?? 0
            const isOwed = expense.paidBy === currentUserId
            const netForMe = isOwed ? expense.amount - myAmount : -myAmount
            const netInGroupCurrency = convertCurrency(netForMe, expense.currency, group.currency)
            const amountInGroupCurrency = convertCurrency(expense.amount, expense.currency, group.currency)

            return (
              <div key={expense.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{categoryIcons[expense.category]}</span>
                  <div>
                    <p className="font-medium text-sm text-charcoal">{expense.description}</p>
                    <p className="text-xs text-charcoal-light">
                      {paidBy} paid {formatCurrency(amountInGroupCurrency, group.currency)}
                      {expense.currency !== group.currency && (
                        <span className="text-charcoal-light"> ({formatCurrency(expense.amount, expense.currency)})</span>
                      )}
                      {' · '}{formatDate(expense.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    {Math.abs(netForMe) < 0.01 ? (
                      <p className="text-xs text-charcoal-light">not involved</p>
                    ) : netForMe > 0 ? (
                      <p className="text-sm font-semibold text-teal">you lent {formatCurrency(Math.abs(netInGroupCurrency), group.currency)}</p>
                    ) : (
                      <p className="text-sm font-semibold text-danger">you borrowed {formatCurrency(Math.abs(netInGroupCurrency), group.currency)}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => onEditExpense(expense)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title="Edit expense"
                      >
                        <Pencil size={13} className="text-charcoal-light" />
                      </button>
                      <button
                        onClick={() => onRemoveExpense(expense.id)}
                        className="p-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete expense"
                      >
                        <Trash2 size={13} className="text-danger" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {expenses.length === 0 && (
            <p className="text-center text-charcoal-light py-4 text-sm">No expenses yet</p>
          )}
        </div>
      </Card>

      <ImportExpensesDialog
        open={showImport}
        onOpenChange={setShowImport}
        group={group}
        users={users}
        currentUserId={currentUserId}
        onImportComplete={onImportComplete}
      />
    </div>
  )
}
