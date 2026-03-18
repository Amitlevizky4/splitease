export interface User {
  id: string
  name: string
  avatar: string
  email: string
}

export type SplitMethod = 'equal' | 'exact' | 'percentage'

export type Category = 'food' | 'rent' | 'travel' | 'entertainment' | 'utilities' | 'shopping' | 'other'

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'ILS' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'INR'

export interface ExpenseSplit {
  userId: string
  amount: number
}

export interface Expense {
  id: string
  description: string
  amount: number
  currency: Currency
  category: Category
  date: Date
  paidBy: string
  splits: ExpenseSplit[]
  splitMethod: SplitMethod
  groupId?: string
}

export type GroupRole = 'admin' | 'expense_only'

export interface Group {
  id: string
  name: string
  emoji: string
  memberIds: string[]
  memberRoles: Record<string, GroupRole>
  currency: Currency
}

export interface Payment {
  id: string
  fromUserId: string
  toUserId: string
  amount: number
  currency: Currency
  date: Date
  groupId?: string
}

export interface ActivityItem {
  id: string
  type: 'expense' | 'payment' | 'group_created' | 'settle_all'
  description: string
  amount?: number
  currency?: Currency
  date: Date
  relatedUsers: string[]
  groupId?: string
}

export interface Balance {
  userId: string
  amount: number // positive = they owe you, negative = you owe them (in USD)
}
