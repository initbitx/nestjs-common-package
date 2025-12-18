import { connect, StringCodec } from 'nats';

async function publishEvent() {
  const nc = await connect({ servers: ['nats://localhost:4222'] });
  const js = nc.jetstream();
  const sc = StringCodec();

  const event = {
    orderId: 'order-002',
    tenantId: 'tenant-456',
    userId: 'user-789',
    amount: 99.99,
    createdAt: new Date().toISOString()
  };

  console.log(`Publishing event to 'orders.created' subject ...`);
  await js.publish('orders.created', sc.encode(JSON.stringify(event)));
  console.log('✅ Event published successfully');

  await nc.close();
}

publishEvent().catch(console.error);
