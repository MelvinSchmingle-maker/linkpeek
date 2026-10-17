/**
 * The offscreen document: a hidden extension page with a DOM, where fetched
 * pages are parsed and read. The service worker has no DOM, and doing this in
 * the web page itself would let that page watch what LinkPeek reads.
 */
import { assessHtml, assessPdf, assessUnsupported, type Assessment } from '../core/extract/assess';
import { extractHtml } from '../core/extract/html';
import { extractPdf } from '../core/extract/pdf';
import { contentKind } from '../core/retrieve/diagnose';
import { fromBase64, type RawFetch } from '../core/retrieve/fetcher';
import { summarise, providersFor } from '../core/summary/engine';
import { summaryInputFor, type ReadText } from '../core/summary/input';
import type { SummaryEngine } from '../core/summary/provider';
import { isOffscreenRequest, type OffscreenResponse } from './messages';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse: (r: OffscreenResponse) => void) => {
  if (!isOffscreenRequest(msg)) return false;
  assess(msg.raw, msg.headline, msg.engine).then(
    (assessment) => sendResponse({ ok: true, assessment }),
    (e: unknown) => sendResponse({ ok: false, error: String(e) }),
  );
  return true;
});

async function assess(raw: RawFetch, headline: string, engine: SummaryEngine): Promise<Assessment> {
  const meta = { requestedUrl: raw.requestedUrl, finalUrl: raw.finalUrl, status: raw.status };
  const kind = contentKind(raw.contentType, raw.finalUrl);
  if (kind === 'pdf' && raw.base64) {
    let pdf: Awaited<ReturnType<typeof extractPdf>>;
    try {
      pdf = await extractPdf(fromBase64(raw.base64), chrome.runtime.getURL('offscreen/pdf.worker.min.mjs'));
    } catch {
      return { evidence: 'unavailable', failure: 'extraction-failed' };
    }
    const paragraphs = pdf.text ? [withoutLeadingTitle(pdf.text, pdf.title).slice(0, 20_000)] : [];
    return withSummary(assessPdf(meta, pdf), { headline, url: raw.finalUrl, paragraphs }, engine);
  }
  if (kind === 'html' && raw.text !== undefined) {
    const ex = extractHtml(raw.text, raw.finalUrl);
    const a = assessHtml(meta, raw.text, ex);
    return withSummary(a, { headline, url: raw.finalUrl, paragraphs: ex.paragraphs, language: ex.language }, engine);
  }
  // An error page served as something other than HTML still counts as the error.
  if (raw.status >= 400) return assessHtml(meta, '', extractHtml('', raw.finalUrl));
  return assessUnsupported(meta);
}

/** Adds a summary when there's something honest to summarise (see core/summary/input.ts). */
async function withSummary(a: Assessment, read: ReadText, engine: SummaryEngine): Promise<Assessment> {
  const input = summaryInputFor(a, read);
  if (!input) return a;
  const summary = await summarise(input, providersFor(engine));
  return summary ? { ...a, summary } : a;
}

/** PDF text has no paragraphs, so a title at the top runs into the first sentence. Drop it when it matches the document's title. */
function withoutLeadingTitle(text: string, title: string | undefined): string {
  const t = title?.trim();
  if (!t) return text;
  const start = text.trimStart();
  return start.toLowerCase().startsWith(t.toLowerCase()) ? start.slice(t.length).trimStart() : text;
}

