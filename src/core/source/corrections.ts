/**
 * Looks for a corrections or editorial-standards page on a site, at the
 * addresses most sites use. It only runs when the user asks (see the card),
 * and it sends no cookies. Asking nothing and getting nothing back are
 * different results, and the card keeps them apart.
 *
 * "Not found at these addresses" doesn't mean the site has no corrections
 * policy. It means we didn't find one at the usual places.
 */

/** Addresses tried in order, after the site's origin. Short on purpose. */
export const CORRECTIONS_PATHS = [
  '/corrections',
  '/corrections-policy',
  '/corrections-and-clarifications',
  '/editorial-standards',
  '/editorial-policy',
  '/ethics-policy',
] as const;

export type CorrectionsResult =
  | { kind: 'found'; url: string }
  | { kind: 'not-found' }
  | { kind: 'needs-access' }
  | { kind: 'error' };

/** What a fetch of one candidate address gave back. */
export interface PageCheck {
  status: number;
  html: boolean;
  text: string;
}

/** Pages that answer 200 but say they don't exist. Common, so they're checked for. */
const MISSING = /page not found|page (cannot|can't|could not) be found|this page (does not|doesn't) exist|404 error/i;

/**
 * Tries each candidate address on the site. `fetchPage` returns undefined when
 * the request failed (no answer at all). The result is "found" at the first
 * real page, "not-found" when some address answered but none was a page, and
 * "error" when none answered.
 */
export async function findCorrectionsPage(
  origin: string,
  fetchPage: (url: string) => Promise<PageCheck | undefined>,
): Promise<CorrectionsResult> {
  let answered = false;
  for (const path of CORRECTIONS_PATHS) {
    const url = new URL(path, origin).href;
    const page = await fetchPage(url);
    if (!page) continue;
    answered = true;
    if (page.status === 200 && page.html && !MISSING.test(page.text.slice(0, 5000))) return { kind: 'found', url };
  }
  return answered ? { kind: 'not-found' } : { kind: 'error' };
}
