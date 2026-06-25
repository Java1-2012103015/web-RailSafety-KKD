import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  userId: number;
  roleId: number;
  email: string;
  role: string;
}

export interface SelfReportJwtPayload {
  role: string;
  selfReportInstitutionId: number;
  selfReportStaffId?: number;
  selfReportTier: number;
  selfReportInstitutionName: string;
  selfReportStaffName?: string;
}

export const signToken = (payload: JwtPayload): string => {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, env.jwtSecret, options);
};

export const signSelfReportToken = (payload: SelfReportJwtPayload): string => {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign({ ...payload, tokenType: "self-report" }, env.jwtSecret, options);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
};

export const verifySelfReportToken = (token: string): SelfReportJwtPayload => {
  const payload = jwt.verify(token, env.jwtSecret) as SelfReportJwtPayload & { tokenType?: string };
  if (payload.tokenType !== "self-report") {
    throw new Error("Invalid self-report token.");
  }
  return payload;
};
