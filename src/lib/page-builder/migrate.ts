/**
 * Forward-migrate legacy page structures into the generic shape the registry
 * renderer understands.
 *
 * The old payment-page renderer hardcoded section headings by section id. Here
 * we lift those into `section.props.heading` so the generic `PageRenderer` shows
 * them. Idempotent — never overwrites an existing heading and returns the same
 * reference when nothing changes.
 */
import type { CampaignPageStructure } from '@/lib/types';

const LEGACY_SECTION_HEADINGS: Record<string, string> = {
  'payment-methods-section': 'Bank Details',
  'procedure-section': 'Payment Procedure',
  'cta-section': 'Complete Payment',
};

export function migrateLegacyStructure(structure: CampaignPageStructure): CampaignPageStructure {
  let changed = false;
  const sections = structure.sections.map((section) => {
    const heading = LEGACY_SECTION_HEADINGS[section.id];
    if (heading && typeof section.props.heading !== 'string') {
      changed = true;
      return { ...section, props: { ...section.props, heading } };
    }
    return section;
  });
  return changed ? { ...structure, sections } : structure;
}
