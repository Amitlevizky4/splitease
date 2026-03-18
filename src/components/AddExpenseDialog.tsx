import { useState } from 'react'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { User, Expense, SplitMethod, Category, Currency, Group } from '@/types'
import { categoryIcons } from '@/data/mockData'
import { currencySymbols } from '@/lib/utils'
import { Avatar } from './ui/Avatar'

interface AddExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  users: User[]
  groups: Group[]
  onAddExpense: (expense: Omit<Expense, 'id'>) => void
  onEditExpense?: (id: string, expense: Omit<Expense, 'id'>) => void
  editingExpense?: Expense | null
  preselectedGroupId?: string | null
}

const categoryList: { value: Category; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'rent', label: 'Rent' },
  { value: 'travel', label: 'Travel' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
]

const currencyList: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'ILS', 'CAD', 'AUD', 'CHF', 'CNY', 'INR']

function getInitialState(
  editingExpense: Expense | null | undefined,
  preselectedGroupId: string | null | undefined,
  groups: Group[],
  currentUserId: string,
) {
  if (editingExpense) {
    const ea: Record<string, string> = {}
    const pct: Record<string, string> = {}
    if (editingExpense.splitMethod === 'exact') {
      editingExpense.splits.forEach(s => { ea[s.userId] = s.amount.toString() })
    }
    if (editingExpense.splitMethod === 'percentage') {
      editingExpense.splits.forEach(s => {
        pct[s.userId] = ((s.amount / editingExpense.amount) * 100).toFixed(0)
      })
    }
    return {
      description: editingExpense.description,
      amount: editingExpense.amount.toString(),
      currency: editingExpense.currency,
      category: editingExpense.category,
      date: editingExpense.date.toISOString().split('T')[0],
      splitMethod: editingExpense.splitMethod,
      selectedFriends: editingExpense.splits.filter(s => s.userId !== currentUserId).map(s => s.userId),
      selectedGroup: editingExpense.groupId ?? '',
      exactAmounts: ea,
      percentages: pct,
    }
  }

  if (preselectedGroupId) {
    const group = groups.find(g => g.id === preselectedGroupId)
    if (group) {
      return {
        description: '',
        amount: '',
        currency: group.currency,
        category: 'food' as Category,
        date: new Date().toISOString().split('T')[0],
        splitMethod: 'equal' as SplitMethod,
        selectedFriends: group.memberIds.filter(id => id !== currentUserId),
        selectedGroup: preselectedGroupId,
        exactAmounts: {} as Record<string, string>,
        percentages: {} as Record<string, string>,
      }
    }
  }

  return {
    description: '',
    amount: '',
    currency: 'USD' as Currency,
    category: 'food' as Category,
    date: new Date().toISOString().split('T')[0],
    splitMethod: 'equal' as SplitMethod,
    selectedFriends: [] as string[],
    selectedGroup: '',
    exactAmounts: {} as Record<string, string>,
    percentages: {} as Record<string, string>,
  }
}

// Use a key to force re-mount when editing expense or preselected group changes
export function AddExpenseDialog(props: AddExpenseDialogProps) {
  const key = props.editingExpense?.id ?? props.preselectedGroupId ?? 'new'
  return props.open ? <AddExpenseDialogInner key={key} {...props} /> : null
}

function AddExpenseDialogInner({ open, onOpenChange, currentUserId, users, groups, onAddExpense, onEditExpense, editingExpense, preselectedGroupId }: AddExpenseDialogProps) {
  const isEditing = !!editingExpense
  const init = getInitialState(editingExpense, preselectedGroupId, groups, currentUserId)

  const [description, setDescription] = useState(init.description)
  const [amount, setAmount] = useState(init.amount)
  const [currency, setCurrency] = useState<Currency>(init.currency)
  const [category, setCategory] = useState<Category>(init.category)
  const [date, setDate] = useState(init.date)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(init.splitMethod)
  const [selectedFriends, setSelectedFriends] = useState<string[]>(init.selectedFriends)
  const [selectedGroup, setSelectedGroup] = useState<string>(init.selectedGroup)
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(init.exactAmounts)
  const [percentages, setPercentages] = useState<Record<string, string>>(init.percentages)

  const [paidBy, setPaidBy] = useState<string>(editingExpense?.paidBy ?? currentUserId)

  // When a group is selected, only show group members; otherwise show all friends
  const selectedGroupObj = selectedGroup ? groups.find(g => g.id === selectedGroup) : null
  const friends = selectedGroupObj
    ? users.filter(u => u.id !== currentUserId && selectedGroupObj.memberIds.includes(u.id))
    : users.filter(u => u.id !== currentUserId)

  const toggleFriend = (userId: string) => {
    setSelectedFriends(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const allParticipants = [...new Set([currentUserId, paidBy, ...selectedFriends])]
  const totalAmount = parseFloat(amount) || 0

  const handleGroupChange = (groupId: string) => {
    setSelectedGroup(groupId)
    if (groupId) {
      const group = groups.find(g => g.id === groupId)
      if (group) {
        setSelectedFriends(group.memberIds.filter(id => id !== currentUserId))
        setCurrency(group.currency)
      }
    }
  }

  const calculateSplits = () => {
    if (splitMethod === 'equal') {
      const perPerson = totalAmount / allParticipants.length
      return allParticipants.map(userId => ({
        userId,
        amount: Math.round(perPerson * 100) / 100,
      }))
    }
    if (splitMethod === 'exact') {
      return allParticipants.map(userId => ({
        userId,
        amount: parseFloat(exactAmounts[userId] || '0'),
      }))
    }
    return allParticipants.map(userId => ({
      userId,
      amount: Math.round(totalAmount * (parseFloat(percentages[userId] || '0') / 100) * 100) / 100,
    }))
  }

  const handleSubmit = () => {
    if (!description.trim() || totalAmount <= 0 || selectedFriends.length === 0) return

    const splits = calculateSplits()
    const expenseData: Omit<Expense, 'id'> = {
      description,
      amount: totalAmount,
      currency,
      category,
      date: new Date(date),
      paidBy,
      splits,
      splitMethod,
      groupId: selectedGroup || undefined,
    }

    if (isEditing && editingExpense && onEditExpense) {
      onEditExpense(editingExpense.id, expenseData)
    } else {
      onAddExpense(expenseData)
    }

    onOpenChange(false)
  }

  const equalShare = selectedFriends.length > 0
    ? Math.round((totalAmount / allParticipants.length) * 100) / 100
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={isEditing ? 'Edit Expense' : 'Add Expense'}>
      <div className="space-y-4">
        <Input
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g., Dinner at Olive Garden"
        />

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              label={`Amount (${currencySymbols[currency]})`}
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="w-28">
            <label className="block text-sm font-medium text-charcoal-light mb-1.5">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as Currency)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/50"
            >
              {currencyList.map(c => (
                <option key={c} value={c}>{currencySymbols[c]} {c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-light mb-1.5">Category</label>
          <div className="flex flex-wrap gap-2">
            {categoryList.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors ${
                  category === c.value
                    ? 'bg-teal text-white'
                    : 'bg-gray-100 text-charcoal hover:bg-gray-200'
                }`}
              >
                {categoryIcons[c.value]} {c.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-charcoal-light mb-1.5">Paid by</label>
          <select
            value={paidBy}
            onChange={e => setPaidBy(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/50"
          >
            <option value={currentUserId}>You</option>
            {friends.filter(f => selectedFriends.includes(f.id)).map(f => (
              <option key={f.id} value={f.id}>{f.avatar} {f.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-light mb-1.5">Group (optional)</label>
          <select
            value={selectedGroup}
            onChange={e => handleGroupChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/50"
          >
            <option value="">No group</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
            ))}
          </select>
          {selectedGroup && (
            <p className="text-xs text-charcoal-light mt-1">
              Group currency: {currencySymbols[groups.find(g => g.id === selectedGroup)?.currency ?? 'USD']}{' '}
              {groups.find(g => g.id === selectedGroup)?.currency}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-light mb-2">Split with</label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {friends.map(friend => (
              <label
                key={friend.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedFriends.includes(friend.id)}
                  onChange={() => toggleFriend(friend.id)}
                  className="w-4 h-4 rounded border-gray-300 text-teal focus:ring-teal"
                />
                <Avatar src={friend.avatar} name={friend.name} size="md" />
                <span className="text-sm font-medium text-charcoal">{friend.name}</span>
              </label>
            ))}
          </div>
        </div>

        {selectedFriends.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-charcoal-light mb-2">Split method</label>
            <div className="flex gap-2">
              {(['equal', 'exact', 'percentage'] as SplitMethod[]).map(method => (
                <button
                  key={method}
                  onClick={() => setSplitMethod(method)}
                  className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
                    splitMethod === method
                      ? 'bg-teal text-white'
                      : 'bg-gray-100 text-charcoal hover:bg-gray-200'
                  }`}
                >
                  {method === 'equal' ? 'Equally' : method === 'exact' ? 'Exact' : 'Percentage'}
                </button>
              ))}
            </div>

            {splitMethod === 'equal' && totalAmount > 0 && (
              <p className="text-xs text-charcoal-light mt-2">
                Each person pays <span className="font-semibold text-teal">{currencySymbols[currency]}{equalShare.toFixed(currency === 'JPY' ? 0 : 2)}</span>
              </p>
            )}

            {splitMethod === 'exact' && (
              <div className="mt-2 space-y-2">
                {allParticipants.map(userId => {
                  const user = users.find(u => u.id === userId)
                  return (
                    <div key={userId} className="flex items-center gap-2">
                      <span className="text-sm min-w-[80px]">{userId === currentUserId ? 'You' : user?.name}</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={exactAmounts[userId] ?? ''}
                        onChange={e => setExactAmounts(prev => ({ ...prev, [userId]: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  )
                })}
              </div>
            )}

            {splitMethod === 'percentage' && (
              <div className="mt-2 space-y-2">
                {allParticipants.map(userId => {
                  const user = users.find(u => u.id === userId)
                  return (
                    <div key={userId} className="flex items-center gap-2">
                      <span className="text-sm min-w-[80px]">{userId === currentUserId ? 'You' : user?.name}</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={percentages[userId] ?? ''}
                        onChange={e => setPercentages(prev => ({ ...prev, [userId]: e.target.value }))}
                        placeholder="%"
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!description.trim() || totalAmount <= 0 || selectedFriends.length === 0}
        >
          {isEditing ? 'Save Changes' : 'Add Expense'}
        </Button>
      </div>
    </Dialog>
  )
}
