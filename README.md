# SplitEase

A full-stack expense-sharing app (Splitwise clone) built with React, Express, and PostgreSQL.

**Live**: https://splitease-inky.vercel.app

## Features

- Google OAuth sign-in
- Create groups with custom emoji, currency, and member roles
- Add expenses with multiple split methods (equal, exact, percentage)
- Multi-currency support (USD, EUR, GBP, JPY, ILS, and more)
- Smart debt simplification algorithm
- Settle up with friends
- Invite friends via shareable links
- Import expenses from Splitwise CSV exports
- Activity timeline
- Mobile-first responsive design

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Radix UI
- **Backend**: Express 5, Prisma, PostgreSQL (Neon)
- **Auth**: Google OAuth + JWT
- **Deployment**: Vercel (frontend) + Render (backend)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (or Neon account)
- Google OAuth client ID

### Setup

```bash
# Clone the repo
git clone https://github.com/Amitlevizky4/splitease.git
cd splitease

# Install dependencies
npm install
cd server && npm install && cd ..

# Set up environment variables
cp .env.example .env          # Add VITE_GOOGLE_CLIENT_ID
cp server/.env.example server/.env  # Add DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID

# Push database schema
cd server && npx prisma db push && cd ..

# Run development servers
npm run dev:all
```

Frontend runs on http://localhost:5173, backend on http://localhost:3001.

## Project Structure

```
src/           # React frontend (components, store, API client)
server/        # Express backend (routes, middleware, Prisma)
```

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.
