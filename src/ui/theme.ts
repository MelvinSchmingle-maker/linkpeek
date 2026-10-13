import { BRAND } from '../brand';

/**
 * CSS variables for the brand colours, with dark-mode variants.
 * Used by the popup, the options page and the in-page Shadow DOM.
 */
export function brandCss(selector: string): string {
  const c = BRAND.colors;
  return `
${selector} {
  --lp-accent: ${c.accent};
  --lp-pass: ${c.pass};
  --lp-fail: ${c.fail};
  --lp-neutral: ${c.neutral};
  --lp-warn: ${c.warn};
}
@media (prefers-color-scheme: dark) {
  ${selector} {
    --lp-accent: ${c.accentDark};
    --lp-pass: ${c.passDark};
    --lp-fail: ${c.failDark};
    --lp-neutral: ${c.neutralDark};
    --lp-warn: ${c.warnDark};
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
