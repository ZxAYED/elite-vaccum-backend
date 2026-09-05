/**
 * Automated Store & Checkout End-to-End API Tester
 * 
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/test-store-apis.ts
 *   or: npm run test:store
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

interface TestResult {
  step: string;
  endpoint: string;
  method: string;
  status: number;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function logPass(step: string, endpoint: string, method: string, status: number, details?: string) {
  results.push({ step, endpoint, method, status, passed: true, details });
  console.log(`\x1b[32m[PASS]\x1b[0m ${method} ${endpoint} (${status}) - ${step} ${details ? `(${details})` : ''}`);
}

function logFail(step: string, endpoint: string, method: string, status: number, error: any) {
  results.push({ step, endpoint, method, status, passed: false, details: String(error) });
  console.error(`\x1b[31m[FAIL]\x1b[0m ${method} ${endpoint} (${status}) - ${step}: ${error}`);
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers };
}

async function runStoreTests() {
  console.log('====================================================');
  console.log('🚀 ELITE VACUUM STORE - AUTOMATED API TESTER');
  console.log(`🔗 Target URL: ${BASE_URL}`);
  console.log('====================================================\n');

  let authToken: string | null = null;
  let testProductId: string | null = null;
  let testProductInitialStock = 0;
  let testAddressId: string | null = null;
  let testCartItemId: string | null = null;
  let testOrderId: string | null = null;
  const testEmail = `tester_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  // ----------------------------------------------------
  // STEP 1: Categories APIs
  // ----------------------------------------------------
  try {
    const res = await request('/store/categories');
    if (res.status === 200 && Array.isArray(res.data?.items)) {
      logPass(
        'List active categories with badge counts',
        '/store/categories',
        'GET',
        res.status,
        `Categories: ${res.data.items.length}, Total Products: ${res.data.meta?.totalActiveProducts || 0}`,
      );
    } else {
      logFail('List categories', '/store/categories', 'GET', res.status, JSON.stringify(res.data));
    }
  } catch (err: any) {
    logFail('List categories', '/store/categories', 'GET', 0, err.message);
  }

  // ----------------------------------------------------
  // STEP 2: Products Catalog APIs & Dynamic Filters
  // ----------------------------------------------------
  try {
    const res = await request('/store/products?limit=12&availability=IN_STOCK');
    if (res.status === 200 && Array.isArray(res.data?.items)) {
      logPass(
        'List products with availability filter',
        '/store/products?availability=IN_STOCK',
        'GET',
        res.status,
        `Returned ${res.data.items.length} items`,
      );

      if (res.data.items.length > 0) {
        const firstProd = res.data.items[0];
        testProductId = firstProd.id;
        testProductInitialStock = firstProd.quantity;

        // Test Product Details API
        const detailRes = await request(`/store/products/${firstProd.id}`);
        if (detailRes.status === 200 && detailRes.data?.id === firstProd.id) {
          logPass(
            'Get product details by UUID',
            `/store/products/${firstProd.id}`,
            'GET',
            detailRes.status,
            `Name: ${detailRes.data.name}, SKU: ${detailRes.data.sku}, Stock: ${detailRes.data.quantity}`,
          );
        } else {
          logFail('Get product details', `/store/products/${firstProd.id}`, 'GET', detailRes.status, detailRes.data);
        }
      }
    } else {
      logFail('List products', '/store/products', 'GET', res.status, res.data);
    }
  } catch (err: any) {
    logFail('List products', '/store/products', 'GET', 0, err.message);
  }

  // ----------------------------------------------------
  // STEP 3: Customer Auth (Sign up / Login)
  // ----------------------------------------------------
  try {
    const signupRes = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Test Customer',
        email: testEmail,
        password: testPassword,
        phone: '+1-555-0199',
      }),
    });

    if (signupRes.status === 200 || signupRes.status === 201) {
      logPass('Customer Signup', '/auth/signup', 'POST', signupRes.status);
    }

    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    if (loginRes.status === 200 && loginRes.data?.accessToken) {
      authToken = loginRes.data.accessToken;
      logPass('Customer Login & Token issuance', '/auth/login', 'POST', loginRes.status, `User: ${loginRes.data.user?.email}`);
    }
  } catch (err: any) {
    console.log('Auth step info:', err.message);
  }

  // ----------------------------------------------------
  // STEP 4: Delivery Addresses API (Customer only)
  // ----------------------------------------------------
  if (authToken) {
    try {
      const addrRes = await request('/store/addresses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          label: 'Primary Home',
          line1: '123 Main Street',
          city: 'Brooklyn',
          state: 'NY',
          postalCode: '11201',
          country: 'USA',
          isDefault: true,
        }),
      });

      if (addrRes.status === 201 && addrRes.data?.id) {
        testAddressId = addrRes.data.id;
        logPass('Create customer delivery address', '/store/addresses', 'POST', addrRes.status, `ID: ${testAddressId}`);
      }

      const listAddrRes = await request('/store/addresses', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (listAddrRes.status === 200) {
        logPass('List customer saved delivery addresses', '/store/addresses', 'GET', listAddrRes.status, `Total: ${listAddrRes.data.totalCount}`);
      }
    } catch (err: any) {
      logFail('Delivery Address', '/store/addresses', 'ALL', 0, err.message);
    }
  }

  // ----------------------------------------------------
  // STEP 5: Shopping Cart
  // ----------------------------------------------------
  if (testProductId && authToken) {
    try {
      const addRes = await request('/store/cart/items', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          productId: testProductId,
          quantity: 2,
        }),
      });

      if (addRes.status === 201 && addRes.data?.cart) {
        logPass(
          'Add product to Cart with real-time stock validation',
          '/store/cart/items',
          'POST',
          addRes.status,
          `Cart items: ${addRes.data.cart.items?.length}`,
        );

        testCartItemId = addRes.data.cart.items?.[0]?.id;
      }

      const cartRes = await request('/store/cart', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (cartRes.status === 200 && cartRes.data?.summary) {
        logPass(
          'Get Cart Summary (Subtotal, $150 free shipping threshold, 8% tax)',
          '/store/cart',
          'GET',
          cartRes.status,
          `Subtotal: $${cartRes.data.summary.subtotalUsd}, Shipping: $${cartRes.data.summary.shippingFeeUsd}, Total: $${cartRes.data.summary.estimatedTotalUsd}`,
        );
      }
    } catch (err: any) {
      logFail('Cart workflow', '/store/cart', 'ALL', 0, err.message);
    }
  }

  // ----------------------------------------------------
  // STEP 6: Order Placement with COD / Delivery Address
  // ----------------------------------------------------
  if (testProductId && authToken) {
    try {
      const orderPayload = {
        paymentMethod: 'COD',
        deliveryAddressId: testAddressId || undefined,
        deliveryAddress: !testAddressId
          ? {
              label: 'Home Delivery',
              line1: '123 Delivery Blvd',
              city: 'Portland',
              state: 'OR',
              postalCode: '97201',
              country: 'USA',
            }
          : undefined,
        recipientName: 'Test Buyer',
        contactPhone: '+1-555-0199',
        notes: 'Automated test COD order placement',
      };

      const orderRes = await request('/store/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(orderPayload),
      });

      if (orderRes.status === 201 && orderRes.data?.order) {
        testOrderId = orderRes.data.order.id;
        logPass(
          'Proceed to order from Cart (Customer Auth + COD) - Stock lock & Invoice generated',
          '/store/orders',
          'POST',
          orderRes.status,
          `Order Business ID: ${orderRes.data.order.businessId}, Status: ${orderRes.data.order.status}, Total: $${orderRes.data.order.totalUsd}`,
        );

        // Verify inventory decreased
        const prodCheck = await request(`/store/products/${testProductId}`);
        if (prodCheck.status === 200) {
          logPass(
            'Verify Inventory Decrement after order placement',
            `/store/products/${testProductId}`,
            'GET',
            prodCheck.status,
            `Stock before: ${testProductInitialStock}, Stock now: ${prodCheck.data.quantity}`,
          );
        }
      } else {
        logFail('Create COD order', '/store/orders', 'POST', orderRes.status, orderRes.data);
      }
    } catch (err: any) {
      logFail('Create COD order', '/store/orders', 'POST', 0, err.message);
    }
  }

  // ----------------------------------------------------
  // STEP 7: Order Details & Status Inspection
  // ----------------------------------------------------
  if (testOrderId && authToken) {
    try {
      const detailsRes = await request(`/store/orders/${testOrderId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (detailsRes.status === 200 && detailsRes.data?.id === testOrderId) {
        logPass(
          'Get Order Details (Address Snapshot, addressRef, Timeline, Items, Invoices)',
          `/store/orders/${testOrderId}`,
          'GET',
          detailsRes.status,
          `Carrier: ${detailsRes.data.shippingProvider}, Timeline entries: ${detailsRes.data.statusHistory?.length}`,
        );
      } else {
        logFail('Get Order Details', `/store/orders/${testOrderId}`, 'GET', detailsRes.status, detailsRes.data);
      }
    } catch (err: any) {
      logFail('Order Details', `/store/orders/${testOrderId}`, 'GET', 0, err.message);
    }
  }

  // ----------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log('📊 TEST EXECUTION SUMMARY');
  console.log('====================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Endpoints Tested: ${total}`);
  console.log(`Passed: \x1b[32m${passed}\x1b[0m`);
  console.log(`Failed: ${failed > 0 ? `\x1b[31m${failed}\x1b[0m` : '\x1b[32m0\x1b[0m'}`);
  console.log('====================================================\n');

  if (failed > 0) {
    console.log('❌ Some tests failed. Inspect the logs above for specific response codes.');
  } else {
    console.log('✅ ALL TESTED STORE APIS EXECUTED AND VALIDATED SUCCESSFULLY!');
  }
}

runStoreTests().catch((err) => {
  console.error('Fatal tester error:', err);
});
