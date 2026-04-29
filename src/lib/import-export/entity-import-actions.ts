'use server';

/**
 * @fileOverview Server Actions for the Advanced Entity Import Wizard.
 *
 * These actions handle validation, duplicate detection, batch execution,
 * and session management. They delegate entity creation to the canonical
 * `createEntityAction` to guarantee backward compatibility with existing
 * entity + workspace_entity patterns (Requirement 14).
 *
 * Requirements: 1-20 (Advanced Entity Import with Mapping)
 */

import { adminDb } from '../firebase-admin';
import { logActivity } from '../activity-logger';
import { validateScopeMatch } from '../scope-guard';
import { createEntityAction } from '../entity-actions';
import { validateContactIdentifier } from '../contact-policy';
import type { EntityType, Workspace, ContactIdentifierPolicy } from '../types';
import type {
  ColumnMapping,
  ValidationSummary,
  ExecutionSummary,
} from '@/app/admin/contacts/import/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Applies a column-mapping configuration to a raw CSV row, producing a
 * flat object keyed by target entity fields.
 */
function applyMappings(
  row: Record<string, string>,
  mappings: ColumnMapping[]
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const m of mappings) {
    if (m.targetField && row[m.csvColumn] !== undefined) {
      mapped[m.targetField] = row[m.csvColumn].trim();
    }
  }
  return mapped;
}

/**
 * Normalise a name for duplicate comparison – lowercase, trim, strip
 * non-alphanumeric characters.
 */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Basic email validation (RFC 5322 simplified).
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Basic phone validation – allow digits, spaces, dashes, parens, plus sign.
 */
function isValidPhone(phone: string): boolean {
  return /^[+\d\s\-()]{7,20}$/.test(phone);
}

// ─── Validate Import Batch ────────────────────────────────────────────────────

/**
 * Runs schema checks, required-field checks, type validation, and duplicate
 * detection on a preview batch of rows.
 *
 * This is called from the Validation step (step 3) of the wizard.
 */
export async function validateImportBatch(
  rows: Record<string, string>[],
  mappings: ColumnMapping[],
  entityType: EntityType,
  totalRowCount: number,
  workspaceId?: string,
  organizationId?: string
): Promise<ValidationSummary> {
  const errors: ValidationSummary['errors'] = [];
  const duplicates: ValidationSummary['duplicates'] = [];
  const previewRows: any[] = [];
  let validRows = 0;

  // 1. ScopeGuard – make sure workspace accepts this entity type & read contact policy
  let contactPolicy: ContactIdentifierPolicy = 'phone_or_email';
  if (workspaceId) {
    const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (wsSnap.exists) {
      const workspace = { id: wsSnap.id, ...wsSnap.data() } as Workspace;
      contactPolicy = workspace.contactPolicy || 'phone_or_email';
      if (workspace.contactScope) {
        const scopeCheck = validateScopeMatch(entityType, workspace.contactScope);
        if (!scopeCheck.valid) {
          return {
            totalRows: totalRowCount,
            validRows: 0,
            duplicateRows: 0,
            errorRows: totalRowCount,
            errors: [
              {
                rowNumber: 0,
                reason: `Scope mismatch: workspace requires "${workspace.contactScope}" but you are importing "${entityType}".`,
              },
            ],
            duplicates: [],
            previewRows: [],
          };
        }
      }
    }
  }

  // 2. Build a Set of existing entity names for duplicate checking (batched)
  const orgId = organizationId || 'smartsapp-hq';
  const existingNames = new Map<string, string>(); // normalised name → entityId

  const existingSnap = await adminDb
    .collection('entities')
    .where('organizationId', '==', orgId)
    .where('entityType', '==', entityType)
    .select('name')
    .get();

  for (const doc of existingSnap.docs) {
    const name = doc.data()?.name;
    if (name) {
      existingNames.set(normaliseName(name), doc.id);
    }
  }

  // 3. Walk each row
  for (let i = 0; i < rows.length; i++) {
    const mapped = applyMappings(rows[i], mappings);
    const rowNum = i + 1;
    let rowValid = true;

    // 3a. Derive entity name & Contact Name Sync
    let entityName = '';
    let contactName = mapped.focalPerson_name || mapped.contactName || '';

    if (entityType === 'person') {
      entityName = `${mapped.firstName || ''} ${mapped.lastName || ''}`.trim();
      if (!entityName && contactName) {
        // Sync backwards
        entityName = contactName;
        mapped.firstName = contactName;
      }
      if (!entityName && (mapped.email || mapped.phone)) {
        entityName = `[Placeholder] ${mapped.email || mapped.phone}`;
      }
    } else if (entityType === 'family') {
      entityName =
        mapped.familyName ||
        mapped.guardian1_name ||
        contactName ||
        '';
      if (!entityName && (mapped.guardian1_email || mapped.guardian1_phone || mapped.email || mapped.phone)) {
        entityName = `[Placeholder] ${mapped.guardian1_email || mapped.guardian1_phone || mapped.email || mapped.phone}`;
      }
    } else {
      entityName = mapped.name || contactName || '';
      if (!entityName && (mapped.focalPerson_email || mapped.focalPerson_phone || mapped.email || mapped.phone)) {
        entityName = `[Placeholder] ${mapped.focalPerson_email || mapped.focalPerson_phone || mapped.email || mapped.phone}`;
      }
    }

    // 3b. Required field checks (Relaxed for MVE)
    if (!entityName) {
      errors.push({ rowNumber: rowNum, reason: 'Missing identifier (Name, Email, or Phone required)' });
      rowValid = false;
    }

    // 3b2. Contact policy check — enforce workspace identifier requirements
    if (rowValid) {
      const rowPhone = mapped.phone || mapped.focalPerson_phone || mapped.guardian1_phone || '';
      const rowEmail = mapped.email || mapped.focalPerson_email || mapped.guardian1_email || '';
      const policyResult = validateContactIdentifier(rowPhone, rowEmail, contactPolicy);
      if (!policyResult.valid) {
        errors.push({ rowNumber: rowNum, reason: policyResult.reason || 'Missing required identifier per workspace policy' });
        rowValid = false;
      }
    }

    // 3c. Type validation
    if (mapped.email && !isValidEmail(mapped.email)) {
      errors.push({ rowNumber: rowNum, reason: `Invalid email format: "${mapped.email}"` });
      rowValid = false;
    }
    if (mapped.focalPerson_email && !isValidEmail(mapped.focalPerson_email)) {
      errors.push({ rowNumber: rowNum, reason: `Invalid focal person email: "${mapped.focalPerson_email}"` });
      rowValid = false;
    }
    if (mapped.guardian1_email && !isValidEmail(mapped.guardian1_email)) {
      errors.push({ rowNumber: rowNum, reason: `Invalid guardian email: "${mapped.guardian1_email}"` });
      rowValid = false;
    }
    if (mapped.phone && !isValidPhone(mapped.phone)) {
      errors.push({ rowNumber: rowNum, reason: `Invalid phone format: "${mapped.phone}"` });
      rowValid = false;
    }
    if (mapped.nominalRoll && isNaN(Number(mapped.nominalRoll))) {
      errors.push({ rowNumber: rowNum, reason: `nominalRoll must be a number, got "${mapped.nominalRoll}"` });
      rowValid = false;
    }

    // 3d. Duplicate detection (case-insensitive, normalised)
    if (entityName) {
      const normalised = normaliseName(entityName);
      const existingId = existingNames.get(normalised);
      if (existingId) {
        duplicates.push({ rowNumber: rowNum, entityId: existingId, name: entityName });
        rowValid = false; // Mark as not importable by default (skip)
      }
    }

    if (rowValid) {
      validRows++;
      if (previewRows.length < 10) {
        previewRows.push(mapped);
      }
    }
  }

  // Extrapolate counts for full file (we only validated the preview batch)
  const ratio = totalRowCount / (rows.length || 1);

  return {
    totalRows: totalRowCount,
    validRows: Math.round(validRows * ratio),
    duplicateRows: Math.round(duplicates.length * ratio),
    errorRows: Math.round(errors.length * ratio),
    errors,
    duplicates,
    previewRows,
  };
}

// ─── Execute Import Batch ─────────────────────────────────────────────────────

/**
 * Processes a batch of CSV rows, mapping them to entity creation payloads and
 * delegating to `createEntityAction` for each row.
 *
 * Returns per-batch success/failure counts so the client can aggregate them.
 */
export async function executeImportBatch(
  rows: Record<string, string>[],
  mappings: ColumnMapping[],
  entityType: EntityType,
  workspaceId?: string,
  organizationId?: string,
  userId?: string,
  pipelineId?: string,
  stageId?: string,
  configuration?: {
    selectedTags?: string[];
    selectedAutomations?: string[];
    globalDefaults?: Record<string, string>;
  }
): Promise<ExecutionSummary & { createdIds?: string[] }> {
  const uid = userId || 'system-import';
  const wsId = workspaceId || '';
  const orgId = organizationId || 'smartsapp-hq';

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const failedRows: ExecutionSummary['failedRows'] = [];
  const createdIds: string[] = [];

  // District Resolution Cache
  const districtCache = new Map<string, { id: string; name: string }>();

  // Fetch workspace entityDefaults for merging (lowest priority layer)
  let workspaceDefaults: Record<string, string> = {};
  if (wsId) {
    try {
      const wsSnap = await adminDb.collection('workspaces').doc(wsId).get();
      if (wsSnap.exists) {
        const wsData = wsSnap.data() as Workspace;
        const scope = (wsData.contactScope || entityType) as 'institution' | 'family' | 'person';
        workspaceDefaults = wsData.entityDefaults?.[scope] || {};
      }
    } catch {
      // Non-critical — proceed without workspace defaults
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const mapped = applyMappings(rows[i], mappings);
    
    // Merge defaults: Workspace defaults (lowest) then Config step defaults
    for (const [key, val] of Object.entries(workspaceDefaults)) {
      if (!mapped[key] && val) {
        mapped[key] = val;
      }
    }
    if (configuration?.globalDefaults) {
      for (const [key, val] of Object.entries(configuration.globalDefaults)) {
        if (!mapped[key] && val) {
          mapped[key] = val;
        }
      }
    }

    // Auto-create district if name is provided (Requirement: Auto-seed districts on import)
    const dName = mapped.districtName?.trim();
    const rId = mapped.regionId || configuration?.globalDefaults?.regionId; // Region is required to create a district
    
    if (dName && !mapped.districtId && rId && orgId) {
      const cacheKey = `${rId}_${dName.toLowerCase()}`;
      if (districtCache.has(cacheKey)) {
        mapped.districtId = districtCache.get(cacheKey)!.id;
      } else {
        // Query Firestore
        try {
          const dSnap = await adminDb.collection('districts')
            .where('organizationId', '==', orgId)
            .where('regionId', '==', rId)
            .where('name', '==', dName)
            .limit(1).get();
            
          if (!dSnap.empty) {
            const dId = dSnap.docs[0].id;
            districtCache.set(cacheKey, { id: dId, name: dName });
            mapped.districtId = dId;
          } else {
            // Create it
            const newRef = await adminDb.collection('districts').add({
              name: dName,
              regionId: rId,
              organizationId: orgId
            });
            districtCache.set(cacheKey, { id: newRef.id, name: dName });
            mapped.districtId = newRef.id;
          }
        } catch (err) {
          console.error(`Failed to resolve/create district "${dName}"`, err);
        }
      }
    }

    try {
      // Build the entity payload based on type
      const payload = buildEntityPayload(mapped, entityType, pipelineId, stageId);

      if (!payload) {
        console.error(`[IMPORT] Row ${i + 1} skipped — buildEntityPayload returned null. Mapped keys: ${Object.keys(mapped).join(', ')}. Mapped values:`, JSON.stringify(mapped));
        skippedCount++;
        failedRows.push({
          rowNumber: i + 1,
          reason: `Skipped: could not derive entity name from mapped data. Mapped fields: ${Object.entries(mapped).map(([k,v]) => `${k}="${v}"`).join(', ')}`,
          originalData: rows[i],
        });
        continue;
      }

      // Delegate to canonical createEntityAction (Requirement 14 – backward compat)
      const result = await createEntityAction(
        payload,
        uid,
        wsId,
        entityType,
        orgId
      );

      if (result.success && result.id) {
        successCount++;
        createdIds.push(result.id);
        
        // Apply Tags if requested
        if (configuration?.selectedTags && configuration.selectedTags.length > 0) {
          try {
            const { applyTagAction } = await import('../scoped-tag-actions');
            await applyTagAction(result.id, configuration.selectedTags, wsId, uid);
          } catch (tagErr) {
            console.error('Failed to apply tags to entity', result.id, tagErr);
          }
        }
      } else {
        console.error(`[IMPORT] Row ${i + 1} creation failed:`, result.error, 'Payload name:', payload.name);
        errorCount++;
        failedRows.push({
          rowNumber: i + 1,
          reason: result.error || 'Unknown creation error',
          originalData: rows[i],
        });
      }
    } catch (err: any) {
      console.error(`[IMPORT] Row ${i + 1} exception:`, err.message, err.stack);
      errorCount++;
      failedRows.push({
        rowNumber: i + 1,
        reason: err.message || 'Unexpected error',
        originalData: rows[i],
      });
    }
  }

  // Log aggregate activity (Requirement 9)
  if (wsId) {
    try {
      await logActivity({
        organizationId: orgId,
        workspaceId: wsId,
        userId: uid,
        type: 'contacts_imported',
        source: 'user_action',
        description: `Bulk import batch completed: ${successCount} created, ${errorCount} errors, ${skippedCount} skipped`,
        metadata: {
          entityType,
          successCount,
          errorCount,
          skippedCount,
          batchSize: rows.length,
        },
      });
    } catch {
      // Non-critical – don't fail the import for logging issues
    }
  }

  return { successCount, errorCount, skippedCount, failedRows, createdIds };
}

// ─── Entity Payload Builder ───────────────────────────────────────────────────

function buildEntityPayload(
  mapped: Record<string, string>,
  entityType: EntityType,
  pipelineId?: string,
  stageId?: string
): any | null {
  // Sync Contact Name <-> Entity Name generically
  const contactName = mapped.focalPerson_name || mapped.contactName || '';

  if (entityType === 'person') {
    let fName = mapped.firstName;
    let lName = mapped.lastName;
    
    if (!fName && !lName && contactName) {
      fName = contactName;
    }
    
    let displayName = `${fName || ''} ${lName || ''}`.trim();
    if (!displayName && (mapped.email || mapped.phone)) {
      displayName = `[Placeholder] ${mapped.email || mapped.phone}`;
      fName = displayName;
    }

    if (!displayName) return null;

    const contacts: any[] = [];
    if (mapped.email || mapped.phone || displayName) {
      contacts.push({
        name: mapped.contactName || displayName,
        phone: mapped.phone || '',
        email: mapped.email || '',
        typeKey: 'primary',
        typeLabel: 'Primary',
        isPrimary: true,
        isSignatory: true,
      });
    }

    return {
      name: displayName,
      status: 'active',
      lifecycleStatus: mapped.lifecycleStatus || 'Onboarding',
      location: {
        locationString: mapped.locationString || '',
        ...(mapped.countryId ? { country: { id: mapped.countryId, name: mapped.countryName || '', code: '', flag: '' } } : {}),
        ...(mapped.regionId ? { region: { id: mapped.regionId, name: mapped.regionName || '' } } : {}),
        ...(mapped.districtId ? { district: { id: mapped.districtId, name: mapped.districtName || '' } } : {})
      },
      personData: {
        firstName: fName || '',
        lastName: lName || '',
        company: mapped.company || '',
        jobTitle: mapped.jobTitle || '',
        leadSource: mapped.leadSource || '',
      },
      entityContacts: contacts,
    };
  }

  if (entityType === 'family') {
    let familyName = mapped.familyName || mapped.guardian1_name || contactName || '';
    if (!familyName && (mapped.guardian1_email || mapped.guardian1_phone || mapped.email || mapped.phone)) {
      familyName = `[Placeholder] ${mapped.guardian1_email || mapped.guardian1_phone || mapped.email || mapped.phone}`;
    }
    if (!familyName) return null;

    const gName = mapped.guardian1_name || contactName || familyName;

    const contacts: any[] = [];
    if (gName || mapped.guardian1_email || mapped.guardian1_phone || mapped.email || mapped.phone) {
      contacts.push({
        name: gName,
        phone: mapped.guardian1_phone || mapped.phone || '',
        email: mapped.guardian1_email || mapped.email || '',
        typeKey: 'guardian',
        typeLabel: 'Guardian',
        isPrimary: true,
        isSignatory: true,
      });
    }

    const guardians: any[] = [];
    if (gName) {
      guardians.push({
        name: gName,
        phone: mapped.guardian1_phone || mapped.phone || '',
        email: mapped.guardian1_email || mapped.email || '',
        relationship: mapped.guardian1_relationship || 'Guardian',
        isPrimary: true,
      });
    }

    const children: any[] = [];
    if (mapped.child1_firstName) {
      children.push({
        firstName: mapped.child1_firstName,
        lastName: mapped.child1_lastName || '',
        dateOfBirth: '',
        gradeLevel: mapped.child1_gradeLevel || '',
      });
    }

    return {
      name: familyName,
      status: 'active',
      lifecycleStatus: mapped.lifecycleStatus || 'Onboarding',
      location: {
        locationString: mapped.locationString || '',
        ...(mapped.countryId ? { country: { id: mapped.countryId, name: mapped.countryName || '', code: '', flag: '' } } : {}),
        ...(mapped.regionId ? { region: { id: mapped.regionId, name: mapped.regionName || '' } } : {}),
        ...(mapped.districtId ? { district: { id: mapped.districtId, name: mapped.districtName || '' } } : {})
      },
      familyData: { guardians, children },
      entityContacts: contacts,
    };
  }

  if (entityType === 'institution') {
    let instName = mapped.name || contactName || '';
    if (!instName && (mapped.focalPerson_email || mapped.focalPerson_phone || mapped.email || mapped.phone)) {
      instName = `[Placeholder] ${mapped.focalPerson_email || mapped.focalPerson_phone || mapped.email || mapped.phone}`;
    }
    if (!instName) return null;

    const fpName = mapped.focalPerson_name || contactName || 'Primary Contact';

    const contacts: any[] = [];
    if (fpName || mapped.focalPerson_email || mapped.focalPerson_phone || mapped.email || mapped.phone) {
      contacts.push({
        name: fpName,
        phone: mapped.focalPerson_phone || mapped.phone || '',
        email: mapped.focalPerson_email || mapped.email || '',
        typeKey: mapped.focalPerson_type?.toLowerCase() || 'focal_person',
        typeLabel: mapped.focalPerson_type || 'Focal Person',
        isPrimary: true,
        isSignatory: true,
      });
    }

    return {
      name: instName,
      status: 'active',
      lifecycleStatus: mapped.lifecycleStatus || 'Onboarding',
      location: {
        locationString: mapped.locationString || '',
        ...(mapped.countryId ? { country: { id: mapped.countryId, name: mapped.countryName || '', code: '', flag: '' } } : {}),
        ...(mapped.regionId ? { region: { id: mapped.regionId, name: mapped.regionName || '' } } : {}),
        ...(mapped.districtId ? { district: { id: mapped.districtId, name: mapped.districtName || '' } } : {})
      },
      institutionData: {
        nominalRoll: mapped.nominalRoll ? parseInt(mapped.nominalRoll, 10) : undefined,
        billingAddress: mapped.billingAddress || '',
        currency: mapped.currency || 'GHS',
        subscriptionPackageId: mapped.subscriptionPackageId || '',
      },
      entityContacts: contacts,
    };
  }

  return null;
}
