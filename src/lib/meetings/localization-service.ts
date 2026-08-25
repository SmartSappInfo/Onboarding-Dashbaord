/**
 * @fileoverview Pure Localization Dictionaries and Locale Resolver.
 * Supports English (en), French (fr), Spanish (es), and Portuguese (pt).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Missing keys gracefully fall back to English (en).
 */

import type {
  SupportedMeetingLocale,
  MeetingTranslationDictionary,
} from './types/localization';

export const LOCALIZED_DICTIONARIES: Record<SupportedMeetingLocale, MeetingTranslationDictionary> = {
  en: {
    bookSession: 'Book a Session',
    selectDateAndTime: 'Select Date & Time',
    selectTimezone: 'Timezone',
    yourDetails: 'Your Information',
    fullName: 'Your Full Name',
    emailAddress: 'Email Address',
    phoneNumber: 'Phone Number',
    confirmBooking: 'Confirm Booking',
    bookingConfirmed: 'Booking Confirmed!',
    rescheduleBooking: 'Reschedule Booking',
    cancelBooking: 'Cancel Booking',
    rateSession: 'Rate Your Session',
    leaveFeedback: 'Leave Feedback',
    submitReview: 'Submit Review',
    thankYou: 'Thank You!',
  },
  fr: {
    bookSession: 'Réserver une session',
    selectDateAndTime: 'Sélectionnez la date et l’heure',
    selectTimezone: 'Fuseau horaire',
    yourDetails: 'Vos informations',
    fullName: 'Nom complet',
    emailAddress: 'Adresse email',
    phoneNumber: 'Numéro de téléphone',
    confirmBooking: 'Confirmer la réservation',
    bookingConfirmed: 'Réservation confirmée !',
    rescheduleBooking: 'Reprogrammer la réunion',
    cancelBooking: 'Annuler la réservation',
    rateSession: 'Évaluez votre session',
    leaveFeedback: 'Donner votre avis',
    submitReview: 'Envoyer votre avis',
    thankYou: 'Merci beaucoup !',
  },
  es: {
    bookSession: 'Reservar una sesión',
    selectDateAndTime: 'Seleccione fecha y hora',
    selectTimezone: 'Zona horaria',
    yourDetails: 'Su información',
    fullName: 'Nombre completo',
    emailAddress: 'Correo electrónico',
    phoneNumber: 'Número de teléfono',
    confirmBooking: 'Confirmar reserva',
    bookingConfirmed: '¡Reserva confirmada!',
    rescheduleBooking: 'Reprogramar reunión',
    cancelBooking: 'Cancelar reserva',
    rateSession: 'Califique su sesión',
    leaveFeedback: 'Dejar comentarios',
    submitReview: 'Enviar reseña',
    thankYou: '¡Muchas gracias!',
  },
  pt: {
    bookSession: 'Agendar uma sessão',
    selectDateAndTime: 'Selecione data e hora',
    selectTimezone: 'Fuso horário',
    yourDetails: 'Suas informações',
    fullName: 'Nome completo',
    emailAddress: 'Endereço de e-mail',
    phoneNumber: 'Número de telefone',
    confirmBooking: 'Confirmar agendamento',
    bookingConfirmed: 'Agendamento confirmado!',
    rescheduleBooking: 'Reagendar reunião',
    cancelBooking: 'Cancelar agendamento',
    rateSession: 'Avalie sua sessão',
    leaveFeedback: 'Deixar feedback',
    submitReview: 'Enviar avaliação',
    thankYou: 'Muito obrigado!',
  },
};

/**
 * Returns localized string dictionary for a requested locale.
 */
export function getMeetingTranslations(locale: SupportedMeetingLocale = 'en'): MeetingTranslationDictionary {
  return LOCALIZED_DICTIONARIES[locale] || LOCALIZED_DICTIONARIES.en;
}
