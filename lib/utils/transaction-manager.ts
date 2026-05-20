import type { PrismaClient } from '@/lib/generated/prisma';
import { prisma } from '@/lib/prisma';

/**
 * Execute a function within a Prisma transaction
 * @param fn The function to execute within the transaction
 * @returns The result of the function
 */
export async function withTransaction<T>(
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    return await fn(tx);
  });
}