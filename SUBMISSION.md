# BookLeaf Assignment Submission

## Architecture

Three private repositories:

| Repo | URL (local) | Purpose |
|------|-------------|---------|
| bookleaf-api | http://localhost:4000 | Express REST + Socket.io + AI |
| bookleaf-author-portal | http://localhost:3000 | Author UI |
| bookleaf-admin-portal | http://localhost:3001 | Admin UI |

## Run locally

### 1. Database

```bash
cd bookleaf-api
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

### 2. Frontends

```bash
cd bookleaf-author-portal && npm install && npm run dev
cd bookleaf-admin-portal && npm install && npm run dev
```

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bookleaf.internal | BookLeaf@2025 |
| Author | priya.sharma@email.com | BookLeaf@2025 |

All seeded authors use `BookLeaf@2025`.

## API documentation

Swagger UI: http://localhost:4000/api/docs  
OpenAPI JSON: http://localhost:4000/api/docs.json

## AI integration

- **Models:** `gpt-4o-mini` for classification/priority; `gpt-4o` for draft replies
- **Security:** `OPENAI_API_KEY` only in API `.env` — never exposed to frontends
- **Token strategy:** Triage uses subject+description only; drafts use 2 KB sections by category + last 2 messages
- **Degradation:** Tickets create without AI; admins can reply manually; `aiLastError` surfaced in UI

Set `OPENAI_API_KEY` in `bookleaf-api/.env` to enable AI features.

## Real-time

Socket.io on the API server. Authors join `author:{authorId}` and `ticket:{ticketId}` rooms. Events: `ticket:message`, `ticket:updated`. Polling fallback every 10s on ticket detail.

## Deployment (suggested)

| Service | Host |
|---------|------|
| API | Railway / EC2 (WebSockets enabled; SQLite file on disk) |
| Author app | Vercel |
| Admin app | Vercel (separate project) |

Configure `CORS_ORIGIN_*` and `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` on each host.

## Live demo

_Add your deployed URLs here after deployment:_

- Author portal: `TBD`
- Admin portal: `TBD`
- API: `TBD`

## Known limitations

- File attachment is UI-only (per assignment)
- KB retrieval uses category→section mapping (no vector DB)
- SQLite is file-based; back up `prisma/*.db` on production servers
