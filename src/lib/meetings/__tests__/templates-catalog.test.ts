import { describe, it, expect } from 'vitest';
import { STANDARD_MEETING_TEMPLATES } from '../templates-catalog';

describe('Meeting Templates Catalog', () => {
  it('provides predefined standard industry templates with questions and durations', () => {
    expect(STANDARD_MEETING_TEMPLATES.length).toBeGreaterThanOrEqual(5);

    const salesDemo = STANDARD_MEETING_TEMPLATES.find(t => t.id === 'tmpl_sales_demo');
    expect(salesDemo).toBeDefined();
    expect(salesDemo?.durationMinutes).toBe(30);
    expect(salesDemo?.defaultQuestions.length).toBeGreaterThanOrEqual(1);

    const webinar = STANDARD_MEETING_TEMPLATES.find(t => t.id === 'tmpl_webinar');
    expect(webinar?.format).toBe('group');
  });
});
