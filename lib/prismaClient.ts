// lib/prismaClient.ts

import { PrismaClient } from "@prisma/client";

// In dev we keep a single Prisma instance on the global object
// to avoid "Too many Prisma clients" errors when hot-reloading.

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaClient =
  global.prisma ??
  new PrismaClient({
    log: ["query", "info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prismaClient;
}

// Default export so this works:
//   import prisma from "@/lib/prismaClient";
export default prismaClient;

// Named export as well, in case we ever write:
//   import { prisma } from "@/lib/prismaClient";
export { prismaClient as prisma };
