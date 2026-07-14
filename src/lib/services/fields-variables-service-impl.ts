import { cache } from 'react';
import { adminDb } from '../firebase-admin';
import type { 
  UnifiedVariable, 
  GetVariablesParams, 
  DataResolutionContext 
} from '../types/variables';
import { STATIC_VARIABLES } from '../template-variable-registry-data';
import { getEffectiveContactTypes } from '../contact-type-actions';
import type { EntityContact, Entity } from '../types';
import { getBaseUrl } from '../utils/url-helpers';
import { resolveTextWithMap } from '../utils/variable-replacer';

// Request-scoped document lookup caches to prevent redundant round-trips
const getWorkspaceDocCached = cache(async (id: string) => {
  return adminDb.collection('workspaces').doc(id).get();
});

const getOrgDocCached = cache(async (id: string) => {
  return adminDb.collection('organizations').doc(id).get();
});

const getEntityDocCached = cache(async (id: string) => {
  return adminDb.collection('entities').doc(id).get();
});

const getMeetingDocCached = cache(async (id: string) => {
  return adminDb.collection('meetings').doc(id).get();
});

const getFormDocCached = cache(async (id: string) => {
  return adminDb.collection('pdfs').doc(id).get();
});

const getSurveyDocCached = cache(async (id: string) => {
  return adminDb.collection('surveys').doc(id).get();
});

const getAgreementDocCached = cache(async (id: string) => {
  return adminDb.collection('contracts').doc(id).get();
});

const getUserDocCached = cache(async (id: string) => {
  return adminDb.collection('users').doc(id).get();
});

export class FieldsVariablesService {
  /**
   * Returns all normalized variables available for a specific context.
   * Scopes Custom Fields (from app_fields) by workspace industry vertical.
   * Maps dynamic form/survey questions if sourceId is provided.
   */
  static async getVariables(params: GetVariablesParams): Promise<UnifiedVariable[]> {
    const variables: UnifiedVariable[] = [];
    const keysSet = new Set<string>();

    const safePush = (v: UnifiedVariable) => {
      if (!keysSet.has(v.key)) {
        keysSet.add(v.key);
        variables.push(v);
      }
    };

    // 1. Fetch Workspace & Org Details
    let contactScope: 'institution' | 'family' | 'person' = 'institution';
    let industry = 'common';
    let singularTerm = 'Campus';
    let pluralTerm = 'Campuses';

    try {
      const wsSnap = await adminDb.collection('workspaces').doc(params.workspaceId).get();
      if (wsSnap.exists) {
        const wsData = wsSnap.data();
        if (wsData) {
          contactScope = wsData.contactScope ?? 'institution';
          industry = wsData.industry ?? 'common';
          if (wsData.terminology) {
            singularTerm = wsData.terminology.singular ?? singularTerm;
            pluralTerm = wsData.terminology.plural ?? pluralTerm;
          }
        }
      }
    } catch (err) {
      console.warn('[FieldsVariablesService] Failed to load workspace context:', err);
    }

    if (params.terminology) {
      singularTerm = params.terminology.singular;
      pluralTerm = params.terminology.plural;
    }

    // 2. Add Core Static System Variables
    STATIC_VARIABLES.forEach((v) => {
      // Exclude school or focal person or deprecated variables
      if (
        v.name.startsWith('school_') || 
        v.name.includes('focal_person') || 
        v.name === 'entity_email' || 
        v.name === 'entity_phone'
      ) {
        return;
      }

      // Filter by featureContext
      const isCommon = v.context === 'common';
      const matchesContext = !params.featureContext || params.featureContext === 'all' || v.context === params.featureContext;

      if (!isCommon && !matchesContext) {
        return;
      }

      // Translate labels dynamically using active terminology
      let label = v.label;
      if (v.name === 'entity_name') {
        label = `${singularTerm} Name`;
      } else if (label.toLowerCase().includes('entity')) {
        label = label.replace(/Entity/g, singularTerm).replace(/entity/g, singularTerm.toLowerCase());
      }

      safePush({
        key: v.name,
        label,
        category: isCommon ? 'core' : 'feature',
        dataType: (v.dataType as 'string' | 'number' | 'date' | 'url' | 'boolean' | 'html') ?? 'string',
        description: v.description,
        source: 'static',
        featureContext: v.context as 'common' | 'meeting' | 'form' | 'survey' | 'agreement' | 'campaign',
        exampleValue: v.exampleValue ? String(v.exampleValue) : undefined,
      });
    });

    // 3. Add Core Generic Contact Variables
    const coreContacts: Omit<UnifiedVariable, 'key' | 'label'>[] = [
      { category: 'core', dataType: 'string', description: 'Full name of the active contact', source: 'static' },
      { category: 'core', dataType: 'string', description: 'Email address of the active contact', source: 'static' },
      { category: 'core', dataType: 'string', description: 'Phone number of the active contact', source: 'static' },
      { category: 'core', dataType: 'string', description: 'Role or type key of the active contact', source: 'static' }
    ];
    
    safePush({ key: 'contact_name', label: 'Contact Name', ...coreContacts[0] });
    safePush({ key: 'contact_email', label: 'Contact Email', ...coreContacts[1] });
    safePush({ key: 'contact_phone', label: 'Contact Phone', ...coreContacts[2] });
    safePush({ key: 'contact_role', label: 'Contact Role', ...coreContacts[3] });

    // 4. Load Specific Contact Roles (Category: contact_specific)
    try {
      const contactTypes = await getEffectiveContactTypes(contactScope, params.organizationId, params.workspaceId);
      
      // Inject standard 'primary' and 'signatory' specific fields first
      const specificKeys = ['primary', 'signatory', ...contactTypes.map(c => c.key)];
      const uniqueKeys = Array.from(new Set(specificKeys));

      uniqueKeys.forEach((key) => {
        const titleCaseKey = key.charAt(0).toUpperCase() + key.slice(1);
        
        safePush({
          key: `contact_name_${key}`,
          label: `${titleCaseKey} Contact Name`,
          category: 'contact_specific',
          dataType: 'string',
          description: `Full name of the designated ${key} contact`,
          source: 'contact_role',
        });
        safePush({
          key: `contact_email_${key}`,
          label: `${titleCaseKey} Contact Email`,
          category: 'contact_specific',
          dataType: 'string',
          description: `Email address of the designated ${key} contact`,
          source: 'contact_role',
        });
        safePush({
          key: `contact_phone_${key}`,
          label: `${titleCaseKey} Contact Phone`,
          category: 'contact_specific',
          dataType: 'string',
          description: `Phone number of the designated ${key} contact`,
          source: 'contact_role',
        });
        safePush({
          key: `contact_role_${key}`,
          label: `${titleCaseKey} Contact Role`,
          category: 'contact_specific',
          dataType: 'string',
          description: `Effective role label of the designated ${key} contact`,
          source: 'contact_role',
        });
      });
    } catch (err) {
      console.warn('[FieldsVariablesService] Failed to load role-based contact variables:', err);
    }

    // 5. Load Custom & Industry Fields from app_fields
    try {
      const fieldsSnap = await adminDb.collection('app_fields')
        .where('workspaceId', '==', params.workspaceId)
        .where('status', '==', 'active')
        .get();

      fieldsSnap.docs.forEach((doc) => {
        const field = doc.data();
        if (!field || !field.variableName) return;

        // Skip fields that don't match the workspace industry or contactScope
        const matchesScope = !field.compatibilityScope || 
          field.compatibilityScope.length === 0 || 
          field.compatibilityScope.includes('common') || 
          field.compatibilityScope.includes(contactScope);

        if (!matchesScope) return;

        const isNative = !!field.isNative;
        const isIndustry = !!field.industryOrigin && field.industryOrigin !== 'common';

        safePush({
          key: field.variableName,
          label: field.label || field.name,
          category: isNative || isIndustry ? 'industry' : 'custom',
          dataType: field.type === 'number' || field.type === 'currency' ? 'number' :
                    field.type === 'date' || field.type === 'datetime' ? 'date' :
                    field.type === 'url' ? 'url' : 'string',
          description: field.helpText || `Custom ${field.label || field.name} field`,
          source: 'custom_field',
        });
      });
    } catch (err) {
      console.warn('[FieldsVariablesService] Failed to load custom fields from database:', err);
    }

    // 6. Load Dynamic Form / Survey Fields from template_variables
    if (params.featureContext === 'survey' && params.sourceId) {
      try {
        const surveySnap = await adminDb.collection('surveys').doc(params.sourceId).get();
        if (surveySnap.exists) {
          const surveyData = surveySnap.data();
          if (surveyData) {
            // Expose standard Computed Survey Variables
            const surveyStaticVars = [
              { key: 'survey_title', label: 'Survey Title', desc: 'Title of the survey' },
              { key: 'survey_score', label: 'Survey Score (Points)', desc: 'Respondent\'s total score in points' },
              { key: 'score', label: 'Score', desc: 'Alias for survey score' },
              { key: 'max_score', label: 'Survey Max Score', desc: 'Total possible score in the survey' },
              { key: 'outcome_label', label: 'Outcome Label', desc: 'Name of the matched outcome rule' },
              { key: 'submission_date', label: 'Submission Date', desc: 'Formatted date of survey submission' },
              { key: 'contact_name', label: 'Contact Name (Captured)', desc: 'Contact name captured on lead sheet' },
              { key: 'contact_email', label: 'Contact Email (Captured)', desc: 'Contact email captured on lead sheet' },
              { key: 'contact_phone', label: 'Contact Phone (Captured)', desc: 'Contact phone captured on lead sheet' },
              { key: 'result_url', label: 'Survey Results Link', desc: 'Personalized URL to view results' },
              { key: 'survey_results_link', label: 'Survey Results Link (Alias)', desc: 'Personalized URL to view results' },
              { key: 'respondent_name', label: 'Respondent Name', desc: 'Name of the person who filled or is filling out the survey' },
            ];

            surveyStaticVars.forEach((sv) => {
              safePush({
                key: sv.key,
                label: sv.label,
                category: 'feature',
                dataType: sv.key.includes('score') ? 'number' : 'string',
                description: sv.desc,
                source: 'dynamic_form',
                featureContext: 'survey',
              });
            });

            // Expose each question answer dynamically
            const elements = surveyData.elements || [];
            elements.forEach((el: any) => {
              if (el && el.id && (el.title || el.text)) {
                // Determine if it is a question
                const isQ = 'isRequired' in el || ['text', 'long-text', 'email', 'phone', 'number', 'link', 'yes-no', 'multiple-choice', 'checkboxes'].includes(el.type);
                if (isQ) {
                  const plainText = (el.title || el.text || '').replace(/<[^>]*>/gm, '').trim();
                  safePush({
                    key: el.id,
                    label: `Q: ${plainText.substring(0, 50)}${plainText.length > 50 ? '...' : ''}`,
                    category: 'feature',
                    dataType: 'string',
                    description: `User's response to question: "${plainText}"`,
                    source: 'dynamic_form',
                    featureContext: 'survey',
                  });
                }
              }
            });

            // Expose custom lead capture fields dynamically
            const leadFields = surveyData.leadCaptureFieldsConfig || {};
            Object.keys(leadFields).forEach((fKey) => {
              if (fKey !== 'name' && fKey !== 'email' && fKey !== 'phone' && fKey !== 'company') {
                const fCfg = leadFields[fKey];
                if (fCfg && fCfg.show) {
                  safePush({
                    key: fKey,
                    label: `Lead: ${fCfg.label || fKey}`,
                    category: 'feature',
                    dataType: 'string',
                    description: `Captured lead value: "${fCfg.label || fKey}"`,
                    source: 'dynamic_form',
                    featureContext: 'survey',
                  });
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn('[FieldsVariablesService] Failed to load survey questions for variables:', err);
      }
    } else if (params.featureContext === 'form' || params.featureContext === 'survey') {
      try {
        const docsToProcess = params.sourceId
          ? (await adminDb.collection('template_variables')
              .where('sourceFormId', '==', params.sourceId)
              .where('isDynamic', '==', true)
              .where('context', '==', params.featureContext)
              .get()).docs
          : await (async () => {
              const targetCollection = params.featureContext === 'form' ? 'pdfs' : 'surveys';
              const scopeSnap = await adminDb.collection(targetCollection)
                .where('workspaceId', '==', params.workspaceId)
                .get();
              
              const validIds = new Set<string>();
              scopeSnap.docs.forEach(doc => validIds.add(doc.id));
 
              if (validIds.size > 0) {
                const allDynamicVars = await adminDb.collection('template_variables')
                  .where('isDynamic', '==', true)
                  .where('context', '==', params.featureContext)
                  .get();
                
                return allDynamicVars.docs.filter(doc => {
                  const varData = doc.data();
                  return varData && varData.sourceFormId && validIds.has(varData.sourceFormId);
                });
              }
              return [];
            })();

        docsToProcess.forEach((doc) => {
          const variable = doc.data();
          if (!variable || !variable.name) return;

          safePush({
            key: variable.name,
            label: variable.label || variable.name,
            category: 'feature',
            dataType: (variable.dataType as UnifiedVariable['dataType']) || 'string',
            description: variable.description || 'Dynamic submission response field',
            source: 'dynamic_form',
            featureContext: params.featureContext === 'all' ? undefined : params.featureContext,
          });
        });
      } catch (err) {
        console.warn('[FieldsVariablesService] Failed to load dynamic template variables:', err);
      }
    }

    return variables;
  }

  /**
   * Generates a flat key -> value map of all variables for a given data resolution context.
   * Fetches data from Firestore dynamically based on context IDs.
   */
  static async getVariableValuesMap(context: DataResolutionContext): Promise<Map<string, unknown>> {
    const valuesMap = new Map<string, unknown>();

    // 1. Common computed values
    const now = new Date();
    valuesMap.set('current_date', now.toLocaleDateString());
    valuesMap.set('current_time', now.toLocaleTimeString());
    valuesMap.set('current_year', String(now.getFullYear()));

    // Start parallel independent Firestore reads with isolated error handling
    const [
      wsSnap,
      entitySnap,
      meetingSnap,
      formSnap,
      surveySnap,
      agreementSnap,
      userSnap
    ] = await Promise.all([
      // 1. Workspace
      (!context.preloadedWorkspace && context.workspaceId && context.workspaceId !== 'onboarding')
        ? getWorkspaceDocCached(context.workspaceId).catch(err => {
            console.warn('[FieldsVariablesService] Parallel fetch workspaces failed:', err);
            return null;
          })
        : Promise.resolve(null),
      // 2. Entity
      (!context.preloadedEntity && context.entityId)
        ? getEntityDocCached(context.entityId).catch(err => {
            console.warn('[FieldsVariablesService] Parallel fetch entities failed:', err);
            return null;
          })
        : Promise.resolve(null),
      // 3. Meeting
      context.meetingId
        ? getMeetingDocCached(context.meetingId).catch(err => {
            console.warn('[FieldsVariablesService] Parallel fetch meetings failed:', err);
            return null;
          })
        : Promise.resolve(null),
      // 4. Form
      context.formId
        ? getFormDocCached(context.formId).catch(err => {
            console.warn('[FieldsVariablesService] Parallel fetch forms failed:', err);
            return null;
          })
        : Promise.resolve(null),
      // 5. Survey
      context.surveyId
        ? getSurveyDocCached(context.surveyId).catch(err => {
            console.warn('[FieldsVariablesService] Parallel fetch surveys failed:', err);
            return null;
          })
        : Promise.resolve(null),
      // 6. Agreement
      context.agreementId
        ? getAgreementDocCached(context.agreementId).catch(err => {
            console.warn('[FieldsVariablesService] Parallel fetch agreements failed:', err);
            return null;
          })
        : Promise.resolve(null),
      // 7. User
      context.userId
        ? getUserDocCached(context.userId).catch(err => {
            console.warn('[FieldsVariablesService] Parallel fetch users failed:', err);
            return null;
          })
        : Promise.resolve(null)
    ]);

    // 2. Fetch Workspace and Org settings
    try {
      let wsData = context.preloadedWorkspace;
      if (!wsData && wsSnap?.exists) {
        wsData = wsSnap.data();
      }

      if (wsData) {
        valuesMap.set('workspace_name', wsData.name ?? '');
        const organizationId = wsData.organizationId;

        if (organizationId) {
          try {
            const orgSnap = await getOrgDocCached(organizationId);
            if (orgSnap?.exists) {
              const org = orgSnap.data()!;
              valuesMap.set('organization_name', org.name ?? '');
              valuesMap.set('org_name', org.name ?? '');
              valuesMap.set('org_logo_url', org.logoUrl ?? '');
              valuesMap.set('org_email', org.email ?? '');
              valuesMap.set('org_phone', org.phone ?? '');
              valuesMap.set('org_address', org.address ?? '');
              valuesMap.set('org_website', org.website ?? '');
              valuesMap.set('unsubscribe_copy', org.unsubscribeCopy ?? 'You are receiving this email because you subscribed to our services. Click here to unsubscribe.');
              valuesMap.set('brand_primary_color', org.brandPrimaryColor ?? '#3B5FFF');
              valuesMap.set('brand_secondary_color', org.brandSecondaryColor ?? '#8B5CF6');
              valuesMap.set('brand_font_family', org.brandFontFamily ?? 'Figtree');
              valuesMap.set('org_footer_html', org.footerHtml ?? '');
              valuesMap.set('org_footer_enabled', String(org.footerEnabled !== false));
            }
          } catch (err) {
            console.warn('[FieldsVariablesService] Error fetching organization settings:', err);
          }
        }
      }
    } catch (err) {
      console.warn('[FieldsVariablesService] Error processing workspace data:', err);
    }

    // 3. Fetch Entity and Contact variables
    let entityContacts: EntityContact[] = [];
    let entityData = context.preloadedEntity;
    if (!entityData && entitySnap?.exists) {
      entityData = entitySnap.data();
    }

    interface ExtendedEntity extends Entity {
      currentNeeds?: string;
      currentChallenges?: string;
      assignedTo?: {
        userId?: string | null;
        name?: string;
        email?: string | null;
      } | null;
    }

    if (context.entityId || entityData) {
      try {
        if (entityData) {
          const extEntity = entityData as ExtendedEntity;
          valuesMap.set('entity_name', extEntity.name ?? '');

          // Resolve entity fields if initials or geographical info are present
          if (extEntity.initials) valuesMap.set('entity_initials', extEntity.initials);

          // Resolve current situation (needs, challenges) explicitly from root
          if (extEntity.currentNeeds !== undefined) {
            valuesMap.set('currentNeeds', String(extEntity.currentNeeds));
          }
          if (extEntity.currentChallenges !== undefined) {
            valuesMap.set('currentChallenges', String(extEntity.currentChallenges));
          }

          // Format interests as comma-separated string if stored as array
          if (extEntity.interests) {
            const interestsVal = Array.isArray(extEntity.interests)
              ? extEntity.interests.join(', ')
              : String(extEntity.interests);
            valuesMap.set('interests', interestsVal);
          }

          // Flatten sub-buckets for custom fields, online presence, and financial/industry variables
          const buckets = [
            extEntity.financeData,
            extEntity.industryData,
            extEntity.personData,
            extEntity.familyData,
            extEntity.onlinePresence,
            extEntity.customData
          ];

          buckets.forEach((bucket) => {
            if (bucket && typeof bucket === 'object') {
              Object.entries(bucket).forEach(([k, v]) => {
                valuesMap.set(k, v !== null && v !== undefined ? String(v) : '');
              });
            }
          });

          // Resolve assigned_to (account manager / representative) name dynamically
          if (extEntity.assignedTo?.name) {
            valuesMap.set('assigned_to', extEntity.assignedTo.name);
          } else if (extEntity.assignedTo?.userId) {
            try {
              const repSnap = await getUserDocCached(extEntity.assignedTo.userId);
              if (repSnap?.exists) {
                const repData = repSnap.data();
                if (repData) {
                  const repName = repData.name || repData.fullName || repData.displayName || '';
                  valuesMap.set('assigned_to', String(repName));
                }
              }
            } catch (err) {
              console.warn('[FieldsVariablesService] Error fetching representative user details:', err);
            }
          }

          // Resolve tag computed variables (avoiding school/entity renaming errors)
          const targetEntityId = context.entityId || entityData.id;
          if (targetEntityId) {
            const { resolveTagVariables } = await import('../messaging-actions');
            const tagVars = await resolveTagVariables(targetEntityId, 'school', context.workspaceId);
            Object.entries(tagVars).forEach(([k, v]) => {
              valuesMap.set(k, String(v));
            });
          }

          entityContacts = entityData.entityContacts || [];
        }
      } catch (err) {
        console.warn('[FieldsVariablesService] Error fetching entity data for rendering:', err);
      }
    }

    // 4. Resolve Contacts
    if (entityContacts.length > 0) {
      const sortedContacts = [...entityContacts].sort((a, b) => a.order - b.order);
      const primaryContact = entityContacts.find(c => c.isPrimary) || sortedContacts[0];
      const signatoryContact = entityContacts.find(c => c.isSignatory) || primaryContact;

      // Find specific target contact matching recipientContact email or phone digits
      let activeContact = primaryContact;
      if (context.recipientContact) {
        const target = context.recipientContact.toLowerCase().trim();
        const targetDigits = target.replace(/\D/g, '');

        const match = entityContacts.find(c => {
          const emailMatch = c.email && c.email.toLowerCase().trim() === target;
          const phoneMatch = targetDigits && c.phone && c.phone.replace(/\D/g, '') === targetDigits;
          return emailMatch || phoneMatch;
        });

        if (match) {
          activeContact = match;
        }
      }

      // Populate default generic contacts
      valuesMap.set('contact_name', activeContact.name || '');
      valuesMap.set('contact_email', activeContact.email || '');
      valuesMap.set('contact_phone', activeContact.phone || '');
      valuesMap.set('contact_role', activeContact.typeLabel || activeContact.typeKey || '');

      // Populate explicit contact roles (primary, signatory, custom roles)
      valuesMap.set('contact_name_primary', primaryContact.name || '');
      valuesMap.set('contact_email_primary', primaryContact.email || '');
      valuesMap.set('contact_phone_primary', primaryContact.phone || '');
      valuesMap.set('contact_role_primary', primaryContact.typeLabel || primaryContact.typeKey || '');

      valuesMap.set('contact_name_signatory', signatoryContact.name || '');
      valuesMap.set('contact_email_signatory', signatoryContact.email || '');
      valuesMap.set('contact_phone_signatory', signatoryContact.phone || '');
      valuesMap.set('contact_role_signatory', signatoryContact.typeLabel || signatoryContact.typeKey || '');

      entityContacts.forEach((c) => {
        if (!c.typeKey) return;
        valuesMap.set(`contact_name_${c.typeKey}`, c.name || '');
        valuesMap.set(`contact_email_${c.typeKey}`, c.email || '');
        valuesMap.set(`contact_phone_${c.typeKey}`, c.phone || '');
        valuesMap.set(`contact_role_${c.typeKey}`, c.typeLabel || c.typeKey || '');
      });
    }

    // 5. Fetch Meeting details (Category: meeting)
    if (context.meetingId && meetingSnap?.exists) {
      try {
        const meeting = meetingSnap.data()!;
        valuesMap.set('meeting_title', meeting.heroTitle ?? meeting.type?.name ?? '');
        valuesMap.set('meeting_link', meeting.meetingLink ?? '');
        valuesMap.set('meeting_time', meeting.meetingTime ?? '');
        valuesMap.set('meeting_date', meeting.meetingTime ? new Date(meeting.meetingTime).toLocaleDateString() : '');
        valuesMap.set('meeting_type', meeting.type?.name ?? '');
        valuesMap.set('organizer_name', meeting.assignedTo?.name ?? '');
        valuesMap.set('recording_link', meeting.recordingUrl ?? '');
        valuesMap.set('resource_link', meeting.resourceUrl ?? '');
        valuesMap.set('feedback_form_link', meeting.feedbackFormUrl ?? '');

        const baseUrl = getBaseUrl();
        valuesMap.set('dashboard_link', `${baseUrl}/admin/meetings/${context.meetingId}`);

        if (meeting.meetingTime) {
          const { generateCalendarLinkFromMeeting } = await import('../calendar-utils');
          valuesMap.set('calendar_link', generateCalendarLinkFromMeeting(meeting));
        }

        // Fetch registrant stats
        const regSnap = await adminDb.collection('meetings').doc(context.meetingId).collection('registrants')
          .where('status', 'in', ['registered', 'approved', 'attended'])
          .get();

        const allRegs = regSnap?.docs ?? [];
        valuesMap.set('registrant_count', allRegs.length);
        const attendedCount = allRegs.filter(d => d.data().status === 'attended').length;
        valuesMap.set('attendee_count', attendedCount);
        valuesMap.set('no_show_count', allRegs.length - attendedCount);
      } catch (err) {
        console.warn('[FieldsVariablesService] Error fetching meeting for rendering:', err);
      }
    }

    // 6. Fetch Form details
    if (context.formId && formSnap?.exists) {
      try {
        const form = formSnap.data()!;
        valuesMap.set('form_name', form.name ?? form.title ?? '');
        valuesMap.set('form_link', form.publicUrl ?? '');
        valuesMap.set('submission_deadline', form.deadline ?? '');
        valuesMap.set('deadline', form.deadline ?? '');

        // Pre-populate dynamic variables registry
        try {
          const dynamicVarsSnap = await adminDb
            .collection('template_variables')
            .where('sourceFormId', '==', context.formId)
            .where('isDynamic', '==', true)
            .get();
          
          dynamicVarsSnap.docs.forEach((doc) => {
            const vData = doc.data();
            if (vData && vData.name) {
              valuesMap.set(vData.name, '');
            }
          });
        } catch (err) {
          console.warn('[FieldsVariablesService] Error fetching dynamic form variables:', err);
        }

        if (context.submissionId) {
          const subSnap = await adminDb.collection('pdfs').doc(context.formId).collection('submissions').doc(context.submissionId).get();
          if (subSnap.exists) {
            const submission = subSnap.data()!;
            valuesMap.set('respondent_name', submission.respondentName ?? '');
            valuesMap.set('submission_date', submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : '');
            
            if (submission.fields && typeof submission.fields === 'object') {
              Object.entries(submission.fields).forEach(([fieldId, val]) => {
                valuesMap.set(`form_fields.${fieldId}`, val !== null && val !== undefined ? String(val) : '');
              });
            }
          }
        }
      } catch (err) {
        console.warn('[FieldsVariablesService] Error fetching form data for rendering:', err);
      }
    }

    // 7. Fetch Survey details
    if (context.surveyId && surveySnap?.exists) {
      try {
        const survey = surveySnap.data()!;
        valuesMap.set('survey_title', survey.title ?? '');
        valuesMap.set('survey_link', survey.publicUrl ?? '');
        const baseUrl = getBaseUrl();
        valuesMap.set('dashboard_link', `${baseUrl}/admin/surveys/${context.surveyId}`);

        // Initialize respondent_name with contact fallback first
        const activeContactName = valuesMap.get('contact_name') as string | undefined;
        const activeEntityName = valuesMap.get('entity_name') as string | undefined;
        valuesMap.set('respondent_name', activeContactName || activeEntityName || '');

        // Pre-populate dynamic variables registry
        try {
          const dynamicVarsSnap = await adminDb
            .collection('template_variables')
            .where('sourceFormId', '==', context.surveyId)
            .where('isDynamic', '==', true)
            .get();
          
          dynamicVarsSnap.docs.forEach((doc) => {
            const vData = doc.data();
            if (vData && vData.name) {
              valuesMap.set(vData.name, '');
            }
          });
        } catch (err) {
          console.warn('[FieldsVariablesService] Error fetching dynamic survey variables:', err);
        }

        let responseId = context.responseId;
        let responseData: Record<string, unknown> | null = null;

        if (responseId) {
          const respSnap = await adminDb.collection('surveys').doc(context.surveyId).collection('responses').doc(responseId).get();
          if (respSnap.exists) {
            responseData = respSnap.data() as Record<string, unknown>;
          }
        } else if (context.entityId) {
          // Attempt compound query first with in-memory sort fallback
          try {
            const respQuery = await adminDb.collection('surveys')
              .doc(context.surveyId)
              .collection('responses')
              .where('entityId', '==', context.entityId)
              .orderBy('submittedAt', 'desc')
              .limit(1)
              .get();
            
            if (!respQuery.empty) {
              responseId = respQuery.docs[0].id;
              responseData = respQuery.docs[0].data() as Record<string, unknown>;
            }
          } catch (err) {
            console.warn('[FieldsVariablesService] Compound query failed, executing fallback in-memory sort:', err);
            // Fallback: simple query (does not require compound index)
            try {
              const respQuery = await adminDb.collection('surveys')
                .doc(context.surveyId)
                .collection('responses')
                .where('entityId', '==', context.entityId)
                .get();
              
              if (!respQuery.empty) {
                const sortedDocs = [...respQuery.docs].sort((a, b) => {
                  const aVal = String(a.data().submittedAt || '');
                  const bVal = String(b.data().submittedAt || '');
                  return bVal.localeCompare(aVal);
                });
                responseId = sortedDocs[0].id;
                responseData = sortedDocs[0].data() as Record<string, unknown>;
              }
            } catch (fallbackErr) {
              console.warn('[FieldsVariablesService] Fallback query failed:', fallbackErr);
            }
          }
        } else if (context.recipientContact) {
          // Attempt email/phone match if entityId is not available
          const target = context.recipientContact.toLowerCase().trim();
          const targetDigits = target.replace(/\D/g, '');
          
          try {
            const respQuery = await adminDb.collection('surveys')
              .doc(context.surveyId)
              .collection('responses')
              .get();
            
            const matchedDocs = respQuery.docs.filter((doc) => {
              const data = doc.data();
              if (!data) return false;
              const leadEmail = String(data.leadDetails?.email || data.email || '').toLowerCase().trim();
              const leadPhone = String(data.leadDetails?.phone || data.phone || '').replace(/\D/g, '');
              
              return (leadEmail && leadEmail === target) || (targetDigits && leadPhone && leadPhone.endsWith(targetDigits));
            });

            if (matchedDocs.length > 0) {
              const sortedDocs = matchedDocs.sort((a, b) => {
                const aVal = String(a.data().submittedAt || '');
                const bVal = String(b.data().submittedAt || '');
                return bVal.localeCompare(aVal);
              });
              responseId = sortedDocs[0].id;
              responseData = sortedDocs[0].data() as Record<string, unknown>;
            }
          } catch (err) {
            console.warn('[FieldsVariablesService] Recipient contact matching failed:', err);
          }
        }

        const surveySlug = survey.slug || context.surveyId;
        if (responseId && responseData) {
          const leadDetails = responseData.leadDetails as Record<string, unknown> | undefined;
          const rName = responseData.respondentName || leadDetails?.name || leadDetails?.contactName;
          if (rName) {
            valuesMap.set('respondent_name', String(rName));
          }
          if (responseData.score !== undefined) {
            valuesMap.set('score', responseData.score);
            valuesMap.set('survey_score', responseData.score);
          }
          const resolvedMaxScore = responseData.maxScore !== undefined ? responseData.maxScore : survey.maxScore;
          if (resolvedMaxScore !== undefined) {
            valuesMap.set('max_score', resolvedMaxScore);
          }
          valuesMap.set('result_message', responseData.resultMessage ?? '');
          valuesMap.set('completion_date', responseData.submittedAt ? new Date(String(responseData.submittedAt)).toLocaleDateString() : '');
          valuesMap.set('completion_status', responseData.status ?? 'Completed');
          valuesMap.set('outcome_label', responseData.outcome ?? '');
          
          const personalizedUrl = `${baseUrl}/surveys/${surveySlug}/result/${responseId}`;
          valuesMap.set('result_url', personalizedUrl);
          valuesMap.set('survey_results_link', personalizedUrl);

          if (responseData.answers && typeof responseData.answers === 'object') {
            if (Array.isArray(responseData.answers)) {
              responseData.answers.forEach((ans: unknown) => {
                if (ans && typeof ans === 'object' && 'questionId' in ans && 'value' in ans) {
                  const qAns = ans as { questionId: string; value: unknown };
                  const valStr = typeof qAns.value === 'object' ? JSON.stringify(qAns.value) : String(qAns.value);
                  valuesMap.set(`survey_fields.${qAns.questionId}`, valStr);
                  valuesMap.set(qAns.questionId, valStr);
                }
              });
            } else {
              Object.entries(responseData.answers).forEach(([questionId, val]) => {
                const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
                valuesMap.set(`survey_fields.${questionId}`, valStr);
                valuesMap.set(questionId, valStr);
              });
            }
          }

          if (responseData.leadDetails && typeof responseData.leadDetails === 'object') {
            Object.entries(responseData.leadDetails).forEach(([fKey, val]) => {
              const valStr = val !== null && val !== undefined ? String(val) : '';
              valuesMap.set(fKey, valStr);
              valuesMap.set(`lead_${fKey}`, valStr);
            });
          }
        } else {
          // Fallback to public survey link if no response completed yet
          const publicUrl = survey.publicUrl || `${baseUrl}/surveys/${surveySlug}`;
          valuesMap.set('result_url', publicUrl);
          valuesMap.set('survey_results_link', publicUrl);
          valuesMap.set('score', 0);
          valuesMap.set('survey_score', 0);
          valuesMap.set('max_score', survey.maxScore || 100);
          valuesMap.set('result_message', '');
          valuesMap.set('completion_date', '');
          valuesMap.set('completion_status', 'Pending');
          valuesMap.set('outcome_label', '');
        }
      } catch (err) {
        console.warn('[FieldsVariablesService] Error fetching survey data for rendering:', err);
      }
    }

    // 8. Fetch Agreement details
    if (context.agreementId && agreementSnap?.exists) {
      try {
        const contract = agreementSnap.data()!;
        valuesMap.set('contract_name', contract.name ?? contract.title ?? '');
        valuesMap.set('contract_link', contract.signingUrl ?? contract.publicUrl ?? '');
        valuesMap.set('signatory_name', contract.signatoryName ?? '');
        valuesMap.set('deadline', contract.deadline ?? '');
        valuesMap.set('contract_status', contract.status ?? '');
        valuesMap.set('signing_date', contract.signedAt ? new Date(contract.signedAt).toLocaleDateString() : '');
      } catch (err) {
        console.warn('[FieldsVariablesService] Error fetching contract data for rendering:', err);
      }
    }

    // 8.5. Fetch User details
    if (context.userId && userSnap?.exists) {
      try {
        const user = userSnap.data()!;
        valuesMap.set('user_name', user.name ?? user.fullName ?? user.displayName ?? '');
        valuesMap.set('user_email', user.email ?? '');
        valuesMap.set('user_phone', user.phone ?? '');
      } catch (err) {
        console.warn('[FieldsVariablesService] Error fetching user data for rendering:', err);
      }
    }

    // 9. Merge caller overrides / extra variables
    if (context.extraVars) {
      Object.entries(context.extraVars).forEach(([k, v]) => {
        valuesMap.set(k, v !== null && v !== undefined ? String(v) : '');
      });
    }

    return valuesMap;
  }

  /**
   * Synchronously substitutes dynamic variables inside text using a pre-fetched values map.
   */
  static resolveTextWithMap(templateText: string, valuesMap: Map<string, unknown>, keepMissing = true): string {
    return resolveTextWithMap(templateText, valuesMap, keepMissing);
  }

  /**
   * Replaces all {{tag}} tokens in standard template text.
   * Resolves generic contact_* to recipientContact first, then falls back to isPrimary contact.
   */
  static async resolveTemplateVariables(
    templateText: string,
    context: DataResolutionContext
  ): Promise<string> {
    const valuesMap = await this.getVariableValuesMap(context);
    return this.resolveTextWithMap(templateText, valuesMap, false);
  }

  /**
   * Resolves the entityId and recipientContact identifier based on URL search query parameters.
   * Leverages automatic single-field indexes securely on the server-side to avoid compound index restrictions.
   */
  static async resolveEntityContextFromParams(
    workspaceIds: string[],
    searchParams: Record<string, string>
  ): Promise<{ entityId: string | null; recipientContact: string | null }> {
    const entityIdParam = searchParams.entityId || searchParams.entity;
    const emailParam = searchParams.email || searchParams.contactEmail;
    const phoneParam = searchParams.phone || searchParams.contactPhone;
    const contactIdParam = searchParams.contactId || searchParams.contact;

    // 1. Direct Contact ID lookup
    if (contactIdParam) {
      try {
        let targetContactId = contactIdParam;
        let targetEntityId: string | null = null;
        if (contactIdParam.includes(':')) {
          const parts = contactIdParam.split(':');
          targetContactId = parts[0];
          targetEntityId = parts[1];
        }

        if (targetEntityId) {
          const weSnap = await adminDb.collection('workspace_entities')
            .where('workspaceId', 'in', workspaceIds)
            .where('entityId', '==', targetEntityId)
            .limit(1)
            .get();
          if (!weSnap.empty) {
            const doc = weSnap.docs[0];
            const data = doc.data();
            const contacts = (data.entityContacts || []) as EntityContact[];
            const found = contacts.find(c => c.id === targetContactId);
            if (found) {
              return { 
                entityId: (data.entityId as string) || null, 
                recipientContact: found.email || found.phone || null 
              };
            }
          }
        } else {
          // Fallback capped scan to avoid hanging the server when database size is huge
          const allSnaps = await adminDb.collection('workspace_entities')
            .where('workspaceId', 'in', workspaceIds)
            .limit(200)
            .get();
          for (const doc of allSnaps.docs) {
            const data = doc.data();
            const contacts = (data.entityContacts || []) as EntityContact[];
            const found = contacts.find(c => c.id === contactIdParam);
            if (found) {
              return { 
                entityId: (data.entityId as string) || null, 
                recipientContact: found.email || found.phone || null 
              };
            }
          }
        }
      } catch (err) {
        console.warn('[FieldsVariablesService] Error resolving entityId by contactId parameter:', err);
      }
    }

    // 2. Direct ID lookup
    if (entityIdParam) {
      try {
        const snap = await adminDb.collection('workspace_entities')
          .where('entityId', '==', entityIdParam)
          .get();
        const docMatch = snap.docs.find(doc => {
          const wId = doc.data().workspaceId;
          return workspaceIds.includes(wId);
        });
        if (docMatch) {
          return { entityId: entityIdParam, recipientContact: emailParam || phoneParam || null };
        }
      } catch (err) {
        console.warn('[FieldsVariablesService] Error verifying entityId parameter:', err);
      }
    }

    // 2. Email-based lookup
    if (emailParam) {
      const cleanEmail = emailParam.toLowerCase().trim();
      if (cleanEmail) {
        try {
          // Query workspace_entities globally using automatic single-field indexes
          const snap = await adminDb.collection('workspace_entities')
            .where('primaryEmail', '==', cleanEmail)
            .get();
          // Filter by workspace tenancy in memory
          const docMatch = snap.docs.find(doc => {
            const wId = doc.data().workspaceId;
            return workspaceIds.includes(wId);
          });
          if (docMatch) {
            const data = docMatch.data();
            return { entityId: (data.entityId as string) || null, recipientContact: cleanEmail };
          }

          // Fallback: search within nested contact records in memory if needed
          const allSnaps = await adminDb.collection('workspace_entities')
            .where('workspaceId', 'in', workspaceIds)
            .get();
          for (const doc of allSnaps.docs) {
            const data = doc.data();
            const contacts = (data.entityContacts || []) as EntityContact[];
            const found = contacts.some(c => c.email && c.email.toLowerCase().trim() === cleanEmail);
            if (found) {
              return { entityId: (data.entityId as string) || null, recipientContact: cleanEmail };
            }
          }
        } catch (err) {
          console.warn('[FieldsVariablesService] Error resolving entityId by email parameter:', err);
        }
      }
    }

    // 3. Phone-based lookup
    if (phoneParam) {
      const targetDigits = phoneParam.replace(/\D/g, '');
      if (targetDigits) {
        try {
          // Scan within nested contact records in memory
          const allSnaps = await adminDb.collection('workspace_entities')
            .where('workspaceId', 'in', workspaceIds)
            .get();
          for (const doc of allSnaps.docs) {
            const data = doc.data();
            const contacts = (data.entityContacts || []) as EntityContact[];
            const found = contacts.some(c => {
              const digits = c.phone ? c.phone.replace(/\D/g, '') : '';
              return digits && digits.endsWith(targetDigits); // robust match on suffix digits
            });
            if (found) {
              return { entityId: (data.entityId as string) || null, recipientContact: phoneParam };
            }
          }
        } catch (err) {
          console.warn('[FieldsVariablesService] Error resolving entityId by phone parameter:', err);
        }
      }
    }

    return { entityId: null, recipientContact: null };
  }
}
