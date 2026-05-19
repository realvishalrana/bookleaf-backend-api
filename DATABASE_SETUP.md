# Database setup (SQLite)

The API uses **SQLite** via Prisma. No Docker or separate database server is required.

## Local setup

1. Copy env and install:

```bash
cp .env.example .env
npm install
```

2. Default `DATABASE_URL` in `.env`:

```env
DATABASE_URL="file:./prisma/dev.db"
```

3. Create schema and seed:

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Production (e.g. EC2)

Use a file path on the server, for example:

```env
DATABASE_URL="file:./prisma/prod.db"
```

Run migrations and seed once after deploy:

```bash
npx prisma migrate deploy
npm run db:seed
```

## Verify connection

```bash
npm run db:check
```

If this fails, fix `DATABASE_URL` in `.env` and restart `npm run dev`.
