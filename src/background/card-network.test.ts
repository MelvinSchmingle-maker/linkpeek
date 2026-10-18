import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARD_RULE_IDS, clearCardRules, withCardNetwork, withSharedNetwork } from './card-network';

const tick = () => new Promise((done) => setTimeout(done, 0));

let rules: { updateSessionRules: ReturnType<typeof vi.fn> };
beforeEach(() => {
  rules = { updateSessionRules: vi.fn(async () => undefined) };
  vi.stubGlobal('chrome', { runtime: { id: 'abcdefghijklmnopabcdefghijklmnop' }, declarativeNetRequest: rules });
});
afterEach(() => vi.unstubAllGlobals());

describe('the card window', () => {
  it('allows only the card\'s two hosts, and blocks every other request LinkPeek makes', async () => {
    await withCardNetwork(['t.co', 'news.example'], async () => undefined);
    const first = rules.updateSessionRules.mock.calls[0]![0];
    const [block, allow] = first.addRules;
    expect(block).toMatchObject({ id: CARD_RULE_IDS[0], priority: 1, action: { type: 'block' } });
    expect(allow).toMatchObject({
      id: CARD_RULE_IDS[1],
      priority: 2,
      action: { type: 'allow' },
      condition: { requestDomains: ['t.co', 'news.example'], initiatorDomains: ['abcdefghijklmnopabcdefghijklmnop'] },
    });
  });

  it('removes its rules after the work, and after an error', async () => {
    await withCardNetwork(['t.co', 'news.example'], async () => 'done');
    await expect(withCardNetwork(['t.co', 'news.example'], async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const removals = rules.updateSessionRules.mock.calls.filter((c) => c[0].addRules.length === 0);
    expect(removals.length).toBe(2);
  });

  it('fails when the rules cannot be set, and then runs nothing', async () => {
    vi.stubGlobal('chrome', { runtime: { id: 'x' } });
    const work = vi.fn(async () => 'should not run');
    await expect(withCardNetwork(['t.co', 'news.example'], work)).rejects.toThrow();
    expect(work).not.toHaveBeenCalled();
  });

  it('waits for requests already in flight, and holds the others until it is finished', async () => {
    const order: string[] = [];
    let finishShared!: () => void;
    const shared = withSharedNetwork(() => new Promise<void>((done) => { order.push('shared start'); finishShared = () => { order.push('shared end'); done(); }; }));
    await tick();
    const card = withCardNetwork(['t.co', 'news.example'], async () => { order.push('card'); });
    const later = withSharedNetwork(async () => { order.push('later'); });
    await tick();
    expect(order).toEqual(['shared start']);
    finishShared();
    await shared;
    await card;
    await later;
    expect(order).toEqual(['shared start', 'shared end', 'card', 'later']);
  });

  it('lets requests run together while no card is waiting', async () => {
    let inside = 0;
    let most = 0;
    const one = () => withSharedNetwork(async () => { inside++; most = Math.max(most, inside); await tick(); inside--; });
    await Promise.all([one(), one(), one()]);
    expect(most).toBe(3);
  });

  it('clears any card rules when asked, and does nothing if there are none', async () => {
    await clearCardRules();
    expect(rules.updateSessionRules).toHaveBeenCalledWith({ removeRuleIds: CARD_RULE_IDS, addRules: [] });
  });
});
