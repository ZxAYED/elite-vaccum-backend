import 'dotenv/config';
import { PrismaClient, UserRole, TechnicianStatus, CustomerStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed (Pure JS/Prisma Client)...');

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'Password123!';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);


  // 1. SEED ADMIN USER

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@elitecentralvac.com').toLowerCase();
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: UserRole.ADMIN,
      isActive: true,
      emailVerifiedAt: new Date(),
      firstName: 'Elite',
      lastName: 'Admin',
      phone: '+1-555-100-1000',
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      firstName: 'Elite',
      lastName: 'Admin',
      phone: '+1-555-100-1000',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✅ Seeded Admin: ${admin.email} (Role: ${admin.role})`);


  // 2. SEED CUSTOMER USER

  const customerEmail = (process.env.CUSTOMER_EMAIL || 'customer@elitecentralvac.com').toLowerCase();
  const customerUser = await prisma.user.upsert({
    where: { email: customerEmail },
    update: {
      role: UserRole.CUSTOMER,
      isActive: true,
      emailVerifiedAt: new Date(),
      firstName: 'John',
      lastName: 'Customer',
      phone: '+1-555-200-2000',
    },
    create: {
      email: customerEmail,
      passwordHash,
      role: UserRole.CUSTOMER,
      firstName: 'John',
      lastName: 'Customer',
      phone: '+1-555-200-2000',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {
      displayName: 'John Customer',
      firstName: 'John',
      lastName: 'Customer',
      email: customerEmail,
      phone: '+1-555-200-2000',
      status: CustomerStatus.ACTIVE,
    },
    create: {
      userId: customerUser.id,
      displayName: 'John Customer',
      firstName: 'John',
      lastName: 'Customer',
      email: customerEmail,
      phone: '+1-555-200-2000',
      status: CustomerStatus.ACTIVE,
    },
  });
  console.log(`✅ Seeded Customer: ${customerUser.email} (Role: ${customerUser.role})`);


  // 3. SEED TECHNICIAN USER

  const techEmail = (process.env.TECH_EMAIL || 'technician@elitecentralvac.com').toLowerCase();
  const techUser = await prisma.user.upsert({
    where: { email: techEmail },
    update: {
      role: UserRole.TECHNICIAN,
      isActive: true,
      emailVerifiedAt: new Date(),
      firstName: 'Dave',
      lastName: 'MasterTech',
      phone: '+1-555-300-3000',
    },
    create: {
      email: techEmail,
      passwordHash,
      role: UserRole.TECHNICIAN,
      firstName: 'Dave',
      lastName: 'MasterTech',
      phone: '+1-555-300-3000',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.technician.upsert({
    where: { userId: techUser.id },
    update: {
      displayName: 'Dave MasterTech',
      email: techEmail,
      phone: '+1-555-300-3000',
      status: TechnicianStatus.ACTIVE,
      rating: 4.95,
      completedJobs: 42,
      isVerified: true,
      specializations: [
        'VACUUM_REPAIR',
        'INSTALLATION',
        'PIPE_UNCLOGGING',
        'MOTOR_NOISE_DIAGNOSTICS',
      ],
      adminNotes: 'Senior Field Technician certified for Elite Central Vacuum systems.',
    },
    create: {
      userId: techUser.id,
      displayName: 'Dave MasterTech',
      email: techEmail,
      phone: '+1-555-300-3000',
      status: TechnicianStatus.ACTIVE,
      rating: 4.95,
      completedJobs: 42,
      isVerified: true,
      specializations: [
        'VACUUM_REPAIR',
        'INSTALLATION',
        'PIPE_UNCLOGGING',
        'MOTOR_NOISE_DIAGNOSTICS',
      ],
      adminNotes: 'Senior Field Technician certified for Elite Central Vacuum systems.',
    },
  });
  console.log(`✅ Seeded Technician: ${techUser.email} (Role: ${techUser.role})`);

  console.log('\n🎉 Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log(`Admin Login:      ${adminEmail} / ${defaultPassword}`);
  console.log(`Customer Login:   ${customerEmail} / ${defaultPassword}`);
  console.log(`Technician Login: ${techEmail} / ${defaultPassword}`);
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
