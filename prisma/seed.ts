import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "BookLeaf@2025";

interface SampleBook {
  book_id: string;
  title: string;
  isbn: string | null;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}

interface SampleAuthor {
  author_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joined_date: string;
  books: SampleBook[];
}

async function main() {
  const dataPath = path.join(__dirname, "sample-data.json");
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as {
    authors: SampleAuthor[];
  };

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const a of raw.authors) {
    await prisma.author.upsert({
      where: { id: a.author_id },
      create: {
        id: a.author_id,
        name: a.name,
        email: a.email,
        phone: a.phone,
        city: a.city,
        joinedDate: new Date(a.joined_date),
      },
      update: {
        name: a.name,
        email: a.email,
        phone: a.phone,
        city: a.city,
        joinedDate: new Date(a.joined_date),
      },
    });

    for (const b of a.books) {
      await prisma.book.upsert({
        where: { id: b.book_id },
        create: {
          id: b.book_id,
          authorId: a.author_id,
          title: b.title,
          isbn: b.isbn,
          genre: b.genre,
          publicationDate: b.publication_date
            ? new Date(b.publication_date)
            : null,
          status: b.status,
          mrp: b.mrp,
          authorRoyaltyPerCopy: b.author_royalty_per_copy,
          totalCopiesSold: b.total_copies_sold,
          totalRoyaltyEarned: b.total_royalty_earned,
          royaltyPaid: b.royalty_paid,
          royaltyPending: b.royalty_pending,
          lastRoyaltyPayoutDate: b.last_royalty_payout_date
            ? new Date(b.last_royalty_payout_date)
            : null,
          printPartner: b.print_partner,
          availableOn: b.available_on,
        },
        update: {
          title: b.title,
          isbn: b.isbn,
          genre: b.genre,
          publicationDate: b.publication_date
            ? new Date(b.publication_date)
            : null,
          status: b.status,
          mrp: b.mrp,
          authorRoyaltyPerCopy: b.author_royalty_per_copy,
          totalCopiesSold: b.total_copies_sold,
          totalRoyaltyEarned: b.total_royalty_earned,
          royaltyPaid: b.royalty_paid,
          royaltyPending: b.royalty_pending,
          lastRoyaltyPayoutDate: b.last_royalty_payout_date
            ? new Date(b.last_royalty_payout_date)
            : null,
          printPartner: b.print_partner,
          availableOn: b.available_on,
        },
      });
    }

    await prisma.user.upsert({
      where: { email: a.email },
      create: {
        email: a.email,
        password: passwordHash,
        role: Role.AUTHOR,
        name: a.name,
        authorId: a.author_id,
      },
      update: {
        password: passwordHash,
        name: a.name,
        authorId: a.author_id,
        role: Role.AUTHOR,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: "admin@bookleaf.internal" },
    create: {
      email: "admin@bookleaf.internal",
      password: passwordHash,
      role: Role.ADMIN,
      name: "BookLeaf Admin",
    },
    update: {
      password: passwordHash,
      role: Role.ADMIN,
      name: "BookLeaf Admin",
    },
  });

  console.log("Seed complete. Default password:", DEFAULT_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
