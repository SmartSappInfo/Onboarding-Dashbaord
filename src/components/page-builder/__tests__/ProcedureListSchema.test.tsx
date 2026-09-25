import { describe, it, expect } from 'vitest';
import {
  procedureStepItemSchema,
  procedureBlockSchema,
  type ProcedureStepItem,
  type ProcedureBlockProps,
} from '@/lib/page-builder/blocks/procedure-list';

describe('Procedure Block Schema & Backward Compatibility', () => {
  it('parses legacy flat string steps into normalized rich step items', () => {
    const rawLegacyData = {
      title: 'Payment Steps',
      steps: [
        'Transfer the exact amount to the account above.',
        'Use your student ID as the reference.',
        'Keep your receipt for confirmation.',
      ],
    };

    const parsed: ProcedureBlockProps = procedureBlockSchema.parse(rawLegacyData);

    expect(parsed.title).toBe('Payment Steps');
    expect(parsed.steps).toHaveLength(3);
    expect(parsed.steps[0].title).toBe('Transfer the exact amount to the account above.');
    expect(parsed.steps[0].description).toBe('');
    expect(parsed.steps[0].id).toBeDefined();
    expect(parsed.steps[1].title).toBe('Use your student ID as the reference.');
    expect(parsed.steps[2].title).toBe('Keep your receipt for confirmation.');
    expect(parsed.preset).toBe('connected-timeline');
    expect(parsed.mediaPosition).toBe('top');
  });

  it('parses rich step objects with title, description, timeEstimate, and badgeText', () => {
    const rawRichData = {
      title: 'USSD MoMo Payment',
      subtitle: 'Complete your tuition fees in under 2 minutes',
      preset: 'elevated-cards' as const,
      accentColor: '#3b82f6',
      mediaPosition: 'left' as const,
      steps: [
        {
          id: 'step-1',
          title: 'Dial Shortcode *170#',
          description: 'Open your phone dialer and enter the merchant code.',
          timeEstimate: '30s',
          badgeText: 'Required',
        },
        {
          id: 'step-2',
          title: 'Select Paybill & Enter Merchant ID',
          description: 'Enter merchant ID 948201.',
          timeEstimate: '45s',
          badgeText: 'Stage 2',
        },
      ],
    };

    const parsed: ProcedureBlockProps = procedureBlockSchema.parse(rawRichData);

    expect(parsed.title).toBe('USSD MoMo Payment');
    expect(parsed.subtitle).toBe('Complete your tuition fees in under 2 minutes');
    expect(parsed.preset).toBe('elevated-cards');
    expect(parsed.accentColor).toBe('#3b82f6');
    expect(parsed.mediaPosition).toBe('left');
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].id).toBe('step-1');
    expect(parsed.steps[0].title).toBe('Dial Shortcode *170#');
    expect(parsed.steps[0].description).toBe('Open your phone dialer and enter the merchant code.');
    expect(parsed.steps[0].timeEstimate).toBe('30s');
    expect(parsed.steps[0].badgeText).toBe('Required');
  });

  it('safely normalizes mixed legacy strings and rich objects in the same array', () => {
    const mixedData = {
      title: 'Mixed Onboarding Steps',
      steps: [
        'Complete user profile',
        {
          id: 'step-rich',
          title: 'Upload Verification Document',
          description: 'Submit government ID or student card.',
          badgeText: 'Action Required',
        },
      ],
    };

    const parsed: ProcedureBlockProps = procedureBlockSchema.parse(mixedData);

    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].title).toBe('Complete user profile');
    expect(parsed.steps[0].id).toBeDefined();
    expect(parsed.steps[1].title).toBe('Upload Verification Document');
    expect(parsed.steps[1].description).toBe('Submit government ID or student card.');
    expect(parsed.steps[1].badgeText).toBe('Action Required');
  });

  it('normalizes legacy `items` property into `steps` if `steps` is omitted', () => {
    const dataWithItems = {
      title: 'SOP Steps',
      items: [
        { title: 'Step 1: Reconcile daily cash receipts', description: 'Match receipts against daily bank slips' },
        { title: 'Step 2: Post to student ledger', description: 'Update term balance' },
      ],
    };

    const parsed: ProcedureBlockProps = procedureBlockSchema.parse(dataWithItems);

    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].title).toBe('Step 1: Reconcile daily cash receipts');
    expect(parsed.steps[0].description).toBe('Match receipts against daily bank slips');
    expect(parsed.steps[1].title).toBe('Step 2: Post to student ledger');
  });

  it('provides sensible defaults when empty object is passed', () => {
    const parsed: ProcedureBlockProps = procedureBlockSchema.parse({});

    expect(parsed.title).toBe('Procedure Guide');
    expect(parsed.subtitle).toBe('');
    expect(parsed.preset).toBe('connected-timeline');
    expect(parsed.steps).toEqual([]);
    expect(parsed.mediaPosition).toBe('top');
    expect(parsed.accentColor).toBe('#10b981');
    expect(parsed.showStepNumbers).toBe(true);
  });
});
