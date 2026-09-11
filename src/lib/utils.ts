import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getBaseUrl } from "./utils/url-helpers"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Robust Title Case normalization for multi-word strings.
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolves a technical variable key to its actual value based on school context.
 * Used for high-fidelity previews and final PDF generation.
 * Upgraded to look for the designated 'Signatory' in focal persons.
 */
export function resolveVariableValue(key: string, school?: any): string | null {
    if (!school) return null;
    
    // 1. Resolve Signatory Context from entityContacts
    const contacts = school.entityContacts || [];
    const signatory = contacts.find((c: any) => c.isSignatory) || contacts[0];
    
    const currency = school.currency || 'GHS';
    const rate = school.subscriptionRate || 0;
    const roll = school.nominalRoll || 0;
    
    if (key === 'entity_name') return school.name;
    if (key === 'entity_initials') return school.initials || '';
    if (key === 'entity_location') return school.location || '';
    if (key === 'entity_phone') return school.phone || '';
    if (key === 'entity_email') return school.email || '';
    if (key === 'entity_package') return school.subscriptionPackageName || 'Standard';

    switch(key) {
        // Signatory Data (Primary variables)
        case 'contact_name': return signatory?.name || '';
        case 'contact_email': return signatory?.email || '';
        case 'contact_phone': return signatory?.phone || '';
        case 'contact_position': return signatory?.type || '';
        
        // Financial Logic
        case 'subscription_rate': return `${currency} ${rate.toLocaleString()}`;
        case 'subscription_total': return `${currency} ${(rate * roll).toLocaleString()}`;
        case 'nominal_roll': return roll.toLocaleString();
        case 'arrears_balance': return `${currency} ${(school.arrearsBalance || 0).toLocaleString()}`;
        
        // Smart URL Resolution for Simulation
        case 'agreement_url': {
            // Note: In a real simulation, we'd need to know which contract/PDF is in context.
            // For general preview, we point to a representative portal.
            const baseUrl = getBaseUrl();
            return `${baseUrl}/forms/contract-simulation?entityId=${school.id}`;
        }
        
        default: return null;
    }
}

/** Returns '#ffffff' or '#000000' based on background hex color luminance (WCAG) */
export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Ordered rewrite steps used by `stripHtml`.
 *
 * PERFORMANCE (vercel-react-best-practices `js-hoist-regexp`): these literals used to
 * live inside the function body, so every call allocated ~18 RegExp objects. `stripHtml`
 * has ~98 call sites, several of them inside render paths that re-run on each keystroke
 * (e.g. the survey stepper's section labels). Hoisting makes the allocation one-time.
 *
 * CAUTION: order is significant — block removals (comment/style/script/xml/head) must run
 * before the generic tag sweep, and entity decoding must run after it. Do not reorder.
 *
 * SAFETY: `String.prototype.replace` resets a global RegExp's `lastIndex`, so sharing
 * these `/g` literals across calls is safe. Never reuse them with `.test()` or `.exec()`.
 */
const STRIP_HTML_STEPS: ReadonlyArray<readonly [RegExp, string]> = [
  // 1. Remove HTML comments
  [/<!--[\s\S]*?-->/g, ''],
  // 2. Remove <style> blocks including internal CSS rules
  [/<style[^>]*>[\s\S]*?<\/style>/gi, ''],
  // 3. Remove <script> blocks including internal JS scripts
  [/<script[^>]*>[\s\S]*?<\/script>/gi, ''],
  // 4. Remove <xml> and <?xml> blocks
  [/<xml[^>]*>[\s\S]*?<\/xml>/gi, ''],
  [/<\?xml[^>]*\?>/gi, ''],
  // 5. Remove <head> blocks
  [/<head[^>]*>[\s\S]*?<\/head>/gi, ''],
  // 6. Remove remaining HTML/XML tags
  [/<[^>]+>/g, ''],
  // 8. Decode HTML entities
  [/&nbsp;/gi, ' '],
  [/&amp;/gi, '&'],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
  [/&quot;/gi, '"'],
  [/&#39;/gi, "'"],
  [/&rsquo;/gi, "'"],
  [/&lsquo;/gi, "'"],
  [/&rdquo;/gi, '"'],
  [/&ldquo;/gi, '"'],
  // 9. Clean up multiple spaces and empty lines
  [/[ \t]+/g, ' '],
  [/\n\s*\n/g, '\n'],
];

/**
 * Strips all HTML tags, script/style blocks, embedded CSS rules, and HTML entities from a string to return clean plain text.
 *
 * NOTE: this decodes entities, so `&lt;b&gt;` comes back out as the literal text `<b>`.
 * When the destination is a UI text sink, prefer `toDisplayText` from
 * `@/lib/utils/display-text`, which re-sweeps and guarantees no tag survives.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  let out = html;
  for (const [pattern, replacement] of STRIP_HTML_STEPS) {
    out = out.replace(pattern, replacement);
  }
  return out.trim();
}

/**
 * Safely decodes a URI component. Useful for Next.js App Router dynamic segments
 * which are sometimes passed as encoded strings. Prevents fatal URIErrors if malformed.
 */
export function safeDecodeURI(str: string): string {
  if (!str) return '';
  try {
    return decodeURIComponent(str);
  } catch (_e) {
    console.error(`[safeDecodeURI] Failed to decode string: "${str}"`);
    return str;
  }
}
