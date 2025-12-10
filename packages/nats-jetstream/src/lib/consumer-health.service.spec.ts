import { ConsumerHealthService } from './consumer-health.service';

// Helpers to build async iterables
function asyncIterableOf<T>(...items: T[]) {
  return (async function* () {
    for (const it of items) {
      yield it;
    }
  })();
}

describe('ConsumerHealthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns health for a normal consumer (happy path)', async () => {
    const nowMs = Date.now();

    const jsm: any = {
      streams: {
        list: () => asyncIterableOf({ config: { name: 'stream1' } })
      },
      consumers: {
        list: (streamName: string) => asyncIterableOf({ name: 'consumer1' }),
        info: async (streamName: string, consumerName: string) => {
          return {
            delivered: { consumer_seq: 5, last_active: String(nowMs) },
            ack_floor: { consumer_seq: 4 },
            num_waiting: 0,
            num_pending: 0,
            num_redelivered: 0
          };
        }
      }
    };

    const svc = new ConsumerHealthService(jsm, { monitoringIntervalMs: 1000000 });

    const all = await svc.getAllConsumersHealth();
    expect(all).toHaveLength(1);
    const h = all[0];
    expect(h.name).toBe('consumer1');
    expect(h.streamName).toBe('stream1');
    expect(h.delivered).toBe(5);
    expect(h.acknowledged).toBe(4);
    expect(h.pendingAcks).toBe(0);
    expect(h.redelivered).toBe(0);
    expect(h.status).toBe('active');

    svc.stopMonitoring();
  });

  it('handles missing delivered and ack_floor without throwing', async () => {
    const jsm: any = {
      streams: { list: () => asyncIterableOf({ config: { name: 's2' } }) },
      consumers: {
        list: (s: string) => asyncIterableOf({ name: 'c2' }),
        info: async () => ({ num_waiting: 1, num_pending: 0, num_redelivered: 0 })
      }
    };

    const svc = new ConsumerHealthService(jsm, { monitoringIntervalMs: 1000000 });
    const all = await svc.getAllConsumersHealth();
    expect(all).toHaveLength(1);
    const h = all[0];
    expect(h.delivered).toBe(0);
    expect(h.acknowledged).toBe(0);
    expect(h.status).toBe('active');

    svc.stopMonitoring();
  });

  it('marks consumer as error when pending > threshold', async () => {
    const jsm: any = {
      streams: { list: () => asyncIterableOf({ config: { name: 's3' } }) },
      consumers: {
        list: (s: string) => asyncIterableOf({ name: 'c3' }),
        info: async () => ({ delivered: { consumer_seq: 1, last_active: String(Date.now()) }, ack_floor: { consumer_seq: 0 }, num_waiting: 0, num_pending: 20, num_redelivered: 0 })
      }
    };

    // set a low threshold so test is deterministic
    const svc = new ConsumerHealthService(jsm, { monitoringIntervalMs: 1000000, pendingThreshold: 10 });
    const all = await svc.getAllConsumersHealth();
    expect(all).toHaveLength(1);
    const h = all[0];
    expect(h.pendingAcks).toBe(20);
    expect(h.status).toBe('error');
    expect(h.errorMessage).toBeDefined();

    svc.stopMonitoring();
  });

  it('creates error health entry when consumers.info throws and notifies callbacks', async () => {
    const jsm: any = {
      streams: { list: () => asyncIterableOf({ config: { name: 's4' } }) },
      consumers: {
        list: (s: string) => asyncIterableOf({ name: 'c4' }),
        info: async () => { throw new Error('boom'); }
      }
    };

    const svc = new ConsumerHealthService(jsm, { monitoringIntervalMs: 1000000 });

    const callback = jest.fn();
    const unsubscribe = svc.onHealthUpdate(callback);

    const all = await svc.getAllConsumersHealth();
    expect(all).toHaveLength(1);
    const h = all[0];
    expect(h.status).toBe('error');
    expect(h.errorMessage).toMatch(/boom/);

    // ensure callback was called at least once
    expect(callback).toHaveBeenCalled();

    // unsubscribe and ensure cleanup
    unsubscribe();
    svc.stopMonitoring();
  });

});

