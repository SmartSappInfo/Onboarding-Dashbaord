import { describe, it, expect } from 'vitest';
import { pickOrgProviderKeys } from '../org-provider-keys';

describe('pickOrgProviderKeys', () => {
  it('returns empty when org is undefined', () => {
    expect(pickOrgProviderKeys(undefined)).toEqual({});
  });

  it('uses platform defaults when key mode is not custom', () => {
    expect(
      pickOrgProviderKeys({ smsKeyMode: 'platform', mnotifyApiKey: 'k', emailKeyMode: 'platform', resendApiKey: 'r' }),
    ).toEqual({});
  });

  it('returns the custom mNotify key only when mode is custom and key present', () => {
    expect(pickOrgProviderKeys({ smsKeyMode: 'custom', mnotifyApiKey: 'sms-key' })).toEqual({ mnotifyKey: 'sms-key' });
    expect(pickOrgProviderKeys({ smsKeyMode: 'custom' })).toEqual({});
  });

  it('returns the custom Resend key + domain when mode is custom', () => {
    expect(
      pickOrgProviderKeys({ emailKeyMode: 'custom', resendApiKey: 'rk', resendDomain: 'mail.acme.com' }),
    ).toEqual({ resendKey: 'rk', resendDomain: 'mail.acme.com' });
  });

  it('resolves both channels independently', () => {
    expect(
      pickOrgProviderKeys({
        smsKeyMode: 'custom', mnotifyApiKey: 'sms',
        emailKeyMode: 'custom', resendApiKey: 'rk', resendDomain: 'd',
      }),
    ).toEqual({ mnotifyKey: 'sms', resendKey: 'rk', resendDomain: 'd' });
  });
});
