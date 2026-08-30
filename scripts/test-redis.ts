import dotenv from 'dotenv';
dotenv.config();

import Redis from 'ioredis';

async function testUpstashConnection() {
  const redisUrl = process.env.REDIS_URL;
  console.log('Connecting to Upstash Redis URL:', redisUrl?.replace(/:[^:@]+@/, ':***@'));

  if (!redisUrl) {
    console.error('REDIS_URL is not defined in .env');
    process.exit(1);
  }

  const client = new Redis(redisUrl, {
    keyPrefix: 'elite_vacuum_test:',
    tls: { rejectUnauthorized: false },
    lazyConnect: false,
  });

  try {
    const pingRes = await client.ping();
    console.log('✅ PING Response:', pingRes);

    await client.set('hello', 'Upstash Redis Connected Successfully!', 'EX', 60);
    const value = await client.get('hello');
    console.log('✅ SET/GET Test Value:', value);

    const deleted = await client.del('hello');
    console.log('✅ DEL Test Count:', deleted);

    await client.quit();
    console.log('🚀 All Upstash Redis tests passed successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Redis connection failed:', err.message);
    await client.quit();
    process.exit(1);
  }
}

testUpstashConnection();
