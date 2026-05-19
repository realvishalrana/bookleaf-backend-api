import { Role } from "@prisma/client";
import { prisma } from "../../../shared/lib/prisma";

export const adminsRepository = {
  findAll() {
    return prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true, name: true, email: true },
    });
  },

  findAdminById(id: string) {
    return prisma.user.findFirst({
      where: { id, role: Role.ADMIN },
    });
  },
};
