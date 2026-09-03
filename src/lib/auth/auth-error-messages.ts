/**
 * @fileOverview User-friendly Firebase Authentication Error Formatter.
 *
 * Translates low-level Firebase Auth error codes and raw Google OAuth/REST API responses
 * into friendly, actionable user messages, preventing raw JSON or technical stack dumps in toasts.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Zero `any` or `any[]` typing.
 * - Handles both structured FirebaseError (with .code) and raw error strings / exceptions.
 * - Sanitizes raw OAuth URLs, HTTP status codes, and JSON error responses.
 */

export interface FriendlyAuthError {
  title: string;
  description: string;
  code?: string;
}

export type AuthContext = 'login' | 'google-login' | 'signup' | 'google-signup';

export function formatAuthError(
  error: unknown,
  context: AuthContext = 'login'
): FriendlyAuthError {
  let errorCode: string | undefined;
  let rawMessage = '';

  if (typeof error === 'object' && error !== null) {
    if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
      errorCode = (error as { code: string }).code;
    }
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      rawMessage = (error as { message: string }).message;
    }
  } else if (typeof error === 'string') {
    rawMessage = error;
  }

  // Check if the error is related to Google OAuth / userinfo endpoint (e.g. 401 unauthenticated token)
  const isGoogleOAuthUserinfoError =
    rawMessage.includes('googleapis.com/oauth2/v1/userinfo') ||
    rawMessage.includes('UNAUTHENTICATED') ||
    rawMessage.includes('Request is missing required authentication credential');

  // 1. Google OAuth Credential Failure (specifically targeting the 401 userinfo failure)
  if (isGoogleOAuthUserinfoError || (context.startsWith('google') && errorCode === 'auth/invalid-credential')) {
    return {
      title: 'Google Sign-In Expired',
      description:
        'Your Google session has expired or could not be verified. Please select your Google account and try again.',
      code: errorCode || 'auth/invalid-credential',
    };
  }

  // 2. Specific Firebase Auth Error Codes
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      if (context.startsWith('google')) {
        return {
          title: 'Google Sign-In Failed',
          description:
            'Unable to authenticate with Google. Please try selecting your account again or log in with your email and password.',
          code: errorCode,
        };
      }
      return {
        title: 'Invalid Credentials',
        description: 'Invalid email or password. Please verify your details and try again.',
        code: errorCode,
      };

    case 'auth/user-disabled':
      return {
        title: 'Account Disabled',
        description: 'This account has been deactivated. Please contact your organization administrator for access.',
        code: errorCode,
      };

    case 'auth/too-many-requests':
      return {
        title: 'Too Many Attempts',
        description:
          'Too many unsuccessful attempts. Access has been temporarily paused for security. Please try again in a few minutes.',
        code: errorCode,
      };

    case 'auth/network-request-failed':
      return {
        title: 'Connection Error',
        description: 'Unable to reach authentication servers. Please check your internet connection and try again.',
        code: errorCode,
      };

    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        title: 'Sign-In Cancelled',
        description: 'The Google sign-in window was closed before finishing. Please click the button to try again.',
        code: errorCode,
      };

    case 'auth/popup-blocked':
      return {
        title: 'Popup Blocked',
        description:
          'The sign-in popup was blocked by your browser. Please allow popups for this site or use redirect sign-in.',
        code: errorCode,
      };

    case 'auth/account-exists-with-different-credential':
      return {
        title: 'Account Already Exists',
        description:
          'An account already exists with this email using a different sign-in method. Please log in with your original method.',
        code: errorCode,
      };

    case 'auth/email-already-in-use':
      return {
        title: 'Email Already Registered',
        description: 'An account with this email address already exists. Please sign in instead.',
        code: errorCode,
      };

    case 'auth/weak-password':
      return {
        title: 'Password Too Weak',
        description: 'Please choose a stronger password with at least 8 characters including letters and numbers.',
        code: errorCode,
      };

    case 'auth/unauthorized-domain':
      return {
        title: 'Unauthorized Domain',
        description: 'This application domain is not authorized for sign-in. Please contact your administrator.',
        code: errorCode,
      };

    default:
      // If rawMessage contains raw JSON or internal technical dumps, mask them
      if (
        rawMessage.includes('{') ||
        rawMessage.includes('https://') ||
        rawMessage.includes('Firebase:') ||
        rawMessage.length > 120
      ) {
        return {
          title: context.startsWith('google') ? 'Google Sign-In Failed' : 'Authentication Failed',
          description: context.startsWith('google')
            ? 'Unable to complete Google sign-in. Please try again or use email and password.'
            : 'An unexpected authentication error occurred. Please verify your connection and try again.',
          code: errorCode,
        };
      }

      return {
        title: context.startsWith('google') ? 'Google Sign-In Failed' : 'Authentication Error',
        description: rawMessage || 'An unexpected error occurred. Please try again.',
        code: errorCode,
      };
  }
}
