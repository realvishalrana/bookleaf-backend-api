import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { Role } from "@prisma/client";
import { env } from "../../config/env";
import { verifyToken } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: [env.CORS_ORIGIN_AUTHOR, env.CORS_ORIGIN_ADMIN],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.headers.authorization as string)?.replace(
          "Bearer ",
          ""
        );
      if (!token) return next(new Error("Authentication required"));

      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, authorId: true, name: true },
      });
      if (!user) return next(new Error("User not found"));

      socket.data.user = user;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as {
      id: string;
      role: Role;
      authorId: string | null;
    };

    socket.on("join:author", () => {
      if (user.role === Role.AUTHOR && user.authorId) {
        socket.join(`author:${user.authorId}`);
      }
    });

    socket.on("join:ticket", async (ticketId: string) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { authorId: true },
      });
      if (!ticket) return;

      if (user.role === Role.ADMIN) {
        socket.join(`ticket:${ticketId}`);
      } else if (
        user.role === Role.AUTHOR &&
        user.authorId === ticket.authorId
      ) {
        socket.join(`ticket:${ticketId}`);
      }
    });
  });

  return io;
}

export function getIo(): Server | null {
  return io;
}

export function emitTicketMessage(
  ticketId: string,
  authorId: string,
  payload: unknown
): void {
  io?.to(`ticket:${ticketId}`).emit("ticket:message", payload);
  io?.to(`author:${authorId}`).emit("ticket:message", payload);
}

export function emitTicketUpdated(
  ticketId: string,
  authorId: string,
  payload: unknown
): void {
  io?.to(`ticket:${ticketId}`).emit("ticket:updated", payload);
  io?.to(`author:${authorId}`).emit("ticket:updated", payload);
}
