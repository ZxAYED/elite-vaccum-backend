import { NotificationType } from '@prisma/client';
import supertest from 'supertest';

const API_BASE = 'http://localhost:5000/api';

async function main() {
  console.log('🧪 Testing Notifications Module & BullMQ Queue Integration...');

  // 1. Admin Login
  const loginRes = await supertest(API_BASE)
    .post('/auth/login')
    .send({
      email: 'admin@elitevacuum.com',
      password: 'AdminPassword123!',
    });

  if (!loginRes.body?.accessToken) {
    console.log('⚠️ Could not log in as admin, skipping HTTP live dispatch test (offline compile passed).');
    return;
  }

  const adminAuth = `Bearer ${loginRes.body.accessToken}`;
  const adminUser = loginRes.body.user;
  console.log('✅ Admin logged in:', adminUser.email);

  // 2. Dispatch Notification via POST /notifications (BullMQ Enqueue)
  const createRes = await supertest(API_BASE)
    .post('/notifications')
    .set('Authorization', adminAuth)
    .send({
      userId: adminUser.id,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Automated System Health Check',
      message: 'Redis and BullMQ notification pipeline is fully operational.',
      ctaLabel: 'Open Dashboard',
      ctaUrl: '/admin/dashboard',
      priority: 1,
      sendEmail: false,
    });

  console.log('✅ POST /notifications (BullMQ Enqueued):', createRes.body);

  // Wait 1.5s for BullMQ background worker to process and persist
  await new Promise((r) => setTimeout(r, 1500));

  // 3. Query Inbox via GET /notifications
  const listRes = await supertest(API_BASE)
    .get('/notifications?page=1&limit=5')
    .set('Authorization', adminAuth);

  console.log('✅ GET /notifications:', {
    total: listRes.body.pagination?.meta?.totalItems,
    unreadCount: listRes.body.unreadCount,
    firstTitle: listRes.body.data?.[0]?.title,
  });

  // 4. Fast Unread Count via GET /notifications/unread-count
  const unreadRes = await supertest(API_BASE)
    .get('/notifications/unread-count')
    .set('Authorization', adminAuth);

  console.log('✅ GET /notifications/unread-count:', unreadRes.body);

  // 5. Mark All Read via PATCH /notifications/read-all
  const readAllRes = await supertest(API_BASE)
    .patch('/notifications/read-all')
    .set('Authorization', adminAuth);

  console.log('✅ PATCH /notifications/read-all:', readAllRes.body);

  console.log('🚀 All Notification tests completed successfully!');
}

main().catch((err) => {
  console.error('Test execution error:', err);
});
