import { BRAND } from '../brand';

/** Puts brand colours on an element as CSS variables (--lp-accent etc). */
export function applyBrandColors(el: HTMLElement): void {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const c = BRAND.colors;
  const pick = (light: string, darkValue: string) => (dark ? darkValue : light);
  el.style.setProperty('--lp-accent', pick(c.accent, c.accentDark));
  el.style.setProperty('--lp-pass', pick(c.pass, c.passDark));
  el.style.setProperty('--lp-fail', pick(c.fail, c.failDark));
  el.style.setProperty('--lp-neutral', pick(c.neutral, c.neutralDark));
  el.style.setProperty('--lp-warn', pick(c.warn, c.warnDark));
}
