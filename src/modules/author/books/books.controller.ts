import { Request, Response, NextFunction } from "express";
import { booksService } from "./books.service";

export const booksController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await booksService.listForAuthor(req.user!.authorId!);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
};
