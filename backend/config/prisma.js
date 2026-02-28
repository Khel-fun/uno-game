const { PrismaClient } = require('@prisma/client');

let prisma = global.__zunnoPrisma;

if (!prisma) {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  global.__zunnoPrisma = prisma;
}

module.exports = prisma;
