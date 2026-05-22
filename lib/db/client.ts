import { PrismaClient } from '../generated/prisma'
import { withAccelerate } from '@prisma/extension-accelerate'

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }).$extends(withAccelerate()) as unknown as PrismaClient
}

// Export a stable client type for use in function signatures
export type ExtendedPrismaClient = PrismaClient

// Singleton pattern for Prisma client
// This prevents multiple instances during hot reload in development
declare global {
  var prisma: ExtendedPrismaClient | undefined
}

/**
 * Returns a singleton instance of the Prisma client.
 * In production, creates a single instance.
 * In development, reuses existing instance to prevent connection pool exhaustion.
 */
export function getClient(): ExtendedPrismaClient {
  if (!global.prisma) {
    global.prisma = createPrismaClient()
  }
  return global.prisma
}

/**
 * Disconnects the Prisma client connection.
 * Useful for cleanup during hot reload or application shutdown.
 */
export async function disconnect(): Promise<void> {
  if (global.prisma) {
    await global.prisma.$disconnect()
    global.prisma = undefined
  }
}

// In development, prevent connection pool exhaustion during hot reload
if (process.env.NODE_ENV !== 'production') {
  if (global.prisma) {
    console.log('Reusing existing Prisma client instance')
  }
}

// Export a default client instance for convenience
export const prisma = getClient()
