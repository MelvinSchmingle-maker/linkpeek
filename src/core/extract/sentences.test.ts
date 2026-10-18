import { describe, expect, it } from 'vitest';
import { firstSentence } from './sentences';

describe('the opening sentence', () => {
  it('is the first sentence of the text', () => {
    expect(firstSentence('The council approved the new bridge on Tuesday. Work starts next spring.')).toBe(
      'The council approved the new bridge on Tuesday.',
    );
  });

  it('skips a licence notice printed before the abstract (arXiv prints one on the first page)', () => {
    const text =
      'Provided proper attribution is provided, Google hereby grants permission to reproduce the tables and figures in this paper solely for use in journalism or scholarly works. ' +
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.';
    expect(firstSentence(text)).toMatch(/^The dominant sequence transduction models/);
  });

  it('skips an author block with email addresses, so the abstract opens the text (arXiv first page)', () => {
    const text =
      'Attention Is All You Need Ashish Vaswani Google Brain avaswani@google.com Noam Shazeer Google Brain noam@google.com ' +
      'Abstract The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.';
    expect(firstSentence(text)).toMatch(/^The dominant sequence transduction/);
  });

  it('still returns the notice when it is all there is', () => {
    expect(firstSentence('All rights reserved.')).toBe('All rights reserved.');
  });
});
