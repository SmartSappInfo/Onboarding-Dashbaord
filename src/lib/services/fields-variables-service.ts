'use server';

import { adminDb } from '../firebase-admin';
import type { 
  UnifiedVariable, 
  GetVariablesParams, 
  DataResolutionContext 
} from '../types/variables';
import { STATIC_VARIABLES } from '../template-variable-registry-data';
import { getEffectiveContactTypes } from '../contact-type-actions';
import type { EntityContact } from '../types';
import { getBaseUrl } from '../utils/url-helpers';

export class FieldsVariablesService {
  /**
   * Returns all normalized variables available for a specific context.
   * Scopes Custom Fields (from app_fields) by workspace industry vertical.
   * Maps dynamic form/survey questions if sourceId is provided.
   */
  static async getVariables(params: GetVariablesParams): Promise<UnifiedVariable[]> {
    const variables: UnifiedVariable[] = [];

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

      variables.push({
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
    
    variables.push(
      { key: 'contact_name', label: 'Contact Name', ...coreContacts[0] },
      { key: 'contact_email', label: 'Contact Email', ...coreContacts[1] },
      { key: 'contact_phone', label: 'Contact Phone', ...coreContacts[2] },
      { key: 'contact_role', label: 'Contact Role', ...coreContacts[3] }
    );

    // 4. Load Specific Contact Roles (Category: contact_specific)
    try {
      const contactTypes = await getEffectiveContactTypes(contactScope, params.organizationId, params.workspaceId);
      
      // Inject standard 'primary' and 'signatory' specific fields first
      const specificKeys = ['primary', 'signatory', ...contactTypes.map(c => c.key)];
      const uniqueKeys = Array.from(new Set(specificKeys));

      uniqueKeys.forEach((key) => {
        const titleCaseKey = key.charAt(0).toUpperCase() + key.slice(1);
        
        variables.push({
          key: `contact_name_${key}`,
          label: `${titleCaseKey} Contact Name`,
          category: 'contact_specific',
          dataType: 'string',
          description: `Full name of the designated ${key} contact`,
          source: 'contact_role',
        });
        variables.push({
          key: `contact_email_${key}`,
          label: `${titleCaseKey} Contact Email`,
          category: 'contact_specific',
          dataType: 'string',
          description: `Email address of the designated ${key} contact`,
          source: 'contact_role',
        });
        variables.push({
          key: `contact_phone_${key}`,
          label: `${titleCaseKey} Contact Phone`,
          category: 'contact_specific',
          dataType: 'string',
          description: `Phone number of the designated ${key} contact`,
          source: 'contact_role',
        });
        variables.push({
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

        variables.push({
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
    if (params.featureContext === 'form' || params.featureContext === 'survey') {
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

          variables.push({
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

    // 2. Fetch Workspace and Org settings
    try {
      let wsData = context.preloadedWorkspace;
      let organizationId = wsData?.organizationId;
      
      if (!wsData && context.workspaceId !== 'onboarding') {
        const wsSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
        if (wsSnap.exists) {
          wsData = wsSnap.data();
          organizationId = wsData?.organizationId;
        }
      }

      if (wsData) {
        valuesMap.set('workspace_name', wsData.name ?? '');

        if (organizationId) {
          const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
          if (orgSnap.exists) {
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
        }
      }
    } catch (err) {
      console.warn('[FieldsVariablesService] Error fetching workspace/org for rendering:', err);
    }

    // 3. Fetch Entity and Contact variables
    let entityContacts: EntityContact[] = [];
    let entityData = context.preloadedEntity;

    if (context.entityId || entityData) {
      try {
        if (!entityData && context.entityId) {
          const entitySnap = await adminDb.collection('entities').doc(context.entityId).get();
          if (entitySnap.exists) {
            entityData = entitySnap.data();
          }
        }

        if (entityData) {
          valuesMap.set('entity_name', entityData.name ?? '');

          // Resolve entity fields if initials or geographical info are present
          if (entityData.initials) valuesMap.set('entity_initials', entityData.initials);

          // Flatten sub-buckets for custom fields and industry vertical variables
          const buckets = [
            entityData.financeData,
            entityData.industryData,
            entityData.personData,
            entityData.familyData,
            entityData.customData
          ];

          buckets.forEach((bucket) => {
            if (bucket && typeof bucket === 'object') {
              Object.entries(bucket).forEach(([k, v]) => {
                valuesMap.set(k, v !== null && v !== undefined ? String(v) : '');
              });
            }
          });

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
    if (context.meetingId) {
      try {
        const snap = await adminDb.collection('meetings').doc(context.meetingId).get();
        if (snap.exists) {
          const meeting = snap.data()!;
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
          valuesMap.set('registrant_count', String(allRegs.length));
          const attendedCount = allRegs.filter(d => d.data().status === 'attended').length;
          valuesMap.set('attendee_count', String(attendedCount));
          valuesMap.set('no_show_count', String(allRegs.length - attendedCount));
        }
      } catch (err) {
        console.warn('[FieldsVariablesService] Error fetching meeting for rendering:', err);
      }
    }

    // 6. Fetch Form details
    if (context.formId) {
      try {
        const snap = await adminDb.collection('pdfs').doc(context.formId).get();
        if (snap.exists) {
          const form = snap.data()!;
          valuesMap.set('form_name', form.name ?? form.title ?? '');
          valuesMap.set('form_link', form.publicUrl ?? '');
          valuesMap.set('submission_deadline', form.deadline ?? '');
          valuesMap.set('deadline', form.deadline ?? '');
        }

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
    if (context.surveyId) {
      try {
        const snap = await adminDb.collection('surveys').doc(context.surveyId).get();
        if (snap.exists) {
          const survey = snap.data()!;
          valuesMap.set('survey_title', survey.title ?? '');
          valuesMap.set('survey_link', survey.publicUrl ?? '');
          const baseUrl = getBaseUrl();
          valuesMap.set('dashboard_link', `${baseUrl}/admin/surveys/${context.surveyId}`);
        }

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

        if (context.responseId) {
          const respSnap = await adminDb.collection('surveys').doc(context.surveyId).collection('responses').doc(context.responseId).get();
          if (respSnap.exists) {
            const response = respSnap.data()!;
            if (response.score !== undefined) valuesMap.set('score', response.score);
            valuesMap.set('result_message', response.resultMessage ?? '');
            valuesMap.set('completion_date', response.submittedAt ? new Date(response.submittedAt).toLocaleDateString() : '');
            valuesMap.set('completion_status', response.status ?? 'Completed');

            if (response.answers && typeof response.answers === 'object') {
              Object.entries(response.answers).forEach(([questionId, val]) => {
                valuesMap.set(`survey_fields.${questionId}`, val !== null && val !== undefined ? String(val) : '');
              });
            }
          }
        }
      } catch (err) {
        console.warn('[FieldsVariablesService] Error fetching survey data for rendering:', err);
      }
    }

    // 8. Fetch Agreement details
    if (context.agreementId) {
      try {
        const snap = await adminDb.collection('contracts').doc(context.agreementId).get();
        if (snap.exists) {
          const contract = snap.data()!;
          valuesMap.set('contract_name', contract.name ?? contract.title ?? '');
          valuesMap.set('contract_link', contract.signingUrl ?? contract.publicUrl ?? '');
          valuesMap.set('signatory_name', contract.signatoryName ?? '');
          valuesMap.set('deadline', contract.deadline ?? '');
          valuesMap.set('contract_status', contract.status ?? '');
          valuesMap.set('signing_date', contract.signedAt ? new Date(contract.signedAt).toLocaleDateString() : '');
        }
      } catch (err) {
        console.warn('[FieldsVariablesService] Error fetching contract data for rendering:', err);
      }
    }

    // 8.5. Fetch User details
    if (context.userId) {
      try {
        const snap = await adminDb.collection('users').doc(context.userId).get();
        if (snap.exists) {
          const user = snap.data()!;
          valuesMap.set('user_name', user.name ?? user.fullName ?? user.displayName ?? '');
          valuesMap.set('user_email', user.email ?? '');
          valuesMap.set('user_phone', user.phone ?? '');
        }
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
  static resolveTextWithMap(templateText: string, valuesMap: Map<string, unknown>): string {
    if (!templateText) return '';
    return templateText.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const cleanKey = key.trim();
      const val = valuesMap.get(cleanKey);
      return val !== undefined ? String(val) : '';
    });
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
    return this.resolveTextWithMap(templateText, valuesMap);
  }
}
