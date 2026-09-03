import { describe, it, expect } from 'vitest';
import { formatAuthError } from '../auth-error-messages';

describe('formatAuthError', () => {
  it('should format the raw Google OAuth 401 userinfo failure into a friendly message', () => {
    const rawGoogleError = {
      code: 'auth/invalid-credential',
      message: `Firebase: Failed to fetch resource from https://www.googleapis.com/oauth2/v1/userinfo, http status: 401, http response: {
  "error": {
    "code": 401,
    "message": "Request is missing required authentication credential. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project.",
    "status": "UNAUTHENTICATED"
  }
} (auth/invalid-credential).`,
    };

    const result = formatAuthError(rawGoogleError, 'google-login');

    expect(result.title).toBe('Google Sign-In Expired');
    expect(result.description).toBe(
      'Your Google session has expired or could not be verified. Please select your Google account and try again.'
    );
    expect(result.description).not.toContain('googleapis.com');
    expect(result.description).not.toContain('401');
    expect(result.description).not.toContain('UNAUTHENTICATED');
  });

  it('should format auth/invalid-credential for email/password login', () => {
    const error = { code: 'auth/invalid-credential', message: 'Invalid credentials' };
    const result = formatAuthError(error, 'login');

    expect(result.title).toBe('Invalid Credentials');
    expect(result.description).toBe('Invalid email or password. Please verify your details and try again.');
  });

  it('should format auth/user-disabled', () => {
    const error = { code: 'auth/user-disabled', message: 'User disabled' };
    const result = formatAuthError(error, 'login');

    expect(result.title).toBe('Account Disabled');
    expect(result.description).toContain('deactivated');
  });

  it('should format auth/too-many-requests', () => {
    const error = { code: 'auth/too-many-requests', message: 'Too many requests' };
    const result = formatAuthError(error, 'login');

    expect(result.title).toBe('Too Many Attempts');
    expect(result.description).toContain('temporarily paused');
  });

  it('should format auth/popup-closed-by-user', () => {
    const error = { code: 'auth/popup-closed-by-user', message: 'Popup closed' };
    const result = formatAuthError(error, 'google-login');

    expect(result.title).toBe('Sign-In Cancelled');
    expect(result.description).toContain('closed before finishing');
  });

  it('should format network error', () => {
    const error = { code: 'auth/network-request-failed', message: 'Network failed' };
    const result = formatAuthError(error, 'login');

    expect(result.title).toBe('Connection Error');
    expect(result.description).toContain('internet connection');
  });

  it('should sanitize raw stack or JSON dumps in default fallback', () => {
    const error = new Error('Firebase: internal server error { "code": 500, "details": "stack trace..." }');
    const result = formatAuthError(error, 'login');

    expect(result.title).toBe('Authentication Failed');
    expect(result.description).not.toContain('stack trace');
    expect(result.description).not.toContain('{');
  });
});
