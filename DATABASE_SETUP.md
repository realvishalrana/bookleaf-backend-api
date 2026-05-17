# Database setup

## Option A — Docker (recommended, matches `.env` default)

1. **Start Docker Desktop** (must be running).
2. In `bookleaf-api`:

```bash
docker compose up -d
sleep 10
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Default URL (already in `.env`):

```env
DATABASE_URL="mysql://root:password@localhost:3306/bookleaf"
```

---

## Option B — Your own MySQL (Homebrew, MAMP, etc.)

1. Create the database:

```sql
CREATE DATABASE IF NOT EXISTS bookleaf;
```

2. Update **`bookleaf-api/.env`** with **your** username and password:

```env
# No password (some local installs):
DATABASE_URL="mysql://root@localhost:3306/bookleaf"

# With password:
DATABASE_URL="mysql://root:YOUR_REAL_PASSWORD@localhost:3306/bookleaf"
```

3. Run migrations and seed:

```bash
cd bookleaf-api
npx prisma migrate deploy
npm run db:seed
npm run dev
```

---

## Verify connection

```bash
npm run db:check
```

If this fails, fix `DATABASE_URL` in `.env` and restart `npm run dev`.
