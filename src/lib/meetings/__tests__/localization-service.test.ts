import { describe, it, expect } from 'vitest';
import { getMeetingTranslations } from '../localization-service';

describe('Meeting Multi-Language Localization Service', () => {
  it('returns English translations by default', () => {
    const t = getMeetingTranslations('en');
    expect(t.bookSession).toBe('Book a Session');
    expect(t.selectTimezone).toBe('Timezone');
  });

  it('returns accurate translations for French, Spanish, and Portuguese', () => {
    const fr = getMeetingTranslations('fr');
    expect(fr.bookSession).toBe('Réserver une session');
    expect(fr.selectTimezone).toBe('Fuseau horaire');

    const es = getMeetingTranslations('es');
    expect(es.bookSession).toBe('Reservar una sesión');
    expect(es.selectTimezone).toBe('Zona horaria');

    const pt = getMeetingTranslations('pt');
    expect(pt.bookSession).toBe('Agendar uma sessão');
    expect(pt.selectTimezone).toBe('Fuso horário');
  });
});
