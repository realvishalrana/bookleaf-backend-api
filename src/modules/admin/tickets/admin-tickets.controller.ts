import { Request, Response, NextFunction } from "express";
import {
  BadRequestError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../../shared/lib/errors";
import { paramId } from "../../../shared/utils/params";
import { adminTicketsService } from "./admin-tickets.service";
import type {
  AdminTicketListQuery,
  MessageInput,
  NoteInput,
  PatchTicketInput,
} from "./admin-tickets.schema";

export const adminTicketsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminTicketsService.list(
        req.query as unknown as AdminTicketListQuery
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminTicketsService.getById(paramId(req));
      res.json(result);
    } catch (e) {
      if (e instanceof NotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      next(e);
    }
  },

  async patch(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminTicketsService.patch(
        paramId(req),
        req.body as PatchTicketInput
      );
      res.json(result);
    } catch (e) {
      if (e instanceof BadRequestError) {
        res.status(400).json({ error: e.message });
        return;
      }
      next(e);
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminTicketsService.sendMessage(
        paramId(req),
        req.user!.id,
        req.body as MessageInput
      );
      res.status(201).json(result);
    } catch (e) {
      if (e instanceof NotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      next(e);
    }
  },

  async addNote(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminTicketsService.addNote(
        paramId(req),
        req.user!.id,
        req.body as NoteInput
      );
      res.status(201).json(result);
    } catch (e) {
      if (e instanceof NotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      next(e);
    }
  },

  async regenerateDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminTicketsService.regenerateDraft(paramId(req));
      res.json(result);
    } catch (e) {
      if (e instanceof NotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      if (e instanceof ServiceUnavailableError) {
        res.status(503).json({
          error: "AI unavailable",
          message: e.message,
        });
        return;
      }
      next(e);
    }
  },

  async getDuplicates(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminTicketsService.getDuplicates(paramId(req));
      res.json(result);
    } catch (e) {
      if (e instanceof NotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      next(e);
    }
  },

  async summarise(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminTicketsService.summarise(paramId(req));
      res.json(result);
    } catch (e) {
      if (e instanceof NotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      if (e instanceof ServiceUnavailableError) {
        res.status(503).json({
          error: "AI unavailable",
          message: e.message,
        });
        return;
      }
      next(e);
    }
  },
};
