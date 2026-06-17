import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Keep server-side trace for debugging unexpected upload failures.
  // eslint-disable-next-line no-console
  console.error(error);

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: string }).type === "entity.too.large"
  ) {
    res.status(413).json({ message: "업로드 파일이 너무 큽니다. 파일 크기를 줄이거나 나눠서 업로드해 주세요." });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  res.status(500).json({ message: "Internal server error." });
};
