import { Request, Response, NextFunction } from "express";
import { NotFoundError, BadRequestError } from "../../../shared/lib/errors";
import { paramId } from "../../../shared/utils/params";
import { authorTicketsService } from "./author-tickets.service";
import type { CreateTicketInput, TicketListQuery } from "./author-tickets.schema";

export const authorTicketsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authorTicketsService.list(
        req.user!.authorId!,
        req.query as unknown as TicketListQuery
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authorTicketsService.getById(
        paramId(req),
        req.user!.authorId!
      );
      res.json(result);
    } catch (e) {
      if (e instanceof NotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const attachment = req.file
        ? {
            url: `/uploads/${req.file.filename}`,
            name: req.file.originalname,
          }
        : undefined;

      const result = await authorTicketsService.create(
        req.user!.authorId!,
        req.body as CreateTicketInput,
        attachment
      );
      res.status(201).json(result);
    } catch (e) {
      if (e instanceof BadRequestError) {
        res.status(400).json({ error: e.message });
        return;
      }
      next(e);
    }
  },
};
