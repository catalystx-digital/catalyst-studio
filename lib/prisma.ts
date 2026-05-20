import { PrismaClient } from '@/lib/generated/prisma';
import { withAccelerate } from '@prisma/extension-accelerate';

// Query logging for Accelerate quota debugging
// Set PRISMA_QUERY_LOG=true in Vercel env to enable detailed query logging
const ENABLE_QUERY_LOG = process.env.PRISMA_QUERY_LOG === 'true';

// Query counter for monitoring
let queryCount = 0;
const queryCountByModel: Record<string, number> = {};

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
      queryCount++;

      // Extract model name from query
      const modelMatch = e.query.match(/FROM\s+"?(\w+)"?/i) || e.query.match(/INTO\s+"?(\w+)"?/i);
      const model = modelMatch?.[1] || 'unknown';
      queryCountByModel[model] = (queryCountByModel[model] || 0) + 1;

      // Capture stack trace to identify caller
      const stack = new Error().stack?.split('\n').slice(3, 10).join('\n') || 'unknown';

      console.log(JSON.stringify({
        type: 'PRISMA_QUERY',
        queryNum: queryCount,
        model,
        query: e.query.substring(0, 200),
        duration: e.duration,
        timestamp: new Date().toISOString(),
        stack: stack.substring(0, 500),
      }));

      // Log summary every 100 queries
      if (queryCount % 100 === 0) {
        console.log(JSON.stringify({
          type: 'PRISMA_QUERY_SUMMARY',
          totalQueries: queryCount,
          byModel: queryCountByModel,
          timestamp: new Date().toISOString(),
        }));
      }
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
