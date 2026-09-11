import { describe, it, expect } from 'vitest';
import { resolveStepperLabel } from '../stepper-label';

/**
 * Covers the stepper/funnel label resolver.
 *
 * Regression origin: section titles are rich text, and the stepper rendered the raw
 * value into a text sink, so a Word paste printed
 * `<SPAN STYLE="COLOR: RGB(15, 23, 42)">` as the step label on live surveys.
 *
 * These assertions import the shipped function — they do not re-implement the
 * precedence rules locally.
 */
describe('resolveStepperLabel', () => {
  describe('precedence', () => {
    it('prefers stepperTitle over title', () => {
      expect(resolveStepperLabel({ stepperTitle: 'Profile', title: 'Entity Profile' }, 1)).toBe(
        'Profile',
      );
    });

    it('falls back to title when stepperTitle is absent', () => {
      expect(resolveStepperLabel({ title: 'Upload Staff Data' }, 1)).toBe('Upload Staff Data');
    });

    it('falls back to title when stepperTitle is empty or whitespace', () => {
      expect(resolveStepperLabel({ stepperTitle: '', title: 'Upload Staff Data' }, 1)).toBe(
        'Upload Staff Data',
      );
      expect(resolveStepperLabel({ stepperTitle: '   ', title: 'Upload Staff Data' }, 1)).toBe(
        'Upload Staff Data',
      );
    });

    it('falls back to the numbered label when nothing usable is present', () => {
      expect(resolveStepperLabel({}, 3)).toBe('Step 3');
      expect(resolveStepperLabel(undefined, 2)).toBe('Step 2');
      expect(resolveStepperLabel(null, 5)).toBe('Step 5');
    });
  });

  describe('markup safety', () => {
    it('strips the Word-paste markup that leaked into the live stepper', () => {
      const section = {
        title: '<span style="color: rgb(15, 23, 42)">Upload Staff Data</span>',
      };
      expect(resolveStepperLabel(section, 1)).toBe('Upload Staff Data');
    });

    it('strips markup from stepperTitle too', () => {
      expect(resolveStepperLabel({ stepperTitle: '<b>Profile</b>' }, 1)).toBe('Profile');
    });

    it('handles double-encoded markup', () => {
      expect(resolveStepperLabel({ title: '&lt;em&gt;Online Presence&lt;/em&gt;' }, 4)).toBe(
        'Online Presence',
      );
    });

    it('falls back to the numbered label when the title is markup only', () => {
      expect(resolveStepperLabel({ title: '<span></span>' }, 2)).toBe('Step 2');
    });

    it('never returns a string containing a tag', () => {
      const section = { title: '<div><script>alert(1)</script></div>' };
      expect(resolveStepperLabel(section, 1)).not.toMatch(/<[^>]+>/);
    });

    it('flattens multi-line titles so a clamped label keeps its line budget', () => {
      expect(resolveStepperLabel({ title: 'Parent\n\nStudent Data' }, 1)).toBe(
        'Parent Student Data',
      );
    });
  });

  describe('visibility', () => {
    // A section hidden by survey logic must not leak its title into the progress bar.
    it('returns the numbered label when the section is hidden', () => {
      expect(
        resolveStepperLabel({ title: 'Secret Section' }, 2, { isSectionVisible: false }),
      ).toBe('Step 2');
    });

    it('returns the title when the section is explicitly visible', () => {
      expect(
        resolveStepperLabel({ title: 'Visible Section' }, 2, { isSectionVisible: true }),
      ).toBe('Visible Section');
    });

    it('treats an omitted visibility flag as visible', () => {
      expect(resolveStepperLabel({ title: 'Visible Section' }, 2)).toBe('Visible Section');
    });
  });
});
