# BookLeaf API

Express + TypeScript + Prisma backend for the Author Support Portal.

## Project structure

```
src/
├── app.ts                 # Express app composition
├── server.ts              # HTTP server + Socket.io bootstrap
├── config/                # env, Swagger
├── shared/                # cross-cutting concerns
│   ├── middleware/        # auth, validation, upload, errors
│   ├── lib/               # prisma, AppError types
│   ├── utils/
│   └── types/
├── infrastructure/        # external integrations
│   ├── ai/                # OpenAI triage, drafts, duplicates, summary
│   └── realtime/          # Socket.io
├── modules/               # feature slices (routes → controllers → services → repositories)
│   ├── auth/
│   ├── author/            # books, tickets
│   ├── admin/             # tickets, admins
│   └── health/
└── data/                  # knowledge base (copied to dist on build)
```

**Layer flow:** `routes` → `controllers` → `services` → `repositories` → Prisma

## Prerequisites

- Node.js 18+

## Setup

```bash
cp .env.example .env
# Edit JWT_SECRET and OPENAI_API_KEY if needed

npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for database details.

API: http://localhost:4000  
Swagger: http://localhost:4000/api/docs  
Health: http://localhost:4000/health

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bookleaf.internal | BookLeaf@2025 |
| Author | priya.sharma@email.com | BookLeaf@2025 |

All seeded authors use password `BookLeaf@2025`.

## AI

Set `OPENAI_API_KEY` in `.env`. Without it, tickets still work; classification and drafts are skipped.

### Using Antigravity Manager (OpenAI-compatible proxy)

1. Start Antigravity Manager and enable the API proxy (default `http://127.0.0.1:8045/v1`).
2. Copy your API key from Antigravity settings.
3. In `.env`:

```env
OPENAI_API_KEY="your-antigravity-key"
OPENAI_BASE_URL="http://127.0.0.1:8045/v1"
OPENAI_CLASSIFY_MODEL="gemini-3-flash"
OPENAI_DRAFT_MODEL="gemini-3-flash"
```

### Direct OpenAI

Leave `OPENAI_BASE_URL` empty and use your OpenAI key with `gpt-4o-mini` / `gpt-4o`.

## Socket.io

Connect with `auth: { token: "<jwt>" }`. Events: `ticket:message`, `ticket:updated`.  
Emit `join:author` and `join:ticket` with ticket id.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript + copy `data/` |
| `npm start` | Run production build |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Seed demo data |
