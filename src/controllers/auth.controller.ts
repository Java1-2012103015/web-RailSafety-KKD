import type { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { HttpError } from "../utils/http-error";
import { ROLES, type RoleName } from "../constants/roles";
import { getClientIp } from "../utils/client-ip";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, name, role } = req.body as {
        email?: string;
        password?: string;
        name?: string;
        role?: RoleName;
      };

      if (!email || !password || !name) {
        throw new HttpError(400, "email, password, name are required.");
      }

      if (role && !Object.values(ROLES).includes(role)) {
        throw new HttpError(400, "Invalid role value.");
      }

      const result = await this.authService.register({ email, password, name, role });
      res.status(201).json({ message: "User registered successfully.", data: result });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };

      if (!email || !password) {
        throw new HttpError(400, "email and password are required.");
      }

      const result = await this.authService.login(
        { email, password },
        getClientIp(req),
        { userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null },
      );
      res.status(200).json({ message: "Login successful.", data: result });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
      }

      const user = await this.authService.getSession(req.user.userId);
      res.status(200).json({ message: "Session retrieved.", data: user });
    } catch (error) {
      next(error);
    }
  };
}
