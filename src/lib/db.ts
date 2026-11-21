import { PrismaClient } from "@prisma/client";

// מופע יחיד בפיתוח, כדי ש-hot reload לא יפתח חיבורים חדשים בכל שינוי
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
