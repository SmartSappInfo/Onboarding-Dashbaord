import { describe, it, expect } from 'vitest';
import { generateConferenceSession, formatConferenceDetails } from '../conference-adapters';

describe('Conference Adapters', () => {
  it('should generate valid Google Meet session', () => {
    const session = generateConferenceSession({
      meetingId: 'm123',
      workspaceId: 'ws1',
      provider: 'google_meet',
      title: 'Consultation Session',
      externalMeetingId: 'abc-defg-hij',
    });

    expect(session.provider).toBe('google_meet');
    expect(session.joinUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(session.status).toBe('active');

    const formatted = formatConferenceDetails(session);
    expect(formatted.providerLabel).toBe('Google Meet');
    expect(formatted.isPhysical).toBe(false);
    expect(formatted.iconName).toBe('video');
  });

  it('should generate valid Physical / In-Person session', () => {
    const session = generateConferenceSession({
      meetingId: 'm456',
      workspaceId: 'ws1',
      provider: 'physical',
      title: 'Board Meeting',
      physicalAddress: '123 Independence Ave, Accra',
    });

    expect(session.provider).toBe('physical');
    expect(session.joinUrl).toBeUndefined();
    expect(session.physicalAddress).toBe('123 Independence Ave, Accra');

    const formatted = formatConferenceDetails(session);
    expect(formatted.isPhysical).toBe(true);
    expect(formatted.displayTitle).toBe('123 Independence Ave, Accra');
    expect(formatted.iconName).toBe('map-pin');
  });

  it('should format dial-in information with PIN correctly', () => {
    const session = generateConferenceSession({
      meetingId: 'm789',
      workspaceId: 'ws1',
      provider: 'zoom',
      title: 'Global Call',
      dialIn: { phone: '+1-555-0199', pin: '123456' },
    });

    const formatted = formatConferenceDetails(session);
    expect(formatted.dialInText).toBe('Dial: +1-555-0199 (PIN: 123456)');
  });
});
