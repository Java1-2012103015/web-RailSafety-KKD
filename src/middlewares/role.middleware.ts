import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role) {
      next(new HttpError(401, "Unauthorized."));
      return;
    }

    if (!allowedRoles.includes(role)) {
      next(new HttpError(403, "Forbidden: insufficient role."));
      return;
    }

    next();
  };
};
