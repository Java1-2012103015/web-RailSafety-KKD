import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["DATABASE_URL", "JWT_SECRET"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin1234",
  adminPassword: process.env.ADMIN_PASSWORD ?? "1q2w3e4r!@#$",
  adminName: process.env.ADMIN_NAME ?? "System Admin",
};
