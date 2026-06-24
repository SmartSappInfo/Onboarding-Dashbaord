import type { PageTemplate } from '@/lib/types';
import { SAAS_TEMPLATES } from './saas';
import { SCHOOL_TEMPLATES } from './schools';
import { MARKETING_TEMPLATES } from './marketing';

/** The full library of starter templates, grouped source files re-exported. */
export const ALL_TEMPLATES: PageTemplate[] = [
  ...SAAS_TEMPLATES,
  ...SCHOOL_TEMPLATES,
  ...MARKETING_TEMPLATES,
];

export { SAAS_TEMPLATES, SCHOOL_TEMPLATES, MARKETING_TEMPLATES };
