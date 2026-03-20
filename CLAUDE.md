# SplitEase - Project Guide

## What is this?

SplitEase is a full-stack Splitwise clone for splitting expenses with friends. Users sign in with Google, create groups, add expenses, and settle debts.

## Live URLs

- **Frontend**: https://splitease-inky.vercel.app (Vercel)
- **Backend**: https://splitease-e9ze.onrender.com (Render, free tier)
- **Database**: PostgreSQL on Neon
- **GitHub**: https://github.com/Amitlevizky4/splitease

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 5, Tailwind CSS 3 |
| UI | Radix UI primitives, Lucide icons, custom Card/Button/Dialog/Input/Avatar |
| Auth | Google OAuth (@react-oauth/google), JWT sessions |
| Backend | Express 5, TypeScript |
| ORM | Prisma 6.9 |
| Database | PostgreSQL (Neon) |
| Email | Resend (limited to testing domain - only sends to account owner) |
| Deployment | Vercel (frontend), Render (backend) |

## Local Development

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Run both frontend and backend concurrently
npm run dev:all

# Or separately:
npm run dev          # Frontend on :5173
npm run dev:server   # Backend on :3001
```

Vite proxies `/api` requests to `localhost:3001` in dev mode.

## Deployment

```bash
# Frontend (Vercel) - build locally then deploy
vercel build --prod && vercel deploy --prebuilt --prod

# Backend (Render) - auto-deploys from GitHub push
git push origin main
```

### Environment Variables

**Frontend** (`.env`, also set in Vercel):
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID

**Backend** (`server/.env`, also set in Render):
- `DATABASE_URL` - Neon PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (required in production)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (same as frontend)
- `RESEND_API_KEY` - Resend email API key
- `ALLOWED_ORIGINS` - Comma-separated CORS origins
- `APP_URL` - Frontend URL (for invite links)
- `RENDER_EXTERNAL_URL` - Backend URL (for keep-alive self-ping)

## Project Structure

```
src/
  App.tsx                    # Root component, tab routing, invite URL detection
  main.tsx                   # Entry point, GoogleOAuthProvider + AuthProvider
  types.ts                   # All TypeScript types
  contexts/AuthContext.tsx    # Auth state, login/logout, token management
  store/useStore.ts          # Central state: data fetching, CRUD, balance computation
  lib/api.ts                 # API client (all endpoints)
  lib/utils.ts               # Currency conversion, formatting helpers
  components/
    LoginPage.tsx            # Google sign-in (warms up backend on mount)
    InvitePage.tsx            # /invite/:token page for new users
    Dashboard.tsx             # Home tab: balances, simplified debts, settle all
    FriendsView.tsx           # Friends list, add/invite friend with shareable link
    FriendDetail.tsx          # Friend expenses, settle up
    GroupsView.tsx            # Groups list, create/edit/delete groups
    GroupDetail.tsx            # Group expenses, smart settle, import from Splitwise
    ImportExpensesDialog.tsx   # CSV import with name mapping
    AddExpenseDialog.tsx       # Add/edit expense form
    SettleUpDialog.tsx         # Settle up payment dialog
    ActivityView.tsx           # Activity timeline
    AccountView.tsx            # Profile, sign out
    ui/                        # Base components: Card, Button, Dialog, Input, Avatar

server/
  src/index.ts               # Express app, CORS, rate limiting, keep-alive
  src/middleware/auth.ts      # JWT verification middleware
  src/routes/
    auth.ts                  # POST /api/auth/google, GET /api/auth/me
    data.ts                  # GET /api/data (all user data in one call)
    friends.ts               # POST/DELETE /api/friends
    groups.ts                # CRUD /api/groups
    expenses.ts              # CRUD /api/expenses
    payments.ts              # POST /api/payments, POST /api/payments/settle-all
    invitations.ts           # POST /api/invitations, GET /api/invitations/info/:token, POST /api/invitations/accept
    import.ts                # POST /api/import/splitwise (bulk CSV import)
  src/services/email.ts      # Resend email service
  prisma/schema.prisma       # Database schema
```

## Database Models (Prisma)

- **User** - Google ID as primary key (`google-{sub}`), name, email, avatar
- **Friendship** - Bidirectional (two rows per friendship), unique on `[userId, friendId]`
- **Group** - name, emoji, currency
- **GroupMember** - userId + groupId + role (`admin` | `expense_only`)
- **Expense** - description, amount, currency, category, date, paidBy, splitMethod, groupId?
- **ExpenseSplit** - expenseId + userId + amount
- **Payment** - fromUserId, toUserId, amount, currency, date, groupId?
- **Activity** - type, description, date, related users
- **Invitation** - email, inviterId, token, status (`pending` | `accepted`), groupId?

## Key Architecture Decisions

### Authentication
- Google OAuth verified server-side via `google-auth-library`
- JWT tokens (30-day expiry) stored in localStorage
- Fallback dev secret for local development only

### Data Flow
- Single `/api/data` endpoint returns all user data (users, groups, expenses, payments, activities, friendIds)
- Frontend `useStore` hook manages all state and CRUD operations
- All mutations call API then `refreshData()` to sync state

### Balance Computation
- All internal calculations in USD using static exchange rates
- Greedy algorithm for simplified debt optimization
- Group balances computed in group's currency

### Friend Invitations
- If email exists in DB: add as friend immediately
- If not: create invitation with unique token, return shareable link (`/invite/:token`)
- Invited user sees personalized invite page, signs in with Google, auto-added as friend
- Already-logged-in users who open an invite link auto-accept it

### Security
- Rate limiting: 100 req/min global, 10/min for auth
- CORS with strict origin validation
- Input validation on all endpoints
- Authorization checks (expense edit requires being payer, participant, or group admin)
- Settle-all only allows payments where `fromUserId === currentUser`
- All destructive actions have confirmation dialogs

### Performance
- Backend self-pings every 14 min to prevent Render cold starts
- Login page warms up backend on mount
- CSV import uses Prisma transaction for batch operations
- Expenses ordered by `[date desc, createdAt desc]`

## Tailwind Custom Colors

```
teal: #1CC29F (light: #e6f9f4, dark: #15a085)
charcoal: #2d3436 (light: #636e72)
danger: #e74c3c (light: #fde8e6)
```

## Supported Currencies

USD, EUR, GBP, JPY, ILS, CAD, AUD, CHF, CNY, INR (static exchange rates in `lib/utils.ts`)

## Known Limitations

- **Resend email**: Using `onboarding@resend.dev` testing domain - can only send to account owner's email. Need a verified custom domain to send to other recipients. Invite links work as the primary mechanism regardless.
- **Render cold starts**: Free tier spins down after inactivity. Keep-alive ping mitigates but first request after long idle may still be slow.
- **Static exchange rates**: Currency conversion uses hardcoded rates, not live rates.
- **No router library**: URL routing is manual (`window.location.pathname` matching for `/invite/:token`).

## Common Tasks

### Add a new API endpoint
1. Create route in `server/src/routes/`
2. Register in `server/src/index.ts`
3. Add API function in `src/lib/api.ts`
4. Call from `src/store/useStore.ts` or component

### Modify database schema
1. Edit `server/prisma/schema.prisma`
2. Run `cd server && npx prisma db push` (dev) or `npx prisma migrate dev` (with migration)
3. Prisma client auto-regenerates

### Deploy changes
1. `git add && git commit && git push origin main` (triggers Render backend deploy)
2. `vercel build --prod && vercel deploy --prebuilt --prod` (Vercel frontend deploy)
