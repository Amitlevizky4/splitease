# SplitEase - Complete Rebuild Prompt

Use the following prompt with an LLM to rebuild this application from scratch:

---

Build a complete Splitwise-like expense-sharing web application called **SplitEase** using the following exact tech stack and specifications.

## Tech Stack

- **React 19** + **TypeScript** + **Vite 5** (NOT Vite 6 — use `vite@5` and `@vitejs/plugin-react@4`)
- **Tailwind CSS v3** with PostCSS (NOT v4 / `@tailwindcss/vite`) — use `@tailwind base/components/utilities` directives
- **Radix UI** (`@radix-ui/react-dialog`) for dialog primitives
- **Lucide React** for icons
- **@react-oauth/google** for Google authentication
- **clsx** + **tailwind-merge** for className merging
- **class-variance-authority** for component variants
- Path alias: `@/` maps to `./src/` via both Vite `resolve.alias` and `tsconfig.app.json` paths

## Color Theme

Custom Tailwind colors:
- `teal`: `#1CC29F` (primary), `teal-light`: `#e6f9f4`, `teal-dark`: `#15a085`
- `charcoal`: `#2d3436` (text), `charcoal-light`: `#636e72`
- `danger`: `#e74c3c`, `danger-light`: `#fde8e6`

## Authentication

- Google OAuth login using `@react-oauth/google` with `GoogleOAuthProvider` wrapping the app in `main.tsx`
- Google Client ID read from `import.meta.env.VITE_GOOGLE_CLIENT_ID`
- Auth context split into 3 files to satisfy `react-refresh/only-export-components` lint rule:
  - `src/contexts/authTypes.ts` — exports `AuthContextType` interface and `AuthContext = createContext<AuthContextType | null>(null)`
  - `src/contexts/AuthContext.tsx` — exports `AuthProvider` component (decodes Google JWT credential to extract `sub`, `name`, `email`, `picture`; persists to `localStorage` under key `splitease_auth_user`; user ID format: `google-{sub}`)
  - `src/hooks/useAuth.ts` — exports `useAuth()` hook
- Login page shows Google sign-in button; app is gated behind authentication
- Sign Out button in Account page calls `logout()` which clears localStorage and resets state
- The authenticated user's Google profile picture URL is stored in the `avatar` field of the User type

## Avatar Component

Since avatars can be either emoji strings (`'👤'`) or Google profile picture URLs (`'https://...'`), create a reusable `Avatar` component (`src/components/ui/Avatar.tsx`):
- Props: `src: string`, `name?: string`, `size?: 'sm' | 'md' | 'lg' | 'xl'`
- If `src.startsWith('http')` → render `<img>` with `rounded-full`, `referrerPolicy="no-referrer"`
- Otherwise → render `<span>` with the emoji
- Size classes: `sm` = `w-5 h-5` / `text-lg`, `md` = `w-8 h-8` / `text-xl`, `lg` = `w-10 h-10` / `text-3xl`, `xl` = `w-16 h-16` / `text-5xl`
- Use this component everywhere avatars are displayed (friend lists, group members, smart settle, dashboard balances, settle up dialog, etc.)

## Types (`src/types.ts`)

```typescript
User { id, name, avatar, email }
SplitMethod = 'equal' | 'exact' | 'percentage'
Category = 'food' | 'rent' | 'travel' | 'entertainment' | 'utilities' | 'shopping' | 'other'
Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'ILS' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'INR'
ExpenseSplit { userId, amount }
Expense { id, description, amount, currency, category, date: Date, paidBy, splits: ExpenseSplit[], splitMethod, groupId? }
GroupRole = 'admin' | 'expense_only'
Group { id, name, emoji, memberIds: string[], memberRoles: Record<string, GroupRole>, currency }
Payment { id, fromUserId, toUserId, amount, currency, date: Date, groupId? }
ActivityItem { id, type: 'expense' | 'payment' | 'group_created' | 'settle_all', description, amount?, currency?, date: Date, relatedUsers: string[], groupId? }
Balance { userId, amount } // positive = they owe you, negative = you owe them, in USD
```

## Utility Functions (`src/lib/utils.ts`)

- `cn()` using clsx + tailwind-merge
- Static `exchangeRates` record (USD=1, EUR=0.92, GBP=0.79, JPY=149.5, ILS=3.65, CAD=1.36, AUD=1.53, CHF=0.88, CNY=7.24, INR=83.1)
- `currencySymbols` and `currencyLabels` records
- `convertToUSD(amount, fromCurrency)`, `convertFromUSD(amountUSD, toCurrency)`, `convertCurrency(amount, from, to)`
- `formatCurrency(amount, currency)` using `Intl.NumberFormat` (0 decimals for JPY)
- `formatDate(date)` using `Intl.DateTimeFormat`

## State Management (`src/store/useStore.ts`)

A custom hook `useStore(authUserId?: string)` using `useState`, `useMemo`, `useCallback`. The `CURRENT_USER_ID` is derived from `authUserId` or defaults to `'user-1'`. **Important**: include `CURRENT_USER_ID` in all dependency arrays that reference it.

When `authUserId` is provided and not found in the initial users list, load the auth user from localStorage and replace the default `user-1`.

### State
- `users`, `expenses`, `groups`, `payments`, `activities` — all initialized from mock data

### Computed (useMemo)
- `balances` — net balances in USD between current user and all others (from expenses + payments)
- `simplifiedDebts` — greedy algorithm: build net balances for all users, split into creditors/debtors sorted by amount, greedily match transfers
- `totalBalance`, `totalOwed`, `totalOwe` — derived from balances

### CRUD (useCallback)
- **Friends**: `addFriend`, `editFriend`, `removeFriend` (also removes from groups)
- **Expenses**: `addExpense`, `editExpense`, `removeExpense` — each logs an ActivityItem
- **Groups**: `addGroup`, `editGroup`, `removeGroup` (unlinks expenses, keeps them)
- **Settle**: `settleUp(toUserId, amount, currency)`, `settleAll()` — creates payments for all simplified debts involving current user

### Group-specific
- `getGroupSimplifiedDebts(group)` — same greedy algorithm but scoped to group expenses/payments, computed in group currency, returns `{ from, to, amount, explanation: string[] }` with detailed breakdown lines
- `getGroupBalanceInCurrency(group)` — current user's net balance in the group's currency

## Mock Data (`src/data/mockData.ts`)

- 6 users (user-1 through user-6) with emoji avatars
- 3 groups: "Apartment 4B" (USD), "Trip to Japan" (JPY), "Friday Dinners" (USD) — each with `memberRoles` (user-1 always admin)
- 8 expenses across groups (some in JPY, some in USD), various categories
- 2 payments (one in USD, one in JPY)
- 11 activity items
- `categoryIcons` record and `avatarOptions` array

## UI Components

### Base UI (`src/components/ui/`)
- **Card** — white rounded-xl with border/shadow, optional onClick with hover effect
- **Button** — variants: primary (teal), secondary (gray), ghost (transparent), danger (red); sizes: sm/md/lg; disabled state
- **Dialog** — wraps Radix Dialog with overlay, mobile bottom-sheet style (rounded-t-2xl, slides up), desktop centered modal
- **Input** — labeled input with focus ring styling
- **Avatar** — handles both emoji and URL avatars (described above)

### Layout (`src/App.tsx`)
- Shows `LoginPage` when not authenticated
- When authenticated, renders `AuthenticatedApp` with the auth user's ID
- Sticky teal header with "SplitEase" title and "Settle Up" button
- Bottom tab navigation: Home, Friends, Groups, Activity, Account (lucide icons: LayoutDashboard, Users, UsersRound, Activity, User)
- FAB (floating action button) for adding expenses — fixed position, teal circle with `+`
- When on a group detail page, the FAB auto-targets that group (passes `preselectedGroupId`)
- Tab switching clears `selectedFriend` / `selectedGroupId` as appropriate

### Dashboard
- 3-card grid: Total Balance, You Are Owed, You Owe (with TrendingUp/TrendingDown/Wallet icons)
- Balances by Friend list (clickable, navigates to friend detail)
- Simplified Debts section with "Settle All" button
- Uses Avatar component for all user displays

### Friends View
- Friend list with balance display (owes you / you owe / settled up)
- Add/Edit/Remove friend dialogs (name, email, emoji avatar picker)
- Click friend → navigates to FriendDetail

### Friend Detail
- Shows friend avatar, name, email, balance (in USD)
- "Settle Up" button when you owe them
- Shared expenses list with edit/delete per expense
- Shared payments list

### Groups View
- Group list cards with emoji, name, member count, currency, balance
- Edit/Delete buttons only visible to group admins
- Create/Edit group dialog with: name, emoji picker (12 options), currency selector, member checkboxes with per-member role dropdown (Admin / Expenses only)
- Group creator is always admin; new members default to `expense_only`
- Click group → navigates to GroupDetail

### Group Detail
- Group header with emoji, name, currency, member badges (showing Avatar + name + "admin" label for admins)
- **Smart Settle section**: shows optimized payments with expandable calculation breakdown tooltip per debt (Info icon toggles explanation panel showing raw debts, net balances, and simplified result)
- "All settled up" message when no debts but has expenses
- Expense list sorted by date descending, showing paid by, amount in group currency (with original currency if different), and net for current user (lent/borrowed)
- Edit/Delete expense buttons only visible to admin users (`group.memberRoles[currentUserId] === 'admin'`)

### Add Expense Dialog
- Uses key-based remount pattern: outer component renders inner with `key={editingExpense?.id ?? preselectedGroupId ?? 'new'}` to avoid setState-in-useEffect
- `getInitialState()` computes initial form values based on editing expense or preselected group
- Fields: description, amount + currency selector, category pills (with emoji icons), date picker
- **Paid by selector**: dropdown showing "You" + selected friends who are part of the split
- **Group selector**: optional, when selected auto-sets currency and members
- **Split with**: checkboxes — when a group is selected, only shows group members (not all friends)
- **Split method**: Equal (shows per-person amount), Exact (input per person), Percentage (input per person)
- Submit creates or edits expense

### Settle Up Dialog
- Shows friends you owe (negative balances)
- Click to select, auto-fills converted amount
- Currency selector with auto-conversion from USD balance
- "Record Payment" button

### Activity View
- Chronological list with type icons (Receipt, CreditCard, Users, CheckCircle2)
- Shows description, date, and amount

### Account View
- Shows authenticated user's Google profile picture (using Avatar component), name, email
- Balance summary grid (balance, owed, owe)
- Menu items: Settings, Notifications, Help & Support, Sign Out (Sign Out calls `logout()`)

## CSS Animations

In `src/index.css`:
- `animate-fade-in`: fadeIn 0.3s (opacity 0→1, translateY 8px→0)
- `animate-slide-up`: slideUp 0.3s (opacity 0→1, translateY 100%→0)

## Environment

- `.env` file with `VITE_GOOGLE_CLIENT_ID=<your-client-id>`
- Ensure the Google Cloud Console has `http://localhost:5173` as an authorized JavaScript origin

## Key Implementation Notes

1. All balances are internally computed in USD, then converted for display when needed
2. The greedy debt simplification algorithm: compute net balances → split into creditors/debtors → sort both descending → greedily match (transfer min of both amounts)
3. Use `react-refresh/only-export-components` compatible file structure — don't export React context and components from the same file
4. The AddExpenseDialog uses a key-based remount pattern instead of useEffect to populate form state, avoiding the `react-hooks/set-state-in-effect` lint violation
5. `allParticipants` in AddExpenseDialog is `[...new Set([currentUserId, paidBy, ...selectedFriends])]` to handle when someone other than the current user pays
6. Group permissions: `admin` = full access (edit/delete expenses, edit group), `expense_only` = can only view and add expenses
