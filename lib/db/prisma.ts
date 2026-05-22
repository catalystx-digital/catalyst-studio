import { PrismaClient } from '@/lib/generated/prisma';
import { withAccelerate } from '@prisma/extension-accelerate';

// Query logging for Accelerate quota debugging
// Set PRISMA_QUERY_LOG=true to enable detailed query logging
const ENABLE_QUERY_LOG = process.env.PRISMA_QUERY_LOG === 'true';

function createPrismaClient() {
  const client = new PrismaClient({
    log: ENABLE_QUERY_LOG
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : ['error', 'warn'],
  });

  if (ENABLE_QUERY_LOG) {
    client.$on('query', (e: { query: string; params: string; duration: number }) => {
      // Capture stack trace to identify caller
      const stack = new Error().stack?.split('\n').slice(3, 8).join('\n') || 'unknown';
      console.log('=== PRISMA QUERY ===');
      console.log(`Query: ${e.query}`);
      console.log(`Duration: ${e.duration}ms`);
      console.log(`Caller:\n${stack}`);
      console.log('====================');
    });
  }

  return client.$extends(withAccelerate());
}

// Export the extended client type for use in function signatures
export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
