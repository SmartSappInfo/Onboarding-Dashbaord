import { describe, it, expect } from 'vitest';
import { normalizeFormEntityCapture } from '../tracking-utils';
import type { FormSubmissionActions } from '../types';

describe('Form Lead & Entity Capture Normalization', () => {
  it('should default bound forms to enabled entity capture', () => {
    const result = normalizeFormEntityCapture('bound', undefined);
    expect(result.enabled).toBe(true);
    expect(result.entityScope).toBe('workspace_default');
    expect(result.handlingStrategy).toBe('create_or_update');
    expect(result.leadSource).toBe('');
    expect(result.autoAssign).toBe(false);
  });

  it('should default global forms to disabled entity capture unless specified', () => {
    const result = normalizeFormEntityCapture('global', undefined);
    expect(result.enabled).toBe(false);
    expect(result.entityScope).toBe('workspace_default');
    expect(result.handlingStrategy).toBe('create_or_update');
  });

  it('should preserve legacy entityHandling strategy for bound forms', () => {
    const actions: Partial<FormSubmissionActions> = {
      entityHandling: 'create_new',
    };
    const result = normalizeFormEntityCapture('bound', actions);
    expect(result.enabled).toBe(true);
    expect(result.handlingStrategy).toBe('create_new');
  });

  it('should respect custom entityCapture settings for global forms', () => {
    const actions: Partial<FormSubmissionActions> = {
      entityCapture: {
        enabled: true,
        entityScope: 'institution',
        handlingStrategy: 'update_matching',
        leadSource: 'Webinar Signup Form',
        autoAssign: true,
      },
    };
    const result = normalizeFormEntityCapture('global', actions);
    expect(result.enabled).toBe(true);
    expect(result.entityScope).toBe('institution');
    expect(result.handlingStrategy).toBe('update_matching');
    expect(result.leadSource).toBe('Webinar Signup Form');
    expect(result.autoAssign).toBe(true);
  });

  it('should sanitize leadSource string whitespace', () => {
    const actions: Partial<FormSubmissionActions> = {
      entityCapture: {
        enabled: true,
        leadSource: '   Demo Form Request   ',
      },
    };
    const result = normalizeFormEntityCapture('global', actions);
    expect(result.leadSource).toBe('Demo Form Request');
  });
});
