/**
 * The free, on-device summary: the article's most informative sentence, in
 * the article's own words, fitted to 20 words.
 *
 * News articles put the main point first, so the opening sentence starts
 * with a head start. Other sentences can win if they share more of the
 * headline's key words, carry numbers or names, and stand on their own (no
 * "He said" or "This means" that needs the sentence before). Questions and
 * quotes do badly: they rarely say what happened.
 *
 * The card labels this "In the article's own words", because LinkPeek chose
 * the words but didn't write them.
 */
import { sentences } from '../extract/sentences';
import type { SummaryFlag } from '../types';
import { enforceLimit, trimAtClause } from './enforce';
import type { SummaryInput, SummaryOutcome, SummaryProvider } from './provider';
import { qualityProblem } from './quality';
import { countWords } from './wordcount';

/** Only the start of an article is read for candidates: the main point is rarely further in. */
const PARAGRAPHS_READ = 12;
const SENTENCES_TRIED = 8;

const STOPWORDS = new Set(
  (
    'a an the and or but of to in on at for with by from as is are was were be been has have had it its this that these those ' +
    'he she they we you i his her their our your my not no so if than then there here what why how who when where which will ' +
    'would can could should may might must do does did after before over under about into out up down new says said'
  ).split(' '),
);

const NEEDS_CONTEXT = /^(he|she|it|they|this|that|these|those|his|her|their|its|there|such|also|however|meanwhile|but|and|so)\b/i;
const QUOTE_START = /^["“‘']/;

interface Candidate {
  text: string;
  score: number;
}

export class ExtractiveProvider implements SummaryProvider {
  readonly name = 'extractive' as const;

  async summarise(input: SummaryInput): Promise<SummaryOutcome> {
    if (input.evidence === 'full' && input.paragraphs?.length) return this.fromArticle(input);
    if (input.evidence === 'partial' && input.previewText) return this.fromPreview(input);
    // Headline only, or nothing read: no summary. A headline is not a summary of an article.
    return { ok: false, provider: this.name, reason: 'insufficient' };
  }

  private async fromArticle(input: SummaryInput): Promise<SummaryOutcome> {
    const candidates = rank(input.paragraphs!.slice(0, PARAGRAPHS_READ), input.headline).slice(0, SENTENCES_TRIED);
    let reason: 'over-limit' | 'filtered' = 'filtered';
    for (const c of candidates) {
      const fitted = await enforceLimit(c.text);
      if (!fitted.ok) {
        reason = 'over-limit';
        continue;
      }
      if (qualityProblem(fitted.text, input.headline)) continue;
      const flags: SummaryFlag[] = fitted.how === 'trimmed' ? ['trimmed'] : [];
      return { ok: true, summary: { text: fitted.text, wordCount: fitted.wordCount, provider: this.name, evidence: 'full', flags } };
    }
    return { ok: false, provider: this.name, reason };
  }

  private async fromPreview(input: SummaryInput): Promise<SummaryOutcome> {
    // A preview cut off by Part 04 ends in "…": its last sentence is incomplete,
    // so only whole sentences are used, or a clause cut from the one sentence.
    const cutOff = /…$/.test(input.previewText!);
    const text = input.previewText!.replace(/\s*…$/, '');
    const parts = sentences(text);
    const attempts =
      cutOff && parts.length === 1
        ? [trimAtClause(text) ?? '']
        : [(cutOff ? parts.slice(0, -1) : parts).join(' '), parts[0] ?? ''];
    for (const attempt of attempts) {
      if (!attempt) continue;
      const fitted = await enforceLimit(attempt);
      if (!fitted.ok || qualityProblem(fitted.text, input.headline)) continue;
      const flags: SummaryFlag[] = ['preview', ...(fitted.how === 'trimmed' ? (['trimmed'] as const) : [])];
      return { ok: true, summary: { text: fitted.text, wordCount: fitted.wordCount, provider: this.name, evidence: 'partial', flags } };
    }
    return { ok: false, provider: this.name, reason: 'over-limit' };
  }
}

/** Every sentence of the opening paragraphs, best first. */
export function rank(paragraphs: string[], headline: string): Candidate[] {
  const keyWords = contentWords(headline);
  const out: Candidate[] = [];
  paragraphs.forEach((p, pi) => {
    sentences(p).forEach((text, si) => {
      const n = countWords(text);
      if (n < 6) return;
      let score = 0;
      if (pi === 0 && si === 0) score += 3; // The opening sentence.
      score += Math.max(0, 2 - 0.25 * pi) - 0.3 * si;
      if (n >= 10 && n <= 30) score += 1;
      else if (n > 45) score -= 1;
      if (keyWords.size) {
        const own = contentWords(text);
        let shared = 0;
        for (const w of keyWords) if (own.has(w)) shared++;
        score += (2 * shared) / keyWords.size;
      }
      if (/\p{N}/u.test(text)) score += 0.5;
      if ((text.slice(1).match(/\b\p{Lu}\p{Ll}+/gu) ?? []).length >= 2) score += 0.5;
      if (NEEDS_CONTEXT.test(text)) score -= 1.5;
      // Quotes give someone's view, rarely what happened.
      if (QUOTE_START.test(text)) score -= 3;
      if (/\?["'”’)]*$/.test(text)) score -= 3;
      // Mostly capitalised words: a heading or a caption, not a sentence.
      const caps = (text.match(/\b\p{Lu}/gu) ?? []).length;
      if (n >= 6 && caps / n > 0.6) score -= 2;
      out.push({ text, score });
    });
  });
  return out.sort((a, b) => b.score - a.score);
}

/** Key words, lightly stemmed so "reopens" matches "reopened". */
function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map((w) => (w.length > 4 ? w.replace(/(?:ing|ed|es|s)$/, '') : w)),
  );
}
