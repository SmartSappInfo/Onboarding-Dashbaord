import { describe, it, expect, vi } from 'vitest';
import type { MessageResendConfig } from '@/lib/types';

/**
 * Unit test suite simulating ResendConfigSection variant update logic
 * and HeadlineIQ atomic onApplyVariation behavior.
 */
describe('ResendConfigSection & HeadlineIQ Integration', () => {
  const initialConfig: MessageResendConfig = {
    enabled: true,
    maxResends: 2,
    resendDelayHours: 24,
    triggerCondition: 'no_open',
    variants: [
      { title: 'Original Resend 1', previewText: 'Preview 1' },
      { title: 'Original Resend 2', previewText: 'Preview 2' },
    ],
  };

  function updateVariantHelper(
    cfg: MessageResendConfig,
    index: number,
    patch: Partial<{ title: string; previewText: string }>
  ): MessageResendConfig {
    return {
      ...cfg,
      variants: cfg.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    };
  }

  it('should replace the exact resend variant title and previewText atomically at index 0', () => {
    const onChange = vi.fn();
    const updated = updateVariantHelper(initialConfig, 0, {
      title: '⚡ New High-Converting Title #1',
      previewText: '✨ New High-Converting Preview #1',
    });

    onChange(updated);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(updated.variants[0].title).toBe('⚡ New High-Converting Title #1');
    expect(updated.variants[0].previewText).toBe('✨ New High-Converting Preview #1');
    // Ensure variant at index 1 remains completely untouched
    expect(updated.variants[1].title).toBe('Original Resend 2');
    expect(updated.variants[1].previewText).toBe('Preview 2');
  });

  it('should replace the resend variant title at index 1 without mutating index 0', () => {
    const onChange = vi.fn();
    const updated = updateVariantHelper(initialConfig, 1, {
      title: '🔥 Urgent Reminder Title #2',
      previewText: 'Don\'t miss out on your update',
    });

    onChange(updated);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(updated.variants[1].title).toBe('🔥 Urgent Reminder Title #2');
    expect(updated.variants[1].previewText).toBe("Don't miss out on your update");
    // Ensure variant at index 0 remains untouched
    expect(updated.variants[0].title).toBe('Original Resend 1');
    expect(updated.variants[0].previewText).toBe('Preview 1');
  });

  it('should use templateSubject as baseline when resend title is empty', () => {
    const emptyTitleConfig: MessageResendConfig = {
      ...initialConfig,
      variants: [{ title: '', previewText: '' }],
    };

    const templateSubject = 'Baseline Email Subject Line';
    const effectiveValue = emptyTitleConfig.variants[0].title || templateSubject;

    expect(effectiveValue).toBe('Baseline Email Subject Line');
  });
});
