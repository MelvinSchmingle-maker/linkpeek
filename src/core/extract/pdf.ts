/**
 * Reads the text of a PDF with pdf.js (Mozilla). Only the first pages: long
 * reports are marked as partly read. Runs in the offscreen document.
 *
 * Scanned PDFs have no text layer; they come back with no words, and are
 * reported as "couldn't find the text", never guessed at.
 */
import * as pdfjs from 'pdfjs-dist';
import { wordCount } from '../detect/classify';
import type { PdfExtraction } from './assess';

export const MAX_PDF_PAGES = 15;

let workerSet = false;

export async function extractPdf(bytes: Uint8Array, workerUrl: string): Promise<PdfExtraction> {
  if (!workerSet) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerSet = true;
  }
  const task = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true, // text only: no fonts, no rendering
    isOffscreenCanvasSupported: false,
    enableXfa: false,
    stopAtErrors: false,
  });
  const doc = await task.promise;
  try {
    const pagesRead = Math.min(doc.numPages, MAX_PDF_PAGES);
    const parts: string[] = [];
    for (let i = 1; i <= pagesRead; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
      page.cleanup();
    }
    const text = parts.join('\n').replace(/\s+/g, ' ').trim();
    let title: string | undefined;
    try {
      const info = (await doc.getMetadata()).info as { Title?: unknown } | undefined;
      if (typeof info?.Title === 'string' && info.Title.trim()) title = info.Title.trim();
    } catch {
      // No metadata.
    }
    return { text, words: wordCount(text), pagesRead, totalPages: doc.numPages, title };
  } finally {
    await task.destroy();
  }
}
