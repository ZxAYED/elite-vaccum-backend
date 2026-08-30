import * as dotenv from 'dotenv';
dotenv.config();

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/elite_vacuum?schema=public';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function bootstrap() {
  console.log('🚀 Starting Comprehensive Platform APIs Test Suite...');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();
  const server = app.getHttpServer();
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);

  try {
    // 1. Setup Admin & Customer Test Tokens
    console.log('\n--- 1. AUTH SETUP ---');
    const adminEmail = `admin_test_${Date.now()}@example.com`;
    const customerEmail = `customer_test_${Date.now()}@example.com`;

    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'System',
        lastName: 'Admin',
        passwordHash: '$2b$10$epRZs5WqWj3f3N6oWqgJ/.fI0jE8JtE9B6Qd5sW.dZJq6dK4K4dGy',
        role: 'ADMIN',
        isActive: true,
      },
    });

    const customerUser = await prisma.user.create({
      data: {
        email: customerEmail,
        firstName: 'Jane',
        lastName: 'Customer',
        phone: '+1-555-9988',
        passwordHash: '$2b$10$epRZs5WqWj3f3N6oWqgJ/.fI0jE8JtE9B6Qd5sW.dZJq6dK4K4dGy',
        role: 'CUSTOMER',
        isActive: true,
        customer: {
          create: {
            firstName: 'Jane',
            lastName: 'Customer',
            displayName: 'Jane Customer',
            email: customerEmail,
            phone: '+1-555-9988',
          },
        },
      },
      include: { customer: true },
    });

    const adminToken = await jwt.signAsync(
      { sub: adminUser.id, email: adminUser.email, role: adminUser.role },
      { expiresIn: '1h' },
    );
    const customerToken = await jwt.signAsync(
      { sub: customerUser.id, email: customerUser.email, role: customerUser.role },
      { expiresIn: '1h' },
    );

    const adminAuth = `Bearer ${adminToken}`;
    const customerAuth = `Bearer ${customerToken}`;
    console.log('✅ Auth tokens generated successfully');

    // 2. Settings & System Configuration
    console.log('\n--- 2. SYSTEM SETTINGS & CONFIGURATION ---');
    const profileRes = await supertest(server)
      .get('/settings/business-profile')
      .expect(200);
    console.log('✅ GET /settings/business-profile:', profileRes.body.data.businessName);

    const updateProfileRes = await supertest(server)
      .patch('/settings/business-profile')
      .set('Authorization', adminAuth)
      .send({
        businessName: 'Elite Central Vacuum Inc.',
        coverageNotes: 'Updated Greenwich and Stamford territory coverage.',
      })
      .expect(200);
    console.log('✅ PATCH /settings/business-profile:', updateProfileRes.body.data.businessName);

    const faqRes = await supertest(server)
      .post('/settings/faqs')
      .set('Authorization', adminAuth)
      .send({
        question: 'Do you offer warranty on motor replacements?',
        answer: 'Yes, all OEM motor replacements include a 2-year warranty on parts and 1-year on labor.',
        category: 'Repair',
        status: 'Published',
      })
      .expect(201);
    console.log('✅ POST /settings/faqs:', faqRes.body.data.question);

    const policiesRes = await supertest(server)
      .get('/settings/policies')
      .expect(200);
    console.log('✅ GET /settings/policies count:', policiesRes.body.data.length);

    const termsRes = await supertest(server)
      .get('/settings/policies/terms')
      .expect(200);
    console.log('✅ GET /settings/policies/terms:', termsRes.body.data.title);

    // 3. Technicians Management
    console.log('\n--- 3. TECHNICIANS MANAGEMENT ---');
    const techEmail = `tech_${Date.now()}@example.com`;
    const createTechRes = await supertest(server)
      .post('/technicians')
      .set('Authorization', adminAuth)
      .send({
        displayName: 'Marcus Vance',
        email: techEmail,
        phone: '+1-555-4321',
        password: 'Password123!',
        specializations: ['VACUUM_REPAIR', 'LOW_SUCTION_FIX'],
        adminNotes: 'Certified field diagnostic technician',
      })
      .expect(201);
    const techId = createTechRes.body.technician.id;
    console.log('✅ POST /technicians:', createTechRes.body.technician.displayName, `(ID: ${techId})`);

    const listTechRes = await supertest(server)
      .get('/technicians')
      .set('Authorization', adminAuth)
      .expect(200);
    console.log('✅ GET /technicians count:', listTechRes.body.items.length);

    // 4. Service Request -> Quotation -> Service Order Flow
    console.log('\n--- 4. SERVICE WORKFLOW & QUOTATIONS ---');
    const serviceReqRes = await supertest(server)
      .post('/service-requests')
      .set('Authorization', customerAuth)
      .send({
        serviceSlug: 'vacuum-repair',
        title: 'Central vacuum motor making rattling noise',
        description: 'Loud rattling noise from the garage canister unit.',
        urgency: 'HIGH',
        preferredDate: '2026-09-10',
        preferredTime: 'MORNING',
        symptoms: ['NOISE', 'LOW_SUCTION'],
        contact: {
          fullName: 'Jane Customer',
          email: customerEmail,
          phone: '+1-555-9988',
        },
        address: {
          street: '456 Hillside Ave',
          city: 'Greenwich',
          state: 'CT',
          zipCode: '06830',
        },
      })
      .expect(201);
    const serviceRequestId = serviceReqRes.body.data.id;
    console.log('✅ POST /service-requests:', serviceReqRes.body.data.businessId);

    // Admin creates Quotation
    const quoteRes = await supertest(server)
      .post('/quotations')
      .set('Authorization', adminAuth)
      .send({
        serviceRequestId,
        lineItems: [
          {
            description: 'Central Vacuum Motor Diagnostics & Cleaning',
            quantity: 1,
            unitPriceUsd: 150.0,
          },
          {
            description: 'OEM 120V Carbon Brushes Replacement Kit',
            quantity: 1,
            unitPriceUsd: 85.0,
          },
        ],
        discountUsd: 15.0,
        taxUsd: 17.6,
        notes: 'Includes 90-day labor warranty',
      })
      .expect(201);
    const quoteId = quoteRes.body.quotation.id;
    console.log('✅ POST /quotations:', quoteRes.body.quotation.businessId, `Total: $${quoteRes.body.quotation.totalUsd}`);

    // Customer accepts quotation via unified PATCH /status -> auto-creates Service Order
    const acceptRes = await supertest(server)
      .patch(`/quotations/${quoteId}/status`)
      .set('Authorization', customerAuth)
      .send({ action: 'ACCEPTED' })
      .expect(200);
    const serviceOrderId = acceptRes.body.serviceOrder.id;
    console.log('✅ PATCH /quotations/:id/status (ACCEPTED): Service Order Generated', acceptRes.body.serviceOrder.businessId);

    // 5. Service Order Execution & Dispatch
    console.log('\n--- 5. SERVICE ORDER EXECUTION & DISPATCH ---');
    const assignRes = await supertest(server)
      .post(`/service-orders/${serviceOrderId}/assign`)
      .set('Authorization', adminAuth)
      .send({
        technicianId: techId,
        note: 'Assigned for morning dispatch',
      })
      .expect(200);
    console.log('✅ POST /service-orders/:id/assign:', assignRes.body.serviceOrder.status);

    const etaRes = await supertest(server)
      .post(`/service-orders/${serviceOrderId}/eta`)
      .set('Authorization', adminAuth)
      .send({ minutes: 30 })
      .expect(201);
    console.log('✅ POST /service-orders/:id/eta: 30 min ETA recorded');

    // Transition status to COMPLETED -> auto-creates Service Invoice!
    const completeRes = await supertest(server)
      .patch(`/service-orders/${serviceOrderId}/status`)
      .set('Authorization', adminAuth)
      .send({
        status: 'COMPLETED',
        note: 'Motor diagnostic complete and brushes replaced.',
      })
      .expect(200);
    console.log('✅ PATCH /service-orders/:id/status: COMPLETED');

    // 6. Billing & Invoices
    console.log('\n--- 6. BILLING & INVOICES ---');
    const invoicesListRes = await supertest(server)
      .get('/billing/invoices')
      .set('Authorization', adminAuth)
      .expect(200);
    console.log('✅ GET /billing/invoices count:', invoicesListRes.body.items.length, 'KPI total:', invoicesListRes.body.meta.kpi.total);

    const generatedInvoice = invoicesListRes.body.items.find(
      (inv: any) => inv.serviceOrderId === serviceOrderId,
    );
    const invoiceId = generatedInvoice ? generatedInvoice.id : invoicesListRes.body.items[0].id;

    // Record Payment
    const paymentRes = await supertest(server)
      .post(`/billing/invoices/${invoiceId}/payments`)
      .set('Authorization', adminAuth)
      .send({
        amountUsd: Number(generatedInvoice ? generatedInvoice.totalUsd : 237.6),
        methodLabel: 'Credit Card',
        transactionReference: `ch_${Date.now()}`,
      })
      .expect(201);
    console.log('✅ POST /billing/invoices/:id/payments: Invoice marked', paymentRes.body.invoice.status);

    const htmlRes = await supertest(server)
      .get(`/billing/invoices/${invoiceId}/html`)
      .set('Authorization', adminAuth)
      .expect(200);
    console.log('✅ GET /billing/invoices/:id/html: HTML Invoice stream verified');

    // 7. Customer Reviews
    console.log('\n--- 7. CUSTOMER REVIEWS ---');
    const reviewRes = await supertest(server)
      .post('/reviews')
      .set('Authorization', customerAuth)
      .send({
        type: 'SERVICE',
        serviceOrderId,
        rating: 5,
        title: 'Fast and quiet repair!',
        body: 'The technician fixed the motor noise in under an hour. Great service!',
      })
      .expect(201);
    const reviewId = reviewRes.body.review.id;
    console.log('✅ POST /reviews (Customer only):', reviewRes.body.review.title);

    const publicReviewsRes = await supertest(server)
      .get('/reviews')
      .expect(200);
    console.log('✅ GET /reviews (Public): Average rating', publicReviewsRes.body.meta.analytics.averageRating);

    const moderateRes = await supertest(server)
      .patch(`/reviews/${reviewId}/moderate`)
      .set('Authorization', adminAuth)
      .send({
        action: 'PUBLISHED',
        reason: 'Verified genuine service order customer review',
      })
      .expect(200);
    console.log('✅ PATCH /reviews/:id/moderate:', moderateRes.body.message);

    // 8. Reports & Insights Dashboard
    console.log('\n--- 8. INSIGHTS & REPORTS DASHBOARD ---');
    const overviewRes = await supertest(server)
      .get('/reports/overview')
      .set('Authorization', adminAuth)
      .expect(200);
    console.log('✅ GET /reports/overview metrics:', overviewRes.body.data.metrics);
    console.log('✅ GET /reports/overview serviceFunnel:', overviewRes.body.data.serviceFunnel);

    const salesReportsRes = await supertest(server)
      .get('/reports/sales')
      .set('Authorization', adminAuth)
      .expect(200);
    console.log('✅ GET /reports/sales:', salesReportsRes.body.data);

    const techReportsRes = await supertest(server)
      .get('/reports/technicians')
      .set('Authorization', adminAuth)
      .expect(200);
    console.log('✅ GET /reports/technicians leaderboard count:', techReportsRes.body.data.length);

    console.log('\n🎉 ALL PLATFORM APIS VERIFIED AND PASSING 100%!');
  } finally {
    await app.close();
  }
}

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test Suite Failed:', err);
    process.exit(1);
  });
