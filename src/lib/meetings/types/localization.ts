/**
 * @fileoverview Domain Types for Meeting Multi-Language & Localization System.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Supported Locales: 'en' (English), 'fr' (French), 'es' (Spanish), 'pt' (Portuguese).
 * - Zero 'any' policy strictly enforced.
 */

export type SupportedMeetingLocale = 'en' | 'fr' | 'es' | 'pt';

export interface MeetingTranslationDictionary {
  bookSession: string;
  selectDateAndTime: string;
  selectTimezone: string;
  yourDetails: string;
  fullName: string;
  emailAddress: string;
  phoneNumber: string;
  confirmBooking: string;
  bookingConfirmed: string;
  rescheduleBooking: string;
  cancelBooking: string;
  rateSession: string;
  leaveFeedback: string;
  submitReview: string;
  thankYou: string;
}
