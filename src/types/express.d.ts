import { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  authorId: string | null;
  name: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
