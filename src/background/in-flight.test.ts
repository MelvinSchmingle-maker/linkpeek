import { describe, expect, it } from 'vitest';
import { forget } from './in-flight';

/** Lets pending promise callbacks run. */
const settle = () => new Promise((done) => setTimeout(done, 0));

describe('in-flight requests', () => {
  it('removes a request that succeeded', async () => {
    const flights = new Map<string, Promise<string>>();
    const work = Promise.resolve('done');
    flights.set('a', work);
    forget(flights, 'a', work);
    await settle();
    expect(flights.has('a')).toBe(false);
  });

  it('removes a request that failed, without leaving an unhandled rejection', async () => {
    const flights = new Map<string, Promise<string>>();
    const work = Promise.reject(new Error('storage not ready'));
    work.catch(() => undefined); // The caller's own handler, as in retrieve().
    flights.set('a', work);
    forget(flights, 'a', work);
    await settle();
    expect(flights.has('a')).toBe(false);
  });

  it('keeps a newer request that replaced it for the same key', async () => {
    const flights = new Map<string, Promise<string>>();
    const older = Promise.resolve('old');
    const newer = new Promise<string>(() => undefined);
    flights.set('a', older);
    forget(flights, 'a', older);
    flights.set('a', newer);
    await settle();
    expect(flights.get('a')).toBe(newer);
  });
});
