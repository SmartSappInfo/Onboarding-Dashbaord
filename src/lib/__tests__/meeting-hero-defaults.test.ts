import { describe, it, expect } from 'vitest';
import {
  getHeroTitle,
  getHeroDescription,
  getHeroCtaLabel,
  getMeetingHeroDefaults,
} from '@/lib/meeting-hero-defaults';

describe('meeting-hero-defaults', () => {
  it('returns updated parent engagement default title and description', () => {
    const defaults = getMeetingHeroDefaults('parent');
    expect(defaults.title).toBe("We're Digitalizing {{entity_name}} to Serve You Better");
    expect(defaults.description).toBe(
      "Join us for an essential orientation session to learn how we've improved security and safety of your child, made it easy for parents to be involved in their children's school life, and how we support your child's growth."
    );
  });

  it('interpolates {{entity_name}} token in hero title and description', () => {
    const title = getHeroTitle('parent', 'St. Peters Academy');
    expect(title).toBe("We're Digitalizing St. Peters Academy to Serve You Better");

    const desc = getHeroDescription('parent', 'St. Peters Academy');
    expect(desc).toContain("Join us for an essential orientation session");
  });

  it('supports legacy {{school}} token interpolation for backwards compatibility', () => {
    const title = getHeroTitle('custom', 'Greenfield High', "Welcome to {{school}}");
    expect(title).toBe("Welcome to Greenfield High");

    const desc = getHeroDescription('custom', 'Greenfield High', "Learn more about {{school}}'s achievements.");
    expect(desc).toBe("Learn more about Greenfield High's achievements.");
  });

  it('prefers custom overrides when provided', () => {
    const customTitle = 'Exclusive Parent-Teacher Forum';
    const title = getHeroTitle('parent', 'Oakridge', customTitle);
    expect(title).toBe(customTitle);
  });

  it('resolves CTA labels correctly', () => {
    expect(getHeroCtaLabel('webinar')).toBe('Register Now');
    expect(getHeroCtaLabel('webinar', 'RSVP Today')).toBe('RSVP Today');
    expect(getHeroCtaLabel('parent')).toBeUndefined();
  });
});
