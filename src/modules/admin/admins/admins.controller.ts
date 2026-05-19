import { Request, Response, NextFunction } from "express";
import { adminsService } from "./admins.service";

export const adminsController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminsService.list();
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
};
