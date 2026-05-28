import { describe, it, expect } from 'vitest';
import { syncElementsOnOptionChange } from '../survey-logic-utils';
import type { SurveyElement, SurveyQuestion, SurveyLogicBlock } from '../types';

describe('syncElementsOnOptionChange', () => {
  const mockElements: SurveyElement[] = [
    {
      id: 'q1',
      type: 'multiple-choice',
      title: 'First Question',
      isRequired: false,
      options: ['Red', 'Green', 'Blue'],
      defaultValue: 'Green',
    } as SurveyQuestion,
    {
      id: 'l1',
      type: 'logic',
      rules: [
        {
          sourceQuestionId: 'q1',
          operator: 'isEqualTo',
          targetValue: 'Green',
          action: { type: 'jump', targetElementId: 'q2' },
        },
      ],
    } as SurveyLogicBlock,
  ];

  it('renames targetValue and defaultValue when an option is renamed', () => {
    const updated = syncElementsOnOptionChange(mockElements, 'q1', 'Green', 'Emerald Green');

    const q1 = updated.find((e) => e.id === 'q1') as any;
    const l1 = updated.find((e) => e.id === 'l1') as any;

    expect(q1.defaultValue).toBe('Emerald Green');
    expect(l1.rules[0].targetValue).toBe('Emerald Green');
  });

  it('resets targetValue and defaultValue to empty/undefined when option is deleted', () => {
    const updated = syncElementsOnOptionChange(mockElements, 'q1', 'Green', null);

    const q1 = updated.find((e) => e.id === 'q1') as any;
    const l1 = updated.find((e) => e.id === 'l1') as any;

    expect(q1.defaultValue).toBeUndefined();
    expect(l1.rules[0].targetValue).toBe('');
  });
});
