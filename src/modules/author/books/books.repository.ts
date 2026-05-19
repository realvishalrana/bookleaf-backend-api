import { prisma } from "../../../shared/lib/prisma";

export const booksRepository = {
  findByAuthorId(authorId: string) {
    return prisma.book.findMany({
      where: { authorId },
      orderBy: { title: "asc" },
    });
  },

  findByIdForAuthor(bookId: string, authorId: string) {
    return prisma.book.findFirst({
      where: { id: bookId, authorId },
    });
  },
};
