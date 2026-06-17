import type { NextFunction, Request, Response } from "express";
import { UserRepository } from "../repositories/user.repository";
import { HttpError } from "../utils/http-error";
import { verifyToken } from "../utils/jwt";
import { assertIpAllowed, getClientIp } from "../utils/client-ip";

const userRepository = new UserRepository();

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpError(401, "Authorization token is missing.");
    }

    const token = authHeader.slice("Bearer ".length);
    const payload = verifyToken(token);

    const user = await userRepository.findById(payload.userId);
    if (!user) {
      throw new HttpError(401, "Invalid or expired token.");
    }

    assertIpAllowed(user, getClientIp(req));
    req.user = payload;

    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Invalid or expired token."));
  }
};
