import { describe, it, expect } from 'vitest';
import { extractActionItemsFromTranscript } from '../action-items-service';

describe('AI Action Items & Commitment Extractor', () => {
  it('extracts actionable commitments and detects buying signals and objections', () => {
    const transcript = `
Host: Thanks for joining today.
Client: We will send over the signed contract today, we are ready to buy.
Host: Great! I will follow up with the onboarding documentation asap.
Client: We have a concern about competitor pricing.
    `;

    const items = extractActionItemsFromTranscript(transcript, 'm123', 'w123');

    expect(items.length).toBe(3);

    // First item: Buying signal
    expect(items[0].title).toContain('signed contract');
    expect(items[0].buyingSignalDetected).toBe('Budget/Purchasing intent expressed');

    // Second item: Urgent priority
    expect(items[1].title).toContain('onboarding documentation');
    expect(items[1].priority).toBe('high');

    // Third item: Objection
    expect(items[2].title).toContain('concern about competitor');
    expect(items[2].objectionDetected).toBe('Cost or competitor hesitation flagged');
  });

  it('handles empty transcript gracefully', () => {
    const items = extractActionItemsFromTranscript('', 'm1', 'w1');
    expect(items).toEqual([]);
  });
});
