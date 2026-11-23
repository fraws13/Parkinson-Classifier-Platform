import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

export function createDb(url = process.env.DATABASE_URL || 'file:./prisma/dev.db') {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
