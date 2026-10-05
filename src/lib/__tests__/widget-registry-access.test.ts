import { describe, it, expect, vi } from 'vitest';
import { isWidgetPermitted, STATIC_WIDGETS } from '../widget-registry';

describe('isWidgetPermitted', () => {
  it('allows all widgets when isSystemAdmin is true', () => {
    const can = vi.fn().mockReturnValue(false);
    const widget = STATIC_WIDGETS[0];
    expect(isWidgetPermitted(widget, can, true)).toBe(true);
    expect(can).not.toHaveBeenCalled();
  });

  it('checks specific permissions for taskWidget', () => {
    const can = vi.fn().mockImplementation((section, feature, action) => {
      return section === 'operations' && feature === 'tasks' && action === 'view';
    });

    const taskWidget = STATIC_WIDGETS.find((w) => w.id === 'taskWidget')!;

    expect(isWidgetPermitted(taskWidget, can, false)).toBe(true);

    const denyCan = vi.fn().mockReturnValue(false);
    expect(isWidgetPermitted(taskWidget, denyCan, false)).toBe(false);
  });

  it('checks specific permissions for pipeline widgets', () => {
    const can = vi.fn().mockImplementation((section, feature, action) => {
      return section === 'operations' && feature === 'pipeline' && action === 'view';
    });

    const pipelineWidget = STATIC_WIDGETS.find((w) => w.id === 'pipelinePieChart')!;

    expect(isWidgetPermitted(pipelineWidget, can, false)).toBe(true);

    const denyCan = vi.fn().mockReturnValue(false);
    expect(isWidgetPermitted(pipelineWidget, denyCan, false)).toBe(false);
  });
});
