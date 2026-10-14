import { BRAND } from '../brand';

/**
 * CSS variables for the brand colours, with dark-mode variants.
 * Used by the popup, the options page and the in-page Shadow DOM.
 */
export function brandCss(selector: string, important = false): string {
  const c = BRAND.colors;
  // Inside our Shadow DOM, !important here beats anything the page sets on
  // our host element, including its own !important rules.
  const i = important ? ' !important' : '';
  return `
${selector} {
  --lp-accent: ${c.accent}${i};
  --lp-pass: ${c.pass}${i};
  --lp-fail: ${c.fail}${i};
  --lp-neutral: ${c.neutral}${i};
  --lp-warn: ${c.warn}${i};
}
@media (prefers-color-scheme: dark) {
  ${selector} {
    --lp-accent: ${c.accentDark}${i};
    --lp-pass: ${c.passDark}${i};
    --lp-fail: ${c.failDark}${i};
    --lp-neutral: ${c.neutralDark}${i};
    --lp-warn: ${c.warnDark}${i};
  }
}`;
}

/** Adds the brand variables and name to an extension page (popup, options). */
export function applyBrand(doc: Document = document): void {
  const style = doc.createElement('style');
  style.textContent = brandCss(':root');
  doc.head.append(style);
  doc.title = doc.title.replace('LinkPeek', BRAND.name);
  for (const el of doc.querySelectorAll('[data-brand-name]')) el.textContent = BRAND.name;
}
