import { useState } from 'react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { Input } from './ui/Input'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { User, Group, Expense, Currency, GroupRole } from '@/types'
import { formatCurrency, currencySymbols } from '@/lib/utils'
import { GroupDetail } from './GroupDetail'
import { Avatar } from './ui/Avatar'

interface GroupsViewProps {
  users: User[]
  groups: Group[]
  expenses: Expense[]
  currentUserId: string
  onAddGroup: (group: Omit<Group, 'id'>) => string | Promise<string>
  onEditGroup: (id: string, updates: Partial<Omit<Group, 'id'>>) => void
  onRemoveGroup: (id: string) => void
  getGroupBalanceInCurrency: (group: Group) => number
  getGroupSimplifiedDebts: (group: Group) => { from: string; to: string; amount: number; explanation: string[] }[]
  onEditExpense: (expense: Expense) => void
  onRemoveExpense: (id: string) => void
  selectedGroupId: string | null
  onSelectGroup: (id: string | null) => void
}

const emojiOptions = ['🏠', '✈️', '🍕', '🎮', '⚽', '🎵', '📚', '💼', '🏖️', '🎉', '🚗', '🛒']
const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'ILS', 'CAD', 'AUD', 'CHF', 'CNY', 'INR']

export function GroupsView({
  users, groups, expenses, currentUserId,
  onAddGroup, onEditGroup, onRemoveGroup,
  getGroupBalanceInCurrency, getGroupSimplifiedDebts,
  onEditExpense, onRemoveExpense,
  selectedGroupId, onSelectGroup,
}: GroupsViewProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Form state (shared for create + edit)
  const [formName, setFormName] = useState('')
  const [formEmoji, setFormEmoji] = useState('🏠')
  const [formCurrency, setFormCurrency] = useState<Currency>('USD')
  const [formMembers, setFormMembers] = useState<string[]>([currentUserId])
  const [formRoles, setFormRoles] = useState<Record<string, GroupRole>>({ [currentUserId]: 'admin' })

  const friends = users.filter(u => u.id !== currentUserId)

  const toggleMember = (userId: string) => {
    setFormMembers(prev => {
      if (prev.includes(userId)) {
        setFormRoles(r => { const next = { ...r }; delete next[userId]; return next })
        return prev.filter(id => id !== userId)
      }
      setFormRoles(r => ({ ...r, [userId]: 'expense_only' }))
      return [...prev, userId]
    })
  }

  const resetForm = () => {
    setFormName('')
    setFormEmoji('🏠')
    setFormCurrency('USD')
    setFormMembers([currentUserId])
    setFormRoles({ [currentUserId]: 'admin' })
  }

  const openCreate = () => {
    resetForm()
    setShowCreate(true)
  }

  const openEdit = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation()
    setFormName(group.name)
    setFormEmoji(group.emoji)
    setFormCurrency(group.currency)
    setFormMembers(group.memberIds)
    setFormRoles(group.memberRoles)
    setEditingGroup(group)
  }

  const handleCreate = () => {
    if (!formName.trim()) return
    onAddGroup({ name: formName, emoji: formEmoji, memberIds: formMembers, memberRoles: formRoles, currency: formCurrency })
    setShowCreate(false)
    resetForm()
  }

  const handleEdit = () => {
    if (!editingGroup || !formName.trim()) return
    onEditGroup(editingGroup.id, { name: formName, emoji: formEmoji, memberIds: formMembers, memberRoles: formRoles, currency: formCurrency })
    setEditingGroup(null)
    resetForm()
  }

  const handleDelete = (id: string) => {
    onRemoveGroup(id)
    setConfirmDelete(null)
  }

  if (selectedGroupId) {
    const group = groups.find(g => g.id === selectedGroupId)
    if (group) {
      return (
        <GroupDetail
          users={users}
          group={group}
          expenses={expenses.filter(e => e.groupId === group.id)}
          currentUserId={currentUserId}
          onBack={() => onSelectGroup(null)}
          onEditExpense={onEditExpense}
          onRemoveExpense={onRemoveExpense}
          groupDebts={getGroupSimplifiedDebts(group)}
        />
      )
    }
  }

  const groupForm = (onSubmit: () => void, submitLabel: string) => (
    <div className="space-y-4">
      <Input
        label="Group Name"
        value={formName}
        onChange={e => setFormName(e.target.value)}
        placeholder="e.g., Weekend Trip"
      />

      <div>
        <label className="block text-sm font-medium text-charcoal-light mb-2">Icon</label>
        <div className="flex flex-wrap gap-2">
          {emojiOptions.map(emoji => (
            <button
              key={emoji}
              onClick={() => setFormEmoji(emoji)}
              className={`text-2xl p-2 rounded-lg transition-colors ${
                formEmoji === emoji ? 'bg-teal-light ring-2 ring-teal' : 'hover:bg-gray-100'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal-light mb-1.5">Group Currency</label>
        <select
          value={formCurrency}
          onChange={e => setFormCurrency(e.target.value as Currency)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/50"
        >
          {currencies.map(c => (
            <option key={c} value={c}>{currencySymbols[c]} {c}</option>
          ))}
        </select>
        <p className="text-xs text-charcoal-light mt-1">Balances in this group will be shown in this currency</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal-light mb-2">Members</label>
        <div className="space-y-2">
          {friends.map(friend => (
            <div key={friend.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={formMembers.includes(friend.id)}
                  onChange={() => toggleMember(friend.id)}
                  className="w-4 h-4 rounded border-gray-300 text-teal focus:ring-teal"
                />
                <Avatar src={friend.avatar} name={friend.name} size="md" />
                <span className="text-sm font-medium text-charcoal">{friend.name}</span>
              </label>
              {formMembers.includes(friend.id) && (
                <select
                  value={formRoles[friend.id] ?? 'expense_only'}
                  onChange={e => setFormRoles(prev => ({ ...prev, [friend.id]: e.target.value as GroupRole }))}
                  className="text-xs px-2 py-1 rounded border border-gray-300 text-charcoal focus:outline-none focus:ring-1 focus:ring-teal/50"
                >
                  <option value="admin">Admin</option>
                  <option value="expense_only">Expenses only</option>
                </select>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-charcoal-light mt-1">Admin: full access. Expenses only: can only add expenses.</p>
      </div>

      <Button className="w-full" onClick={onSubmit} disabled={!formName.trim()}>
        {submitLabel}
      </Button>
    </div>
  )

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-charcoal">Groups</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus size={16} className="mr-1" /> New Group
        </Button>
      </div>

      {groups.map(group => {
        const balance = getGroupBalanceInCurrency(group)
        const memberCount = group.memberIds.length
        const isGroupAdmin = group.memberRoles[currentUserId] === 'admin'
        return (
          <Card
            key={group.id}
            className="p-4"
            onClick={() => onSelectGroup(group.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{group.emoji}</span>
                <div>
                  <p className="font-medium text-charcoal">{group.name}</p>
                  <p className="text-xs text-charcoal-light">{memberCount} members · {currencySymbols[group.currency]} {group.currency}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  {Math.abs(balance) < 0.01 ? (
                    <p className="text-sm text-charcoal-light">settled up</p>
                  ) : balance > 0 ? (
                    <>
                      <p className="text-xs text-charcoal-light">you are owed</p>
                      <p className="font-bold text-teal">{formatCurrency(balance, group.currency)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-charcoal-light">you owe</p>
                      <p className="font-bold text-danger">{formatCurrency(Math.abs(balance), group.currency)}</p>
                    </>
                  )}
                </div>
                {isGroupAdmin && (
                  <>
                    <button
                      onClick={(e) => openEdit(group, e)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Edit group"
                    >
                      <Pencil size={14} className="text-charcoal-light" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(group.id) }}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete group"
                    >
                      <Trash2 size={14} className="text-danger" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        )
      })}

      {groups.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-charcoal-light">No groups yet. Create one to get started!</p>
        </Card>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate} title="Create Group">
        {groupForm(handleCreate, 'Create Group')}
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)} title="Edit Group">
        {groupForm(handleEdit, 'Save Changes')}
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)} title="Delete Group">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Are you sure you want to delete <strong>{groups.find(g => g.id === confirmDelete)?.name}</strong>?
            Expenses will be kept but unlinked from this group.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
