import { describe, it, expect } from 'vitest';
import { ACTIVITY_TO_AUTOMATION_TRIGGER } from '../automation-trigger-map';

describe('Automation trigger catalog', () => {
  it('should not map legacy school triggers', () => {
    expect(ACTIVITY_TO_AUTOMATION_TRIGGER.school_created).toBeUndefined();
    expect(ACTIVITY_TO_AUTOMATION_TRIGGER.SCHOOL_CREATED).toBeUndefined();
  });

  it('should map entity lifecycle activities', () => {
    expect(ACTIVITY_TO_AUTOMATION_TRIGGER.entity_created).toBe('ENTITY_CREATED');
    expect(ACTIVITY_TO_AUTOMATION_TRIGGER.pipeline_stage_changed).toBe('ENTITY_STAGE_CHANGED');
  });

  it('should map meeting registrant activities', () => {
    expect(ACTIVITY_TO_AUTOMATION_TRIGGER.meeting_registrant_added).toBe(
      'MEETING_REGISTRANT_ADDED'
    );
  });
});
