import { booksRepository } from "./books.repository";

function formatBook(b: {
  id: string;
  title: string;
  isbn: string | null;
  genre: string | null;
  publicationDate: Date | null;
  status: string;
  mrp: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: unknown;
  royaltyPaid: unknown;
  royaltyPending: unknown;
}) {
  return {
    bookId: b.id,
    title: b.title,
    isbn: b.isbn,
    genre: b.genre,
    publicationDate: b.publicationDate,
    status: b.status,
    mrp: b.mrp,
    totalCopiesSold: b.totalCopiesSold,
    totalRoyaltyEarned: Number(b.totalRoyaltyEarned),
    royaltyPaid: Number(b.royaltyPaid),
    royaltyPending: Number(b.royaltyPending),
  };
}

export const booksService = {
  async listForAuthor(authorId: string) {
    const books = await booksRepository.findByAuthorId(authorId);
    return { books: books.map(formatBook) };
  },
};
