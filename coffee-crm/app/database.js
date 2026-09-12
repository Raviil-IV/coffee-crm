const { PrismaClient } = require('@prisma/client');

// Единый экземпляр клиента Prisma на всё приложение
const prisma = new PrismaClient();

module.exports = { prisma };