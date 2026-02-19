import './configs/loadEnv.js';

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1); // Fail fast
});

import app from './app.js';
import redisClient from './configs/redisClient.js';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const PORT = process.env.PORT || 8000;

// Prisma setup
export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function startServer() {
  try {
    // Connect Redis
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('Redis connected');

    // Verify PostgreSQL connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('PostgreSQL connected');

    // Start HTTP server only after dependencies are ready
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1); // Fail fast
  }
}

startServer();
