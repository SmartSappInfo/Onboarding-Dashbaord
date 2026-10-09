/**
 * header-matcher.ts
 *
 * Intelligent, case-insensitive, punctuation-agnostic header matching engine
 * for CSV and spreadsheet imports (Bulk Upload & Contacts Import).
 *
 * Requirements & Rules (agent_mcp_rules.md):
 * - Tolerant Case Matching: Matches lower case, Title Case, UPPER CASE, camelCase, snake_case, kebab-case.
 * - Punctuation & Space Agnostic: Handles "E-mail", "e_mail", "Email Address", "Phone Number", etc.
 * - Canonical Alias Dictionary: Robustly maps common variations for email, phone, role/title, name, location, etc.
 * - Multi-Contact Slot Detection: Automatically detects Contact 1, Contact 2, Contact 3 columns and sets slot counts.
 * - Strict Typing: Zero `any` or `any[]`.
 */

export interface MappableField {
  key: string;
  label: string;
  required?: boolean;
}

export interface HeaderMatchResult {
  /** Map of target field key -> matching incoming CSV column header */
  mapping: Record<string, string>;
  /** Automatically detected contact slot count (minimum 1) */
  detectedSlotCount: number;
}

/**
 * Normalizes a header or field label:
 * - Converts to lower case
 * - Replaces underscores and hyphens with spaces
 * - Collapses whitespace
 * - Trims
 */
export function normalizeHeader(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Strips all non-alphanumeric characters for clean token-level equality comparison.
 */
export function cleanAlphanumeric(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Reusable Canonical Synonym Lists ──
const PRIMARY_EMAIL_ALIASES = [
  'email',
  'emails',
  'e mail',
  'e-mail',
  'mail',
  'email address',
  'emailaddress',
  'contact email',
  'contactemail',
  'primary email',
  'primaryemail',
  'work email',
  'workemail',
  'user email',
  'useremail',
  'contact 1 email',
  'contact1 email',
  'contact 1 mail',
  'email 1',
  'email1',
  'rep email',
  'guardian email',
];

const PRIMARY_PHONE_ALIASES = [
  'phone',
  'phones',
  'telephone',
  'tel',
  'tele',
  'mobile',
  'cell',
  'cellphone',
  'cell phone',
  'whatsapp',
  'phone number',
  'phonenumber',
  'phone no',
  'phoneno',
  'tel number',
  'telephone number',
  'mobile number',
  'mobilenumber',
  'contact phone',
  'contactphone',
  'primary phone',
  'primaryphone',
  'contact 1 phone',
  'contact1 phone',
  'phone 1',
  'phone1',
  'rep phone',
  'guardian phone',
];

const PRIMARY_ROLE_ALIASES = [
  'role',
  'roles',
  'contact role',
  'contactrole',
  'title',
  'job title',
  'jobtitle',
  'position',
  'designation',
  'occupation',
  'relationship',
  'guardian relationship',
  'relationship to child',
  'contact 1 role',
  'contact1 role',
  'role 1',
  'role1',
  'rep role',
];

const PRIMARY_NAME_ALIASES = [
  'contact name',
  'contactname',
  'contact person',
  'contactperson',
  'primary contact',
  'primary contact name',
  'primarycontact',
  'representative',
  'representative name',
  'rep name',
  'guardian name',
  'guardian',
  'parent name',
  'contact 1 name',
  'contact1 name',
  'contact 1',
  'contact1',
];

/**
 * Canonical dictionary of synonyms and aliases for common fields.
 * All entries must be lowercase with single spaces or clean tokens.
 */
const CANONICAL_ALIASES: Record<string, string[]> = {
  // ── Contact 0 / Primary Contact & Universal Contact Fields ──
  contact_0_email: PRIMARY_EMAIL_ALIASES,
  contact_email: PRIMARY_EMAIL_ALIASES,
  email: PRIMARY_EMAIL_ALIASES,
  guardian1_email: PRIMARY_EMAIL_ALIASES,

  contact_0_phone: PRIMARY_PHONE_ALIASES,
  contact_phone: PRIMARY_PHONE_ALIASES,
  phone: PRIMARY_PHONE_ALIASES,
  guardian1_phone: PRIMARY_PHONE_ALIASES,

  contact_0_role: PRIMARY_ROLE_ALIASES,
  contact_role: PRIMARY_ROLE_ALIASES,
  role: PRIMARY_ROLE_ALIASES,
  guardian1_relationship: PRIMARY_ROLE_ALIASES,

  contact_0_name: PRIMARY_NAME_ALIASES,
  contact_name: PRIMARY_NAME_ALIASES,
  contactName: PRIMARY_NAME_ALIASES,
  guardian1_name: PRIMARY_NAME_ALIASES,

  // ── Contact 1 / Secondary Contact Fields ──
  contact_1_email: [
    'contact 2 email',
    'contact2 email',
    'contact 2 mail',
    'secondary email',
    'secondaryemail',
    'email 2',
    'email2',
    'alt email',
    'alternate email',
  ],
  contact_1_phone: [
    'contact 2 phone',
    'contact2 phone',
    'secondary phone',
    'secondaryphone',
    'phone 2',
    'phone2',
    'alt phone',
    'alternate phone',
    'mobile 2',
  ],
  contact_1_role: [
    'contact 2 role',
    'contact2 role',
    'secondary role',
    'role 2',
    'role2',
    'contact 2 title',
    'secondary relationship',
  ],
  contact_1_name: [
    'contact 2 name',
    'contact2 name',
    'secondary contact',
    'secondary name',
    'contact 2',
    'contact2',
    'name 2',
    'name2',
  ],

  // ── Contact 2 / Tertiary Contact Fields ──
  contact_2_email: ['contact 3 email', 'contact3 email', 'email 3', 'email3', 'tertiary email'],
  contact_2_phone: ['contact 3 phone', 'contact3 phone', 'phone 3', 'phone3', 'tertiary phone'],
  contact_2_role: ['contact 3 role', 'contact3 role', 'role 3', 'role3', 'tertiary role'],
  contact_2_name: ['contact 3 name', 'contact3 name', 'contact 3', 'contact3', 'name 3', 'name3'],

  // ── Entity Level Fields ──
  name: [
    'name',
    'entity name',
    'company name',
    'company',
    'organization name',
    'organisation name',
    'organization',
    'organisation',
    'institution name',
    'institution',
    'school name',
    'school',
    'business name',
    'account name',
    'full name',
    'client name',
  ],
  firstName: ['first name', 'firstname', 'given name', 'first_name'],
  lastName: ['last name', 'lastname', 'surname', 'family name', 'last_name'],
  jobTitle: ['job title', 'jobtitle', 'job_title', 'title', 'position', 'role', 'occupation'],
  company: ['company', 'organisation', 'organization', 'company name', 'business'],
  status: ['status', 'stage', 'operational state', 'state', 'lead status'],
  locationString: [
    'physical address',
    'address',
    'street address',
    'street',
    'location',
    'physical location',
    'city',
    'full address',
  ],
  locationRegion: ['region', 'state', 'province', 'location region'],
  locationDistrict: ['district', 'lga', 'county', 'town', 'municipality', 'location district'],
  leadSource: ['lead source', 'leadsource', 'source', 'channel', 'referral source', 'acquisition channel'],
  workspaceTags: ['tags', 'tag', 'labels', 'label', 'keywords', 'tags comma separated', 'categories'],
  subscriptionPackageName: ['subscription package', 'package', 'plan', 'tier', 'subscription'],
  subscriptionRate: ['subscription rate', 'rate', 'fee', 'cost', 'price', 'pricing'],
  currency: ['currency', 'curr'],
  billingAddress: ['billing address', 'billing location'],
  nominalRoll: ['nominal roll', 'enrollment', 'student count', 'headcount', 'size', 'students', 'pupils'],
  initials: ['initials', 'acronym', 'abbreviation', 'short code'],
  slogan: ['slogan', 'motto', 'motto slogan', 'tagline'],
  currentNeeds: ['current needs', 'needs', 'requirements'],
  currentChallenges: ['current challenges', 'challenges', 'pain points'],
  interests: ['interests', 'interest'],
};

/**
 * Detects the highest contact slot index referenced in the incoming file headers.
 * For example, if "Contact 2 Email" or "Secondary Phone" is present, returns 2.
 */
export function detectContactSlotCount(fileHeaders: string[]): number {
  let maxSlot = 1;
  for (const h of fileHeaders) {
    const clean = cleanAlphanumeric(h);
    if (/contact[2-9]|secondary|contact2/.test(clean)) {
      maxSlot = Math.max(maxSlot, 2);
    }
    if (/contact3|tertiary/.test(clean)) {
      maxSlot = Math.max(maxSlot, 3);
    }
    if (/contact4|quaternary/.test(clean)) {
      maxSlot = Math.max(maxSlot, 4);
    }
    if (/contact5/.test(clean)) {
      maxSlot = Math.max(maxSlot, 5);
    }
  }
  return maxSlot;
}

/**
 * Intelligent auto-mapping algorithm that matches incoming spreadsheet headers
 * to target fields across 4 rigorous matching tiers:
 *
 * 1. Exact Label / Key matches (case, punctuation, and space agnostic)
 * 2. Canonical Alias & Synonym matches
 * 3. Scope-aware dynamic disambiguation (e.g. separating entity name from contact name)
 * 4. Token substring & stem matches
 *
 * @param fileHeaders The raw column names from the uploaded file
 * @param allMappableFields The list of all mappable entity & contact fields
 * @param contactScope The entity scope ('institution' | 'person' | 'family')
 * @param singularTerm The industry singular term (e.g. "School", "Institution", "Client")
 */
export function autoMapSpreadsheetHeaders(
  fileHeaders: string[],
  allMappableFields: MappableField[],
  contactScope: string = 'institution',
  singularTerm: string = 'Entity'
): HeaderMatchResult {
  const initialMapping: Record<string, string> = {};
  const mappedHeaders = new Set<string>();
  const mappedFieldKeys = new Set<string>();

  const detectedSlotCount = detectContactSlotCount(fileHeaders);

  // Helper to mark a match
  const recordMatch = (fieldKey: string, header: string) => {
    if (mappedFieldKeys.has(fieldKey) || mappedHeaders.has(header)) return false;
    initialMapping[fieldKey] = header;
    mappedHeaders.add(header);
    mappedFieldKeys.add(fieldKey);
    return true;
  };

  // Build a lookup map of target fields
  const fieldByKey = new Map<string, MappableField>();
  allMappableFields.forEach(f => fieldByKey.set(f.key, f));

  // ─────────────────────────────────────────────────────────────────────────────
  // PASS 1: Exact Normalized & Clean Alphanumeric Matches on Target Label or Key
  // ─────────────────────────────────────────────────────────────────────────────
  for (const field of allMappableFields) {
    if (mappedFieldKeys.has(field.key)) continue;

    const normLabel = normalizeHeader(field.label);
    const cleanLabel = cleanAlphanumeric(field.label);

    // In 0-indexed schema, contact_0 is human "Contact 1", contact_1 is human "Contact 2"
    const contactMatch = field.key.match(/^contact_(\d+)_(.+)$/);
    let normKey = normalizeHeader(field.key);
    let cleanKey = cleanAlphanumeric(field.key);
    let humanContactKey: string | null = null;
    let cleanHumanContactKey: string | null = null;

    if (contactMatch) {
      const slotNum = parseInt(contactMatch[1], 10) + 1; // 0 -> 1, 1 -> 2
      const prop = contactMatch[2];
      humanContactKey = `contact ${slotNum} ${prop}`;
      cleanHumanContactKey = `contact${slotNum}${prop}`;
      // Invalidate raw 0-indexed key comparison to prevent "contact_1_email" matching "Contact 1 Email"
      normKey = '';
      cleanKey = '';
    }

    const match = fileHeaders.find(header => {
      if (mappedHeaders.has(header)) return false;
      const nh = normalizeHeader(header);
      const ch = cleanAlphanumeric(header);
      return (
        nh === normLabel ||
        ch === cleanLabel ||
        (humanContactKey !== null && (nh === humanContactKey || ch === cleanHumanContactKey)) ||
        (Boolean(normKey) && (nh === normKey || ch === cleanKey))
      );
    });

    if (match) {
      recordMatch(field.key, match);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASS 2: Canonical Alias & Synonym Matches
  // ─────────────────────────────────────────────────────────────────────────────
  // We evaluate contact fields first, so "Contact Name" won't accidentally claim entity "name"
  const prioritizedFields = [...allMappableFields].sort((a, b) => {
    const isContactField = (key: string) =>
      key.startsWith('contact_') ||
      key.startsWith('guardian1_') ||
      key === 'contact_name' ||
      key === 'contact_email' ||
      key === 'contact_phone' ||
      key === 'contact_role' ||
      key === 'contactName';
    const aIsContact = isContactField(a.key);
    const bIsContact = isContactField(b.key);
    if (aIsContact && !bIsContact) return -1;
    if (!aIsContact && bIsContact) return 1;
    return 0;
  });

  for (const field of prioritizedFields) {
    if (mappedFieldKeys.has(field.key)) continue;

    // Collect all aliases for this field
    const aliases = new Set<string>();
    const registered = CANONICAL_ALIASES[field.key] || [];
    registered.forEach(a => aliases.add(a));

    // Also include industry singular name variations (e.g. "School Name" for key "name")
    if (field.key === 'name') {
      aliases.add(normalizeHeader(`${singularTerm} Name`));
      aliases.add(cleanAlphanumeric(`${singularTerm} Name`));
      aliases.add(normalizeHeader(singularTerm));
      aliases.add(cleanAlphanumeric(singularTerm));
    }

    // Try finding an unmapped header matching any alias
    for (const header of fileHeaders) {
      if (mappedHeaders.has(header)) continue;
      const nh = normalizeHeader(header);
      const ch = cleanAlphanumeric(header);

      let matched = false;
      for (const alias of aliases) {
        const na = normalizeHeader(alias);
        const ca = cleanAlphanumeric(alias);
        if (nh === na || ch === ca) {
          matched = true;
          break;
        }
      }

      if (matched) {
        recordMatch(field.key, header);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASS 3: Special Disambiguation & Fallbacks
  // ─────────────────────────────────────────────────────────────────────────────
  // If entity name is still not mapped, check for common organization/company/name headers
  if (!mappedFieldKeys.has('name') && fieldByKey.has('name')) {
    const nameHeader = fileHeaders.find(header => {
      if (mappedHeaders.has(header)) return false;
      const nh = normalizeHeader(header);
      // Exclude contact headers
      if (nh.includes('contact') || nh.includes('rep') || nh.includes('guardian')) return false;
      return (
        nh === 'name' ||
        nh.includes('name') ||
        nh.includes('company') ||
        nh.includes('organization') ||
        nh.includes('organisation') ||
        nh.includes('institution') ||
        nh.includes('school')
      );
    });
    if (nameHeader) {
      recordMatch('name', nameHeader);
    }
  }

  // Fallback for Email (checks contact_0_email, contact_email, email, guardian1_email)
  const emailFieldKey = ['contact_0_email', 'contact_email', 'email', 'guardian1_email'].find(
    k => fieldByKey.has(k) && !mappedFieldKeys.has(k)
  );
  if (emailFieldKey) {
    const emailHeader = fileHeaders.find(header => {
      if (mappedHeaders.has(header)) return false;
      const nh = normalizeHeader(header);
      if (/contact\s*[2-9]|secondary|email\s*[2-9]/.test(nh)) return false;
      return nh.includes('email') || nh.includes('e mail') || nh.includes('mail');
    });
    if (emailHeader) {
      recordMatch(emailFieldKey, emailHeader);
    }
  }

  // Fallback for Phone (checks contact_0_phone, contact_phone, phone, guardian1_phone)
  const phoneFieldKey = ['contact_0_phone', 'contact_phone', 'phone', 'guardian1_phone'].find(
    k => fieldByKey.has(k) && !mappedFieldKeys.has(k)
  );
  if (phoneFieldKey) {
    const phoneHeader = fileHeaders.find(header => {
      if (mappedHeaders.has(header)) return false;
      const nh = normalizeHeader(header);
      if (/contact\s*[2-9]|secondary|phone\s*[2-9]/.test(nh)) return false;
      return nh.includes('phone') || nh.includes('tel') || nh.includes('mobile') || nh.includes('cell') || nh.includes('whatsapp');
    });
    if (phoneHeader) {
      recordMatch(phoneFieldKey, phoneHeader);
    }
  }

  // Fallback for Role / Title (checks contact_0_role, contact_role, jobTitle, role, guardian1_relationship)
  const roleFieldKey = ['contact_0_role', 'contact_role', 'jobTitle', 'role', 'guardian1_relationship'].find(
    k => fieldByKey.has(k) && !mappedFieldKeys.has(k)
  );
  if (roleFieldKey) {
    const roleHeader = fileHeaders.find(header => {
      if (mappedHeaders.has(header)) return false;
      const nh = normalizeHeader(header);
      if (/contact\s*[2-9]|secondary|role\s*[2-9]/.test(nh)) return false;
      return nh.includes('role') || nh.includes('title') || nh.includes('position') || nh.includes('designation') || nh.includes('relationship');
    });
    if (roleHeader) {
      recordMatch(roleFieldKey, roleHeader);
    }
  }

  // Fallback for Contact Name (checks contact_0_name, contact_name, contactName, guardian1_name)
  const contactNameFieldKey = ['contact_0_name', 'contact_name', 'contactName', 'guardian1_name'].find(
    k => fieldByKey.has(k) && !mappedFieldKeys.has(k)
  );
  if (contactNameFieldKey) {
    const contactNameHeader = fileHeaders.find(header => {
      if (mappedHeaders.has(header)) return false;
      const nh = normalizeHeader(header);
      if (/contact\s*[2-9]|secondary/.test(nh)) return false;
      return nh.includes('contact') || nh.includes('representative') || nh.includes('guardian') || nh.includes('rep');
    });
    if (contactNameHeader) {
      recordMatch(contactNameFieldKey, contactNameHeader);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASS 4: Person Scope Specific Mapping (firstName, lastName, jobTitle)
  // ─────────────────────────────────────────────────────────────────────────────
  if (contactScope === 'person') {
    if (!mappedFieldKeys.has('firstName') && fieldByKey.has('firstName')) {
      const fnHeader = fileHeaders.find(h => !mappedHeaders.has(h) && /first\s*name|given\s*name/i.test(h));
      if (fnHeader) recordMatch('firstName', fnHeader);
    }
    if (!mappedFieldKeys.has('lastName') && fieldByKey.has('lastName')) {
      const lnHeader = fileHeaders.find(h => !mappedHeaders.has(h) && /last\s*name|surname|family\s*name/i.test(h));
      if (lnHeader) recordMatch('lastName', lnHeader);
    }
    if (!mappedFieldKeys.has('jobTitle') && fieldByKey.has('jobTitle')) {
      const jtHeader = fileHeaders.find(h => !mappedHeaders.has(h) && /job\s*title|title|position|role/i.test(h));
      if (jtHeader) recordMatch('jobTitle', jtHeader);
    }
  }

  return {
    mapping: initialMapping,
    detectedSlotCount,
  };
}
