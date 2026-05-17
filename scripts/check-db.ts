import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  const count = await prisma.user.count();
  console.log("Database OK. Users in DB:", count);
  if (count === 0) {
    console.log("Run: npm run db:seed");
  }
}

main()
  .catch((e) => {
    console.error("Database connection failed:");
    console.error(e.message);
    console.error("\nSee DATABASE_SETUP.md — fix DATABASE_URL in .env");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
