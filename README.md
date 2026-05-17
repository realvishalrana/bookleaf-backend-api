# BookLeaf API

Express + TypeScript + MySQL + Prisma backend for the Author Support Portal.

## Prerequisites

- Node.js 18+
- Docker (for MySQL) or local MySQL 8

## Setup

```bash
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET

docker compose up -d
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

API: http://localhost:4000  
Swagger: http://localhost:4000/api/docs

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
2. Copy your API key from Antigravity settings (often `sk-antigravity` or a regenerated key).
3. In `.env`:

```env
OPENAI_API_KEY="your-antigravity-key"
OPENAI_BASE_URL="http://127.0.0.1:8045/v1"
OPENAI_CLASSIFY_MODEL="gemini-3-flash"
OPENAI_DRAFT_MODEL="gemini-3-flash"
```

Use model names that your Antigravity proxy exposes.

### Direct OpenAI

Leave `OPENAI_BASE_URL` empty and use your OpenAI key with `gpt-4o-mini` / `gpt-4o`.

## Socket.io

Connect with `auth: { token: "<jwt>" }`. Events: `ticket:message`, `ticket:updated`.  
Emit `join:author` and `join:ticket` with ticket id.
