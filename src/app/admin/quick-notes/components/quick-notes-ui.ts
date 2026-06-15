/**
 * Quick Notes — shared UI tokens & helpers (client-safe, no I/O).
 *
 * "Editorial Index Cards" palette: warm, restrained accents keyed by a token
 * name (never raw hex in components). Each category stores its `color` as one
 * of these keys; missing/unknown keys fall back to `slate`.
 */

export interface CategorySwatch {
  /** Small dot / chip background. */
  dot: string;
  /** Soft card-accent background. */
  soft: string;
  /** Left-edge accent + border. */
  edge: string;
  /** Readable label text. */
  text: string;
  label: string;
}

export const CATEGORY_SWATCHES: Record<string, CategorySwatch> = {
  slate: { dot: 'bg-slate-400', soft: 'bg-slate-500/5', edge: 'border-l-slate-400/60', text: 'text-slate-600 dark:text-slate-300', label: 'Slate' },
  amber: { dot: 'bg-amber-500', soft: 'bg-amber-500/5', edge: 'border-l-amber-500/60', text: 'text-amber-700 dark:text-amber-300', label: 'Amber' },
  emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-500/5', edge: 'border-l-emerald-500/60', text: 'text-emerald-700 dark:text-emerald-300', label: 'Emerald' },
  sky: { dot: 'bg-sky-500', soft: 'bg-sky-500/5', edge: 'border-l-sky-500/60', text: 'text-sky-700 dark:text-sky-300', label: 'Sky' },
  violet: { dot: 'bg-violet-500', soft: 'bg-violet-500/5', edge: 'border-l-violet-500/60', text: 'text-violet-700 dark:text-violet-300', label: 'Violet' },
  rose: { dot: 'bg-rose-500', soft: 'bg-rose-500/5', edge: 'border-l-rose-500/60', text: 'text-rose-700 dark:text-rose-300', label: 'Rose' },
};

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_SWATCHES);

export function categorySwatch(color?: string): CategorySwatch {
  return (color && CATEGORY_SWATCHES[color]) || CATEGORY_SWATCHES.slate;
}

/** Compact relative-ish date for cards (stable, locale-independent). */
export function formatNoteDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
