import { Survey, Organization } from './types';

/**
 * Resolves the logo to be used for a survey based on the inheritance rules.
 * Order: Survey-specific logo -> Organization logo -> Placeholder
 */
export function resolvedSurveyLogo(
  survey: Partial<Survey>, 
  organization?: Partial<Organization> | null
): string {
  const PLACEHOLDER_LOGO = '/images/placeholder-logo.png'; // Update with actual placeholder path

  if (survey.logoMode === 'custom' && survey.logoUrl) {
    return survey.logoUrl;
  }

  if (survey.logoMode === 'organization' || !survey.logoMode) {
    if (organization?.logoUrl) {
      return organization.logoUrl;
    }
  }

  return survey.logoUrl || organization?.logoUrl || PLACEHOLDER_LOGO;
}
