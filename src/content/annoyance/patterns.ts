/**
 * What the annoyance tools look for. Plain rules, tested on fixtures
 * (test-pages/annoyance.html). Each rule errs toward leaving things alone:
 * a login form or a consent banner is never hidden, whatever else matches.
 */

/** Words that mean a box is asking for an email address to sign up. */
export const SIGN_UP_WORDS = /\b(sign ?up|subscribe|newsletter|join (our|the) (list|mailing)|get (the )?(daily|weekly|free)|email (alerts|updates)|stay (up to date|in the loop))\b/i;

/** Words that mean a consent or cookie notice. These are never hidden here (Part 12: a separate, later decision). */
export const CONSENT_WORDS = /\b(cookies?|consent|privacy (choices|settings|preferences)|manage preferences|accept all|gdpr|ccpa)\b/i;

/** Fake urgency: countdowns and scarcity lines. Shown with a note, never hidden. */
export const URGENCY_TEXT = [
  /\bonly \d+ (left|remaining|in stock)\b/i,
  /\b\d+ (people|customers|others) (are )?(viewing|looking at|bought) (this|it)\b/i,
  /\b(hurry|act now|last chance|ends (in|today|tonight|soon))\b/i,
  /\b\d{1,2}:\d{2}(:\d{2})?\b[^.]{0,20}\b(left|remaining|to go)\b/i,
];

/** Stored on each element LinkPeek changed, so undo can find it. */
export const ANNOYANCE_ATTR = 'data-linkpeek-annoyance';
