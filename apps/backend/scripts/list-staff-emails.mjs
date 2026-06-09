import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();
const users = await prisma.staffUser.findMany({
  select: { email: true, isActive: true, mustChangePassword: true, role: { select: { key: true, label: true } } },
  orderBy: { createdAt: "asc" },
});
console.log(JSON.stringify(users, null, 2));
await prisma.$disconnect();
