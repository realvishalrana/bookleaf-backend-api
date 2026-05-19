import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../../shared/lib/errors";
import { authService } from "./auth.service";

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        res.status(401).json({ error: e.message });
        return;
      }
      next(e);
    }
  },

  me(req: Request, res: Response) {
    res.json({ user: req.user });
  },
};
