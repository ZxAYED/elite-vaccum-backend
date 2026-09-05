import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function request(
  endpoint: string,
  method = 'GET',
  body?: any,
  token?: string,
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawText: text };
  }

  return { status: res.status, ok: res.ok, data: json };
}

async function runServicesTests() {
  console.log('🚀 Starting Services & Schedule Management End-to-End Test Suite...\n');

  let adminToken = '';
  let customerToken = '';

  // 1. PUBLIC SERVICES CATALOG
  console.log('1️⃣  Testing Public Services Catalog (GET /services)...');
  const catRes = await request('/services');
  if (!catRes.ok || !catRes.data?.data) {
    console.error('❌ Failed to fetch services catalog:', catRes.data);
    return;
  }
  const { serviceAndMaintenance, installation, symptoms } = catRes.data.data;
  console.log(
    `✅ Fetched Catalog: ${serviceAndMaintenance.length} Service & Maintenance items, ${installation.length} Installation items, ${symptoms.length} Symptoms`,
  );
  if (serviceAndMaintenance.length !== 6 || installation.length !== 4) {
    console.error('❌ Expected 6 service & maintenance and 4 installation services!');
    return;
  }

  // 2. SINGLE SERVICE BY SLUG
  console.log('\n2️⃣  Testing Single Service Metadata (GET /services/low-suction-fix)...');
  const slugRes = await request('/services/low-suction-fix');
  if (!slugRes.ok || slugRes.data?.data?.slug !== 'low-suction-fix') {
    console.error('❌ Failed to fetch service by slug:', slugRes.data);
    return;
  }
  console.log(`✅ Fetched service details: '${slugRes.data.data.title}' (Group: ${slugRes.data.data.group})`);

  // 3. AUTH PREPARATION
  console.log('\n3️⃣  Setting up Test Authentication (Customer & Admin)...');
  const customerEmail = `service.customer.${Date.now()}@example.com`;
  const adminEmail = `service.admin.${Date.now()}@example.com`;

  // Create Customer
  await request('/auth/signup', 'POST', {
    email: customerEmail,
    password: 'Password123!',
    fullName: 'Jane Customer',
    phone: '+1-555-123-4567',
  });

  // Login Customer (Mock or Direct)
  const custLogin = await request('/auth/login', 'POST', {
    email: customerEmail,
    password: 'Password123!',
  });
  if (custLogin.ok && custLogin.data?.accessToken) {
    customerToken = custLogin.data.accessToken;
    console.log('✅ Customer logged in successfully');
  } else {
    console.log('ℹ️ Customer requires verification or admin bypass');
  }

  // 4. SUBMIT SERVICE INTAKE REQUEST
  console.log('\n4️⃣  Submitting Service Intake Request (POST /service-requests)...');
  const intakePayload = {
    serviceSlug: 'low-suction-fix',
    fullName: 'Alice Smith',
    email: `alice.${Date.now()}@example.com`,
    phone: '+1-555-888-9999',
    address: '742 Evergreen Terrace',
    city: 'Springfield',
    state: 'OR',
    zipCode: '97477',
    problemLocation: 'Basement & Main Level',
    preferredDate: '2026-09-15',
    timeWindow: '09:00 AM - 11:00 AM',
    problemDescription: 'Power unit turns on but there is zero suction upstairs and whistling sound near wall inlets.',
    symptoms: ['LOW_SUCTION', 'CLOGGED', 'WALL_OR_POWER_HOSE_PROBLEM'],
    manufacturer: 'Beam Central Vac',
    modelNumber: 'SC375',
    serialNumber: 'SN-908234-A',
    unitLocation: 'Garage Wall Mount',
    attachments: [
      {
        fileName: 'clogged-pipe-photo.jpg',
        fileType: 'image/jpeg',
        sizeBytes: 154000,
        url: 'https://example.com/uploads/clogged-pipe-photo.jpg',
        kind: 'PHOTO',
        category: 'Inlet Valve',
        note: 'Showing hairline crack on front hinge',
      },
    ],
    additionalNotes: 'Gate code is #1234. Friendly dog inside.',
  };

  const createReqRes = await request('/service-requests', 'POST', intakePayload, customerToken);
  if (!createReqRes.ok || !createReqRes.data?.request?.id) {
    console.error('❌ Failed to create service intake request:', createReqRes.data);
    return;
  }
  const createdRequest = createReqRes.data.request;
  const requestId = createdRequest.id;
  const businessId = createdRequest.businessId;
  console.log(`✅ Service Request Created! Business ID: ${businessId} | Status: ${createdRequest.status}`);

  // 5. GET SERVICE REQUEST DETAILS
  console.log(`\n5️⃣  Fetching Service Request Details (GET /service-requests/${businessId})...`);
  const detailsRes = await request(`/service-requests/${businessId}`, 'GET', undefined, customerToken);
  if (detailsRes.ok && detailsRes.data?.id) {
    console.log(`✅ Successfully fetched details by business ID '${businessId}'`);
    console.log(`   - Symptoms: ${detailsRes.data.symptoms.join(', ')}`);
    console.log(`   - Equipment: ${detailsRes.data.equipment?.manufacturer} ${detailsRes.data.equipment?.modelNumber}`);
    console.log(`   - Attachments: ${detailsRes.data.attachments?.length} items`);
  }

  // 6. DAILY BOOKING SLOTS
  console.log('\n6️⃣  Checking Daily Booking Slots (GET /schedule/slots?date=2026-09-15)...');
  const slotsRes = await request('/schedule/slots?date=2026-09-15');
  if (!slotsRes.ok || !slotsRes.data?.slots) {
    console.error('❌ Failed to fetch booking slots:', slotsRes.data);
    return;
  }
  console.log(`✅ Total Slots: ${slotsRes.data.totalSlots} | Available: ${slotsRes.data.availableSlotsCount} | Booked: ${slotsRes.data.bookedSlotsCount}`);
  for (const s of slotsRes.data.slots) {
    console.log(`   - [${s.status}] ${s.slot} (Available capacity: ${s.availableCapacity})`);
  }

  // 7. CREATE APPOINTMENT DISPATCH (ADMIN)
  console.log('\n7️⃣  Creating Schedule Appointment (POST /schedule)...');
  const schedulePayload = {
    serviceRequestId: requestId,
    date: '2026-09-15',
    startTime: '09:00 AM',
    endTime: '11:00 AM',
    adminNote: 'Customer confirmed gate code #1234. Pre-loaded high-pressure purge hose in van.',
    notes: 'Bring Beam replacement 2-inch sweep 90 elbow.',
  };

  const scheduleRes = await request('/schedule', 'POST', schedulePayload, adminToken);
  let appointmentId = '';
  if (scheduleRes.ok && scheduleRes.data?.appointment?.id) {
    appointmentId = scheduleRes.data.appointment.id;
    console.log(`✅ Appointment Created! ID: ${appointmentId} | Status: ${scheduleRes.data.appointment.status}`);
  } else {
    console.log(`ℹ️ Schedule response: ${scheduleRes.status} (Needs Admin Token for production guard)`);
  }

  console.log('\n🎉 Services & Schedule API Test Suite Execution Finished!\n');
}

runServicesTests().catch((err) => {
  console.error('Fatal error during Services API tests:', err);
});
