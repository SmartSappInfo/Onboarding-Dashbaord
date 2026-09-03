/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Pure survey response and file processing utility functions.
 * Decoupled from Server Actions ('use server') so client components and server actions
 * can safely import synchronous parsing, sanitization, and contact extraction functions.
 */

import type {
  SurveyResponse,
  SurveyElement,
  SurveyQuestion,
  OnlinePresence,
  IndustryVertical,
  SurveyEntityMapping,
} from './types';
import type { ResolvedContact } from './contact-adapter';

// Standard mapping aliases for custom field targets
export const CUSTOM_FIELD_KEY_MAP: Record<string, string> = {
  curriculum: 'curriculum',
  curricula: 'curriculum',
  curriculumtype: 'curriculum',
  'curriculum type': 'curriculum',
  capacity: 'capacity',
  schoolcapacity: 'capacity',
  studentcapacity: 'capacity',
  facilities: 'facilities',
  schoolfacilities: 'facilities',
  gendercomposition: 'genderComposition',
  'gender composition': 'genderComposition',
  gender: 'genderComposition',
  accreditation: 'accreditation',
  accreditations: 'accreditation',
  affiliation: 'affiliation',
  affiliations: 'affiliation',
  academicschedule: 'academicSchedule',
  'academic schedule': 'academicSchedule',
  schedule: 'academicSchedule',
  feestructure: 'feeStructure',
  'fee structure': 'feeStructure',
  fees: 'feeStructure',
  tuitionfee: 'feeStructure',
  foundedyear: 'foundedYear',
  'founded year': 'foundedYear',
  establishedyear: 'foundedYear',
  yearfounded: 'foundedYear',
  website: 'website',
  url: 'website',
  schoolwebsite: 'website',
  facebook: 'facebook',
  facebookurl: 'facebook',
  instagram: 'instagram',
  instagramurl: 'instagram',
  twitter: 'twitter',
  x: 'twitter',
  twitterurl: 'twitter',
  linkedin: 'linkedin',
  linkedinurl: 'linkedin',
  youtube: 'youtube',
  youtubeurl: 'youtube',
  tiktok: 'tiktok',
  tiktokurl: 'tiktok',
  googlebusinessprofile: 'googleBusinessProfile',
  gmb: 'googleBusinessProfile',
};

/**
 * Known schema-validated fields for vertical industries.
 * Prevents non-schema custom fields from being stripped by validateIndustryData.
 */
export const INDUSTRY_SCHEMA_FIELDS: Record<string, Set<string>> = {
  SchoolEnrollment: new Set([
    'gradeOfferings', 'academicYear', 'capacity', 'currentEnrollment',
    'applicationIds', 'enrollmentIds', 'schoolVisitIds', 'nominalRoll'
  ]),
  Law: new Set([
    'firmType', 'practiceAreas', 'barAssociations', 'capacity',
    'conflictCheckRequired', 'matterIds', 'intakeFormIds', 'conflictCheckIds'
  ]),
  Marketing: new Set([
    'clientIndustry', 'targetAudience', 'capacity', 'revenue',
    'monthlyBudget', 'campaignIds', 'proposalIds', 'deliverableIds'
  ]),
  RealEstate: new Set([
    'propertyPortfolio', 'developerType', 'investmentFocus', 'capacity', 'propertyIds'
  ]),
  Consultancy: new Set([
    'clientIndustry', 'capacity', 'strategicPriorities', 'painPoints',
    'discoveryIds', 'proposalIds', 'engagementIds'
  ]),
  SaaS: new Set([
    'planType', 'renewalInterval', 'capacity', 'activeUsers',
    'trialIds', 'onboardingIds', 'supportTicketIds', 'healthScoreIds'
  ]),
};

/**
 * Normalization dictionary for online presence properties
 */
export const ONLINE_PRESENCE_MAP: Record<string, keyof OnlinePresence> = {
  website: 'website',
  web: 'website',
  url: 'website',
  site: 'website',
  schoolwebsite: 'website',
  schoolwebsiteaddress: 'website',
  facebook: 'facebook',
  fb: 'facebook',
  facebookpage: 'facebook',
  instagram: 'instagram',
  ig: 'instagram',
  linkedin: 'linkedin',
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
  tiktok: 'tiktok',
  youtube: 'youtube',
  yt: 'youtube',
  twitter: 'x',
  x: 'x',
  digitaladdress: 'digitalAddress',
  gpsaddress: 'digitalAddress',
  googlemap: 'googleMapLocation',
  googlemaps: 'googleMapLocation',
  googlemaplocation: 'googleMapLocation',
  googlebusiness: 'googleBusinessProfile',
  googlebusinessprofile: 'googleBusinessProfile',
  gmb: 'googleBusinessProfile',
};

const GENERIC_CHOICE_SET = new Set([
  'yes', 'no', 'later', 'maybe', 'agree', 'disagree', 
  'strongly agree', 'strongly disagree', 'neutral',
  'true', 'false', 'option 1', 'option 2', 'option 3', 'option 4', 'option 5',
  'select', 'none', 'n/a', 'na', 'not applicable', 'other', '__other__',
  'undefined', 'null', '[placeholder]', 'unknown', 'anonymous',
  'submit', 'continue', 'next', 'back', 'cancel'
]);

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Universal Generic Choice Guard.
 * Strictly identifies single/multiple choice options, boolean tokens, ratings, and placeholder strings
 * so they are never erroneously assigned or rendered as entity or contact names.
 */
export function isGenericChoiceValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'boolean') return true;
  if (typeof val !== 'string') return false;
  const trimmed = val.trim().toLowerCase();
  if (!trimmed) return true;

  if (GENERIC_CHOICE_SET.has(trimmed)) return true;

  // Reject standalone numeric scores, small rating scales (e.g. "1", "5", "10", "5/5", "10/10"), or single option letters ("a" to "e")
  if (/^(\d{1,2}(\/\d{1,2})?|[a-e])$/i.test(trimmed)) return true;

  return false;
}

/**
 * Extract clean human-readable filename from Firebase Storage URL
 */
export function extractFileNameFromStorageUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    const path = decodeURIComponent(url.pathname);
    const rawName = path.substring(path.lastIndexOf('/') + 1);
    // Only strip leading timestamp generated by file uploaders (e.g. 1740001234567-filename.ext)
    const timestampMatch = rawName.match(/^\d{10,14}-(.+)$/);
    if (timestampMatch) {
      return timestampMatch[1];
    }
    return rawName;
  } catch {
    return 'uploaded-file';
  }
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Extracted Contact Details Interface.
 * 
 * Standardized structure holding resolved entity and contact fields
 * for table displays, response detail cards, and CSV exports.
 */
export interface ExtractedContactDetails {
  entityName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  isLiveCrm: boolean;
  entityId?: string | null;
  locationString?: string;
  zoneName?: string;
  roleOrTitle?: string;
}

const CHOICE_QUESTION_TYPES = new Set([
  'multiple-choice', 'single_choice', 'dropdown', 'checkboxes',
  'yes-no', 'rating', 'ranking', 'matrix', 'slider', 'nps', 'ces', 'consent'
]);

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * ZERO-GUESSING ENTITY & CONTACT RESOLVER:
 * Resolves contact & entity details strictly from explicit CRM entity links, explicit mappings,
 * or explicit lead capture fields. Unmapped questions are NEVER guessed as entity or contact names.
 *
 * Hierarchy:
 * Tier 1: Real CRM Entity from `resolveContact(response.entityId)` (Explicit Tracking / Explicit Mapping)
 * Tier 2: Valid, non-generic `response.entityName` snapshot (Explicit Mapping / Tracked Snapshot)
 * Tier 3: Explicit Lead Capture details (`response.leadDetails.company`, `response.leadDetails.name`)
 * Tier 4: Explicit preloaded variables (`vars.entity_name` from tracking links)
 * Default: Empty string `""` (clean unlinked state, rendering as `-`)
 */
export function extractResponseContactDetails(
  response: SurveyResponse,
  contact?: ResolvedContact | null,
  surveyQuestions?: Array<SurveyElement | SurveyQuestion | { id: string; title?: string; type?: string; variableName?: string; fieldKey?: string; key?: string }>,
  surveyEntityMapping?: SurveyEntityMapping
): ExtractedContactDetails {
  const vars = response.variables || {};
  const lead = response.leadDetails || {};
  const answers = response.answers || [];

  // Helper to get answer value by questionId
  const getAnswer = (qId?: string): unknown => {
    if (!qId) return undefined;
    const found = answers.find((a) => a.questionId === qId);
    return found ? found.value : undefined;
  };

  // Helper to validate email format
  const isValidEmail = (val: unknown): string => {
    if (typeof val !== 'string') return '';
    const trimmed = val.trim().toLowerCase();
    return trimmed.includes('@') && trimmed.includes('.') && !isGenericChoiceValue(trimmed) ? trimmed : '';
  };

  // Helper to validate phone format
  const isValidPhone = (val: unknown): string => {
    if (typeof val !== 'string') return '';
    const trimmed = val.trim();
    return /\d/.test(trimmed) && !isGenericChoiceValue(trimmed) ? trimmed : '';
  };

  // Helper to extract non-generic string
  const getNonGenericString = (val: unknown): string => {
    if (typeof val !== 'string') return '';
    const trimmed = val.trim();
    return !isGenericChoiceValue(trimmed) ? trimmed : '';
  };

  // Helper to find answer from question matching criteria (Zero-guessing: choice questions excluded)
  const findAnswerByQuestion = (
    titlePattern: RegExp,
    variablePattern?: RegExp,
    typePattern?: RegExp,
    allowChoiceTypes: boolean = false
  ): unknown => {
    if (!surveyQuestions || surveyQuestions.length === 0) return undefined;
    for (const q of surveyQuestions) {
      const qType = ('type' in q && typeof q.type === 'string') ? q.type.trim().toLowerCase() : '';
      if (!allowChoiceTypes && CHOICE_QUESTION_TYPES.has(qType)) {
        continue;
      }

      const qTitle = ('title' in q && typeof q.title === 'string') ? q.title.trim() : '';
      const qVar = (
        ('variableName' in q && typeof q.variableName === 'string' ? q.variableName : '') ||
        ('fieldKey' in q && typeof q.fieldKey === 'string' ? q.fieldKey : '') ||
        ('key' in q && typeof q.key === 'string' ? q.key : '')
      ).trim();

      const isTypeMatch = typePattern ? typePattern.test(qType) : false;
      const isVarMatch = variablePattern && qVar ? variablePattern.test(qVar) : false;
      const isTitleMatch = qTitle ? titlePattern.test(qTitle) : false;

      if (isTypeMatch || isVarMatch || isTitleMatch) {
        const ans = getAnswer(q.id);
        if (ans !== undefined && ans !== null && ans !== '') {
          return ans;
        }
      }
    }
    return undefined;
  };

  // 1. Entity / School Name (Linked CRM -> Snapshot -> Lead -> Mapped Field -> Question -> Variables)
  const candidateEntityNames: unknown[] = [
    contact?.name,
    response.entityName,
    lead.company,
    lead.organization,
    lead.entityName,
    getAnswer(surveyEntityMapping?.entityNameFieldId),
    findAnswerByQuestion(
      /^(school|institution|company|organization|entity)(\s*[\/\-&]\s*(school|institution|company|organization|entity))?(\s*name)?$/i,
      /^(entity_name|school_name|company|organization|institution|company_name|entityName|schoolName)$/i
    ),
    vars.entity_name,
    vars.school_name,
    vars.organization_name,
    vars.company,
    vars.q_entity_name_input,
  ];

  let entityName = '';
  for (const cand of candidateEntityNames) {
    const clean = getNonGenericString(cand);
    if (clean) {
      entityName = clean;
      break;
    }
  }

  // 2. Primary Contact Person Name (Linked CRM Primary/First -> Snapshot -> Lead -> Mapped Field -> Question -> Variables)
  const primaryEntityContact = contact?.entityContacts?.find((c) => c.isPrimary) || contact?.entityContacts?.[0];

  const candidateContactNames: unknown[] = [
    contact?.primaryContactName,
    primaryEntityContact?.name,
    response.respondentName,
    lead.name,
    lead.contactName,
    lead.fullName,
    getAnswer(surveyEntityMapping?.contactNameFieldId),
    findAnswerByQuestion(
      /^(your\s*)?(full\s*name|respondent\s*name|contact\s*(person('?s)?\s*)?name|contact\s*person|name)(\s*[\/\-&]\s*(full\s*name|respondent\s*name|contact\s*person|name))?$/i,
      /^(contact_name|respondent_name|full_name|name|contactName|respondentName|fullName)$/i,
      /^(contact_name|name)$/i
    ),
    vars.contact_name,
    vars.respondent_name,
    vars.name,
    vars.fullName,
    vars.contactName,
    vars.respondentName,
  ];

  let primaryContactName = '';
  for (const cand of candidateContactNames) {
    const clean = getNonGenericString(cand);
    if (clean) {
      primaryContactName = clean;
      break;
    }
  }

  // 3. Primary Contact Email (Linked CRM -> Snapshot -> Lead -> Mapped Field -> Question -> Variables)
  const rawContactEmail = response.contactEmail || response.respondentEmail;

  const candidateEmails: unknown[] = [
    contact?.primaryContactEmail,
    primaryEntityContact?.email,
    rawContactEmail,
    lead.email,
    lead.contactEmail,
    getAnswer(surveyEntityMapping?.contactEmailFieldId),
    findAnswerByQuestion(
      /^(your\s*)?(contact\s*)?(email(\s*address)?)$/i,
      /^(email|contact_email|respondent_email|contactEmail|respondentEmail)$/i,
      /^email$/i
    ),
    vars.contact_email,
    vars.email,
    vars.respondent_email,
  ];

  let primaryContactEmail = '';
  for (const cand of candidateEmails) {
    const valid = isValidEmail(cand);
    if (valid) {
      primaryContactEmail = valid;
      break;
    }
  }

  // 4. Primary Contact Phone (Linked CRM -> Snapshot -> Lead -> Mapped Field -> Question -> Variables)
  const rawContactPhone = response.contactPhone || response.respondentPhone;

  const candidatePhones: unknown[] = [
    contact?.primaryContactPhone,
    primaryEntityContact?.phone,
    rawContactPhone,
    lead.phone,
    lead.contactPhone,
    lead.phoneNumber,
    getAnswer(surveyEntityMapping?.contactPhoneFieldId),
    findAnswerByQuestion(
      /^(your\s*)?(contact\s*)?(phone(\s*number)?|mobile(\s*number)?|telephone|whatsapp(\s*number)?)$/i,
      /^(phone|contact_phone|respondent_phone|mobile|contactPhone|respondentPhone)$/i,
      /^phone$/i
    ),
    vars.contact_phone,
    vars.phone,
    vars.respondent_phone,
  ];

  let primaryContactPhone = '';
  for (const cand of candidatePhones) {
    const valid = isValidPhone(cand);
    if (valid) {
      primaryContactPhone = valid;
      break;
    }
  }

  // 5. Role or Title (Linked CRM -> Snapshot -> Lead -> Mapped Field -> Question -> Variables)
  const mappedRoleMapping = surveyEntityMapping?.additionalMappings?.find(
    (m) => /^(role|title|designation|contacts?\.role|person\.role)$/i.test(m.targetField)
  );

  const candidateRoles: unknown[] = [
    primaryEntityContact?.typeLabel,
    primaryEntityContact?.typeKey,
    response.role,
    response.roleOrTitle,
    lead.role,
    lead.title,
    lead.position,
    lead.jobTitle,
    getAnswer(mappedRoleMapping?.questionId),
    findAnswerByQuestion(
      /^(your\s*)?(role|job\s*title|position|designation)(\s*[\/\-&]\s*(role|job\s*title|position|designation))?$/i,
      /^(role|title|job_title|position|designation|jobTitle)$/i
    ),
    vars.role,
    vars.title,
    vars.job_title,
    vars.position,
    vars.designation,
  ];

  let roleOrTitle: string | undefined = undefined;
  for (const cand of candidateRoles) {
    const clean = getNonGenericString(cand);
    if (clean) {
      roleOrTitle = clean;
      break;
    }
  }

  const isLiveCrm = Boolean(response.entityId && (contact || response.entityId));

  return {
    entityName,
    primaryContactName,
    primaryContactEmail,
    primaryContactPhone,
    isLiveCrm,
    entityId: response.entityId || null,
    locationString: contact?.locationString,
    zoneName: contact?.zoneName,
    roleOrTitle,
  };
}

/**
 * Sanitizes a cell value for CSV output to prevent CSV / Formula Injection attacks
 * (OWASP CSV Injection guidelines: prepend single quote if cell starts with =, +, -, @, tab, CR, or newline)
 */
export function sanitizeForCsv(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  let rawStr = String(val);
  if (!rawStr) return '';

  // 1. OWASP CSV Formula Injection Neutralization
  const trimmed = rawStr.trim();
  if (/^[=+\-@\t\r\n]/.test(rawStr) || /^[=+\-@]/.test(trimmed)) {
    rawStr = `'${rawStr}`;
  }

  // 2. RFC 4180 CSV Escaping (escape internal quotes and wrap in quotes when containing delimiters)
  if (rawStr.includes(',') || rawStr.includes('"') || rawStr.includes('\n') || rawStr.includes('\r')) {
    return `"${rawStr.replace(/"/g, '""')}"`;
  }

  return rawStr;
}

export interface ParsedSurveyMappings {
  mappedInstitutionData: Record<string, unknown>;
  mappedPersonData: Record<string, string | number | boolean | string[]>;
  mappedCustomData: Record<string, string | number | boolean | string[]>;
  mappedOnlinePresence: Partial<OnlinePresence>;
  mappedLocation: Record<string, unknown>;
  overriddenEntityName: string | null;
  overriddenContactName: string | null;
  overriddenContactEmail: string | null;
  overriddenContactPhone: string | null;
  slogan: string | null;
  initials: string | null;
  logoUrl: string | null;
  referee: string | null;
  interestsText: string | null;
}

/**
 * Universal Target Field Resolver for Surveys.
 * Maps custom fields, industry data, online presence, and location safely.
 */
export function parseAndDistributeSurveyMappings(
  additionalMappings: Array<{ questionId: string; targetField: string }> | undefined,
  answers: Array<{ questionId: string; value: unknown }> | undefined,
  workspaceIndustry?: IndustryVertical | string
): ParsedSurveyMappings {
  const result: ParsedSurveyMappings = {
    mappedInstitutionData: {},
    mappedPersonData: {},
    mappedCustomData: {},
    mappedOnlinePresence: {},
    mappedLocation: {},
    overriddenEntityName: null,
    overriddenContactName: null,
    overriddenContactEmail: null,
    overriddenContactPhone: null,
    slogan: null,
    initials: null,
    logoUrl: null,
    referee: null,
    interestsText: null,
  };

  if (!additionalMappings?.length || !answers?.length) {
    return result;
  }

  const getAnswerValue = (qId?: string) => {
    if (!qId) return null;
    const ans = answers.find((a) => a.questionId === qId);
    return ans ? ans.value : null;
  };

  additionalMappings.forEach((m) => {
    const val = getAnswerValue(m.questionId);
    if (val === null || val === undefined || val === '') return;

    const rawTarget = m.targetField.trim();
    const cleanLower = rawTarget.toLowerCase().replace(/[\s_-]+/g, '');

    // 1. Identity & Contact Overrides
    if (rawTarget === 'entity.name' || cleanLower === 'name' || cleanLower === 'schoolname') {
      if (!isGenericChoiceValue(val)) result.overriddenEntityName = String(val).trim();
      return;
    }
    if (rawTarget === 'contacts.name' || cleanLower === 'contactname' || cleanLower === 'contactperson') {
      if (!isGenericChoiceValue(val)) result.overriddenContactName = String(val).trim();
      return;
    }
    if (rawTarget === 'contacts.email' || cleanLower === 'contactemail' || cleanLower === 'email') {
      result.overriddenContactEmail = String(val).trim().toLowerCase();
      return;
    }
    if (rawTarget === 'contacts.phone' || cleanLower === 'contactphone' || cleanLower === 'phone') {
      result.overriddenContactPhone = String(val).trim();
      return;
    }

    // 2. Online Presence (e.g. onlinePresence.website, Website, Facebook, etc.)
    if (rawTarget.toLowerCase().startsWith('onlinepresence.')) {
      const subKey = rawTarget.substring('onlinepresence.'.length).trim();
      const normSub = subKey.toLowerCase().replace(/[\s_-]+/g, '');
      const mappedKey = ONLINE_PRESENCE_MAP[normSub] || (subKey as keyof OnlinePresence);
      result.mappedOnlinePresence[mappedKey] = String(val).trim();
      return;
    }
    if (ONLINE_PRESENCE_MAP[cleanLower]) {
      const mappedKey = ONLINE_PRESENCE_MAP[cleanLower];
      result.mappedOnlinePresence[mappedKey] = String(val).trim();
      if (mappedKey === 'digitalAddress') {
        result.mappedLocation.locationString = String(val).trim();
      }
      return;
    }

    // 3. Location fields
    if (rawTarget.toLowerCase().startsWith('location.')) {
      const subKey = rawTarget.substring('location.'.length).trim();
      result.mappedLocation[subKey] = val;
      return;
    }
    if (cleanLower === 'address' || cleanLower === 'digitaladdress') {
      result.mappedLocation.locationString = String(val).trim();
      return;
    }

    // 4. Direct Root Entity Branding/Attributes
    if (cleanLower === 'slogan') {
      result.slogan = String(val).trim();
      return;
    }
    if (cleanLower === 'initials') {
      result.initials = String(val).trim();
      return;
    }
    if (cleanLower === 'logo' || cleanLower === 'logourl') {
      result.logoUrl = String(val).trim();
      return;
    }
    if (cleanLower === 'referee') {
      result.referee = String(val).trim();
      return;
    }

    // 5. Custom Data prefix
    if (rawTarget.startsWith('customData.')) {
      const field = rawTarget.substring('customData.'.length).trim();
      result.mappedCustomData[field] = val as string | number | boolean | string[];
      return;
    }

    // 6. Institution Data prefix
    if (rawTarget.startsWith('institutionData.')) {
      const field = rawTarget.substring('institutionData.'.length).trim();
      const isSchemaField = workspaceIndustry && INDUSTRY_SCHEMA_FIELDS[workspaceIndustry]?.has(field);
      if (isSchemaField) {
        result.mappedInstitutionData[field] = (field === 'nominalRoll' || field === 'capacity' || field === 'currentEnrollment') ? Number(val) : val;
      } else {
        // Dynamic/custom field (e.g. staff_data, parent_and_student_data) → preserve in customData!
        result.mappedCustomData[field] = val as string | number | boolean | string[];
        result.mappedInstitutionData[field] = val;
      }
      return;
    }

    // 7. Person Data prefix
    if (rawTarget.startsWith('personData.')) {
      const field = rawTarget.substring('personData.'.length).trim();
      result.mappedPersonData[field] = val as string | number | boolean | string[];
      result.mappedCustomData[field] = val as string | number | boolean | string[];
      return;
    }

    // 8. Default fallback: route to customData
    result.mappedCustomData[rawTarget] = val as string | number | boolean | string[];
  });

  return result;
}
