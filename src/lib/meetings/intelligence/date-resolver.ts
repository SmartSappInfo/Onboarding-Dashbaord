/**
 * @fileOverview Due-date resolution (Phase 11 M2 · T3.1; plan §4.4 rule 4; Rules 31, 47).
 *
 * The model reports the WORDS used for a deadline ("by Friday", "end of the month"); this module
 * turns them into a calendar date relative to the meeting's local date in a time zone. The model's
 * own idea of a date is never used.
 *
 * Resolved: today/tonight/EOD, tomorrow, the day after tomorrow, a weekday ("Friday", "this
 * Friday"), "next <weekday>" (that weekday in the following Mon–Sun week), end of (the) week
 * (Friday), end of (the) month, in N days/weeks, ISO dates, "12 October" / "October 12th" [year].
 * Unresolvable or ambiguous → `null`, and the item keeps no date. Ambiguous cases: "next week" (no
 * day), the weekday of the meeting itself ("by Friday" said on a Friday), numeric dates like
 * 12/10 (day-month vs month-day), anything in the past or more than a year ahead.
 *
 * Pure. Tests: src/lib/meetings/__tests__/intelligence-pure.test.ts
 */

export interface ResolvedDue {
  iso: string;
  resolvedFrom: string;
  timeZone: string;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'] as const;
const NUMBER_WORDS: Readonly<Record<string, number>> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1 };
const MAX_DAYS_AHEAD = 366;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The meeting instant's calendar date in `timeZone`, as a UTC-midnight Date (for day arithmetic). */
export function localDate(instantIso: string, timeZone: string): Date | null {
  const ms = Date.parse(instantIso);
  if (!Number.isFinite(ms) || !isValidTimeZone(timeZone)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get('year');
  const m = get('month');
  const d = get('day');
  return Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) ? new Date(Date.UTC(y, m - 1, d)) : null;
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const monthIndex = (word: string) => MONTHS.findIndex((m) => m === word || (word.length >= 3 && m.startsWith(word)));

function validDate(y: number, m: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, m, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m && date.getUTCDate() === d ? date : null;
}

function resolveCore(text: string, today: Date): Date | null {
  const dow = today.getUTCDay();

  if (/^(today|tonight|end of (the )?day|eod|cob|close of business)$/.test(text)) return today;
  if (/^tomorrow$/.test(text)) return addDays(today, 1);
  if (/^(the )?day after tomorrow$/.test(text)) return addDays(today, 2);

  const weekday = text.match(/^(this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (weekday) {
    const target = WEEKDAYS.findIndex((w) => w === weekday[2]);
    const diff = (target - dow + 7) % 7;
    return diff === 0 ? null : addDays(today, diff); // same weekday as the meeting: ambiguous
  }

  const nextWeekday = text.match(/^next (sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextWeekday) {
    const target = WEEKDAYS.findIndex((w) => w === nextWeekday[1]);
    const mondayOfNextWeek = addDays(today, ((8 - dow) % 7) || 7);
    return addDays(mondayOfNextWeek, (target + 6) % 7);
  }

  if (/^end of (the |this )?week$/.test(text)) {
    return dow === 0 || dow === 6 ? null : addDays(today, 5 - dow);
  }
  if (/^end of (the |this )?month$/.test(text)) {
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  }

  const inN = text.match(/^in (\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|a|an) (day|days|week|weeks)$/);
  if (inN) {
    const n = /^\d+$/.test(inN[1]) ? Number(inN[1]) : NUMBER_WORDS[inN[1]];
    return n === undefined ? null : addDays(today, inN[2].startsWith('week') ? n * 7 : n);
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const dayMonth = text.match(/^(\d{1,2})(st|nd|rd|th)? (of )?([a-z]+)( (\d{4}))?$/);
  const monthDay = text.match(/^([a-z]+) (\d{1,2})(st|nd|rd|th)?( (\d{4}))?$/);
  const named = dayMonth
    ? { day: Number(dayMonth[1]), month: monthIndex(dayMonth[4]), year: dayMonth[6] }
    : monthDay
      ? { day: Number(monthDay[2]), month: monthIndex(monthDay[1]), year: monthDay[5] }
      : null;
  if (named && named.month >= 0) {
    if (named.year) return validDate(Number(named.year), named.month, named.day);
    const thisYear = validDate(today.getUTCFullYear(), named.month, named.day);
    if (!thisYear) return null;
    // No year given: the next occurrence on or after the meeting date.
    return thisYear.getTime() >= today.getTime() ? thisYear : validDate(today.getUTCFullYear() + 1, named.month, named.day);
  }
  return null;
}

export function resolveDuePhrase(phrase: string | undefined, context: { meetingIso: string; timeZone: string }): ResolvedDue | null {
  if (!phrase) return null;
  const today = localDate(context.meetingIso, context.timeZone);
  if (!today) return null;
  const text = phrase
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(by|on|before|until|till|no later than|due|for)\s+/, '')
    .replace(/^(the )?(coming )/, 'this ');
  const date = resolveCore(text, today);
  if (!date) return null;
  const ahead = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (ahead < 0 || ahead > MAX_DAYS_AHEAD) return null;
  return { iso: toIso(date), resolvedFrom: phrase.trim().slice(0, 120), timeZone: context.timeZone };
}
