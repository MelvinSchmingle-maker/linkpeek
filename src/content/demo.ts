/**
 * Demo mode: puts the LinkPeek icon on links marked data-linkpeek-demo
 * (only our local test pages have these) and answers from fixtures.
 * Real link detection arrives in Part 03.
 */
import { hostnameOf, recordFeedback } from '../core/feedback/store';
import { attachIcon, CardController, HOST_ATTR } from './card';
import { demoResult, isDemoKey } from './fixtures';

const DEMO_ATTR = 'data-linkpeek-demo';
const DONE_ATTR = 'data-linkpeek-done';

export function attachDemoIcons(doc: Document, cards: CardController): number {
  let added = 0;
  for (const link of doc.querySelectorAll<HTMLAnchorElement>(`a[${DEMO_ATTR}]:not([${DONE_ATTR}])`)) {
    const key = link.getAttribute(DEMO_ATTR) ?? '';
    if (!isDemoKey(key)) continue;
    link.setAttribute(DONE_ATTR, '');
    attachIcon(link, (button) => {
      if (cards.openFor === link) {
        cards.close({ restoreFocus: true });
        return;
      }
      const result = demoResult(key, link);
      const onFeedback = async (value: 'up' | 'down') => {
        if (result === 'loading') return;
        await recordFeedback({
          resultId: result.id,
          signal: 'summary-usefulness',
          value,
          hostname: hostnameOf(result.url),
          evidence: result.evidence,
          provider: result.summary?.provider,
          wordCount: result.summary?.wordCount,
          isDemo: true,
        });
      };
      if (result === 'loading') {
        cards.open(link, button, { kind: 'loading', isDemo: true }, onFeedback);
      } else {
        cards.open(link, button, { kind: 'result', result }, onFeedback);
      }
    });
    added++;
  }
  return added;
}

export function removeDemoIcons(doc: Document, cards: CardController): void {
  cards.close({ restoreFocus: false });
  for (const link of doc.querySelectorAll(`a[${DONE_ATTR}]`)) {
    link.removeAttribute(DONE_ATTR);
    const next = link.nextElementSibling;
    if (next?.getAttribute(HOST_ATTR) === 'icon') next.remove();
  }
}
