import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ||
  new PrismaClient({
    log:
      process.env.NODE_ENV !== 'production'
        ? ['query', 'error', 'warn']
        : ['error', 'warn']
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}