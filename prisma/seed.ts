import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // 1. Clean up existing data (optional, but good for clean state)
  // Be careful with this in production!
  // await prisma.transaction.deleteMany();
  // await prisma.order.deleteMany();
  // await prisma.service.deleteMany();
  // await prisma.technician.deleteMany();
  // await prisma.customer.deleteMany();
  // await prisma.user.deleteMany();

  // 2. Admin User
  const adminPassword = await bcrypt.hash('123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      fullName: 'Admin User',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isEmailVerified: true,
    },
  });
  console.log('Created Admin:', admin.email);

  // 3. Customer User + Profile
  const customerPassword = await bcrypt.hash('123456', 10);
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@gmail.com' },
    update: {},
    create: {
      email: 'customer@gmail.com',
      fullName: 'Customer User',
      passwordHash: customerPassword,
      role: Role.CUSTOMER,
      isEmailVerified: true,
    },
  });


  console.log('Seeding completed.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
