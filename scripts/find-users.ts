#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { PrismaClient } from '../lib/generated/prisma';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ take: 5, select: { email: true } });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}
main();
