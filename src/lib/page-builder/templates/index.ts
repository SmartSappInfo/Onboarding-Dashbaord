import type { PageTemplate } from '@/lib/types';
import { SAAS_TEMPLATES } from './saas';
import { SCHOOL_TEMPLATES } from './schools';
import { MARKETING_TEMPLATES } from './marketing';
import { HOMEPAGE_TEMPLATES } from './homepage';

/** The full library of starter templates, grouped source files re-exported. */
export const ALL_TEMPLATES: PageTemplate[] = [
  ...HOMEPAGE_TEMPLATES,
  ...SAAS_TEMPLATES,
  ...SCHOOL_TEMPLATES,
  ...MARKETING_TEMPLATES,
];

export { HOMEPAGE_TEMPLATES, SAAS_TEMPLATES, SCHOOL_TEMPLATES, MARKETING_TEMPLATES };
