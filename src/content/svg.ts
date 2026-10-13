/**
 * Small inline icons, built with DOM calls (never from HTML strings).
 * All are 24x24 stroke icons using currentColor, decorative (aria-hidden),
 * and always paired with a text label somewhere.
 */
const NS = 'http://www.w3.org/2000/svg';

type Shape = ['path', string] | ['circle', number, number, number];

const ICONS = {
  peek: [
    ['path', 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z'],
    ['circle', 12, 12, 3],
  ],
  pass: [
    ['circle', 12, 12, 10],
    ['path', 'M7.5 12.5l3 3 6-6.5'],
  ],
  fail: [
    ['circle', 12, 12, 10],
    ['path', 'M8.5 8.5l7 7M15.5 8.5l-7 7'],
  ],
  unknown: [
    ['circle', 12, 12, 10],
    ['path', 'M8 12h8'],
  ],
  warning: [
    ['path', 'M12 3l10 18H2L12 3z'],
    ['path', 'M12 10v5M12 18h.01'],
  ],
  close: [['path', 'M6 6l12 12M18 6L6 18']],
  thumbUp: [
    ['path', 'M7 11v9H4v-9h3zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5a2 2 0 012 2.3l-1.2 7A2 2 0 0117.3 20H7'],
  ],
  thumbDown: [
    ['path', 'M7 13V4H4v9h3zM7 13l4 8c1.5 0 2.5-1 2.5-2.5V15h5a2 2 0 002-2.3l-1.2-7A2 2 0 0017.3 4H7'],
  ],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const shape of ICONS[name] as Shape[]) {
    if (shape[0] === 'path') {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', shape[1]);
      svg.append(p);
    } else {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', String(shape[1]));
      c.setAttribute('cy', String(shape[2]));
      c.setAttribute('r', String(shape[3]));
      svg.append(c);
    }
  }
  return svg;
}
