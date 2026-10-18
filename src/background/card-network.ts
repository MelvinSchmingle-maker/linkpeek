/**
 * Reading an X card (D66). Chrome can't scope a network rule to one request,
 * so while a card's t.co link is followed, the rules below apply to every
 * request LinkPeek makes: t.co and the card's site are allowed, and anything
 * else is blocked before it is made. That stops a redirect from reaching a
 * site the user hasn't allowed (measured in Chrome: a request to it arrives
 * unless it's blocked first).
 *
 * Other requests share the network while they run. A card waits for them to
 * finish, and they wait for a card to finish, so no other request can run in
 * the window. The rules are removed when the window ends, even after an error,
 * and again when the worker starts (in case it stopped mid-window).
 */
export const CARD_RULE_IDS = [901, 902];

type Waiter = { exclusive: boolean; start: () => void };
const waiting: Waiter[] = [];
let readers = 0;
let writer = false;

/** Starts the next waiting requests that can run now, in order. */
function admit(): void {
  while (waiting.length) {
    const next = waiting[0]!;
    if (next.exclusive) {
      if (readers > 0 || writer) return;
      writer = true;
    } else {
      if (writer) return;
      readers++;
    }
    waiting.shift();
    next.start();
  }
}

function enter(exclusive: boolean): Promise<void> {
  return new Promise((start) => {
    waiting.push({ exclusive, start });
    admit();
  });
}

function leave(exclusive: boolean): void {
  if (exclusive) writer = false;
  else readers--;
  admit();
}

function dnr(): typeof chrome.declarativeNetRequest {
  const api = globalThis.chrome?.declarativeNetRequest;
  if (!api) throw new Error('declarativeNetRequest is not available');
  return api;
}

/** Runs a request that may happen during a card's window. */
export async function withSharedNetwork<T>(work: () => Promise<T>): Promise<T> {
  await enter(false);
  try {
    return await work();
  } finally {
    leave(false);
  }
}

/** Runs one card's request with only the card's own hosts allowed. Fails if the rules can't be set. */
export async function withCardNetwork<T>(hosts: readonly [string, string], work: () => Promise<T>): Promise<T> {
  await enter(true);
  try {
    await dnr().updateSessionRules({
      removeRuleIds: CARD_RULE_IDS,
      addRules: [
        // Block everything LinkPeek requests (higher priority allow rules below win over this).
        {
          id: CARD_RULE_IDS[0]!,
          priority: 1,
          action: { type: 'block' } as chrome.declarativeNetRequest.RuleAction,
          condition: { regexFilter: '^https?://', initiatorDomains: [chrome.runtime.id] },
        },
        {
          id: CARD_RULE_IDS[1]!,
          priority: 2,
          action: { type: 'allow' } as chrome.declarativeNetRequest.RuleAction,
          condition: { requestDomains: [...hosts], initiatorDomains: [chrome.runtime.id] },
        },
      ],
    });
    return await work();
  } finally {
    await clearCardRules();
    leave(true);
  }
}

/** Removes any card rules. Called when the worker starts, and after every card window. */
export async function clearCardRules(): Promise<void> {
  try {
    await dnr().updateSessionRules({ removeRuleIds: CARD_RULE_IDS, addRules: [] });
  } catch {
    // Nothing to remove, or the API is missing: either way no card rule can be active.
  }
}
