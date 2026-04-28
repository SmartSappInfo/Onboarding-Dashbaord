'use server';

/**
 * Server Actions for Industry-Scoped Entity Migration
 * 
 * Provides Fetch, Enrich, and Restore (FER) operations for migrating
 * existing schools to the SaaS industry vertical with proper industryData.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Entity, SaaSInstitutionData, InstitutionData } from '@/lib/types';

export interface IndustryMigrationResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * FETCH: Fetches all entities that need SaaS industry enrichment
 * 
 * Identifies entities that:
 * - Are of type 'institution'
 * - Don't have industry field set
 * - OR don't have industryData field set
 */
export async function fetchSchoolsForSaaSMigration(): Promise<IndustryMigrationResult> {
  const result: IndustryMigrationResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log('🔍 [FETCH] Scanning entities collection for SaaS industry enrichment candidates...');

    // Get ALL entities (we'll filter in memory)
    const entitiesSnapshot = await adminDb.collection('entities').get();
    result.total = entitiesSnapshot.size;

    console.log(`📊 [FETCH] Found ${result.total} total entities in collection`);

    if (result.total === 0) {
      console.warn('⚠️ [FETCH] No entities found in the database. Check Firebase connection and collection name.');
      return result;
    }

    let needsEnrichment = 0;
    let alreadyEnriched = 0;

    for (const doc of entitiesSnapshot.docs) {
      const entity = doc.data();
      
      // Only process institution entities
      if (entity.entityType !== 'institution') {
        result.skipped++;
        continue;
      }
      
      // Check if entity needs SaaS industry enrichment
      // An entity needs enrichment if:
      // 1. It doesn't have industry field
      // 2. OR industry is not 'SaaS'
      // 3. OR it doesn't have industryData field
      const hasIndustry = !!entity.industry;
      const isSaaS = entity.industry === 'SaaS';
      const hasIndustryData = !!entity.industryData;
      
      const needsEnrichmentCheck = 
        !hasIndustry || 
        !isSaaS ||
        !hasIndustryData;
      
      if (needsEnrichmentCheck) {
        needsEnrichment++;
        result.succeeded++;
        console.log(`  ✓ Entity ${doc.id} (${entity.name}) needs SaaS enrichment (industry: ${entity.industry || 'undefined'}, hasIndustryData: ${hasIndustryData})`);
      } else {
        alreadyEnriched++;
        result.skipped++;
      }
    }

    console.log(`✅ [FETCH] Found ${needsEnrichment} entities needing SaaS enrichment, ${alreadyEnriched} already enriched`);
    
    return result;
  } catch (error: any) {
    console.error('❌ [FETCH] Error:', error);
    result.errors.push(error.message);
    result.failed = result.total;
    return result;
  }
}

/**
 * ENRICH: Enriches existing entities with SaaS industry data
 * 
 * For each institution entity without SaaS industryData:
 * 1. Creates SaaSInstitutionData from institutionData
 * 2. Updates entity with industry: 'SaaS' and industryData
 */
export async function enrichSchoolsWithSaaSIndustry(): Promise<IndustryMigrationResult> {
  const result: IndustryMigrationResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log('🔄 [ENRICH] Starting SaaS industry enrichment for entities...');

    // Get ALL entities and filter in memory
    const entitiesSnapshot = await adminDb.collection('entities').get();
    
    // Filter entities that need SaaS enrichment
    const entitiesToEnrich = entitiesSnapshot.docs.filter(doc => {
      const entity = doc.data();
      // Only institution entities that don't have SaaS industry data
      return entity.entityType === 'institution' && 
             (!entity.industry || entity.industry !== 'SaaS' || !entity.industryData);
    });

    result.total = entitiesToEnrich.length;
    console.log(`📊 [ENRICH] Processing ${result.total} entities (out of ${entitiesSnapshot.size} total)...`);

    const batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const entityDoc of entitiesToEnrich) {
      try {
        const entity = entityDoc.data();
        const entityId = entityDoc.id;

        // Skip if already has SaaS industry data
        if (entity.industry === 'SaaS' && entity.industryData) {
          result.skipped++;
          continue;
        }

        // Get institutionData
        const institutionData = entity.institutionData as any;
        
        if (!institutionData) {
          result.skipped++;
          console.warn(`⚠️ Entity ${entityId} has no institutionData, skipping`);
          continue;
        }

        // Determine planType from subscriptionPackage
        let planType = 'Standard'; // Default
        if (institutionData.subscriptionPackageName) {
          planType = institutionData.subscriptionPackageName;
        } else if (institutionData.subscriptionPackageId) {
          // Try to look up package name
          try {
            const pkgDoc = await adminDb.collection('subscriptionPackages').doc(institutionData.subscriptionPackageId).get();
            if (pkgDoc.exists) {
              planType = pkgDoc.data()?.name || 'Standard';
            }
          } catch (err) {
            console.warn(`⚠️ Could not fetch subscription package for entity ${entityId}`);
          }
        }

        // Create SaaSInstitutionData from institutionData
        const renewalDate = calculateRenewalDate(institutionData.implementationDate);
        const customerTier = deriveCustomerTier(planType);
        
        const saasData: any = {
          industry: 'SaaS',
          entityType: 'institution',
          companySize: institutionData.nominalRoll || 0,
          planType: planType,
          features: institutionData.modules?.map((m: any) => m.name || m.abbreviation || m.id) || [],
          signupDate: institutionData.implementationDate || entity.createdAt || new Date().toISOString(),
          accountStatus: entity.status === 'active' ? 'active' : 'lead',
          trialIds: [],
          onboardingIds: [],
          subscriptionIds: [],
          supportTicketIds: [],
          healthScoreIds: [],
        };

        // Add optional fields only if they have values (Firestore doesn't allow undefined)
        if (institutionData.billingAddress) {
          saasData.billingAddress = institutionData.billingAddress;
        }
        if (institutionData.currency) {
          saasData.currency = institutionData.currency;
        } else {
          saasData.currency = 'GHS'; // Default currency
        }
        if (institutionData.subscriptionRate !== undefined && institutionData.subscriptionRate !== null) {
          saasData.subscriptionRate = institutionData.subscriptionRate;
        }
        if (renewalDate) {
          saasData.renewalDate = renewalDate;
        }
        if (customerTier) {
          saasData.customerTier = customerTier;
        }

        // Update entity with SaaS industry data
        const entityRef = adminDb.collection('entities').doc(entityId);
        batch.update(entityRef, {
          industry: 'SaaS',
          industryData: saasData,
          updatedAt: new Date().toISOString(),
        });

        result.succeeded++;
        batchCount++;
        console.log(`  ✓ Enriched entity ${entityId} (${entity.name}) with SaaS industry data`);

        // Commit batch if size limit reached
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ [ENRICH] Committed batch of ${batchCount} entities`);
          batchCount = 0;
        }
      } catch (error: any) {
        console.error(`❌ [ENRICH] Error processing entity ${entityDoc.id}:`, error);
        result.failed++;
        result.errors.push(`${entityDoc.id}: ${error.message}`);
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ [ENRICH] Committed final batch of ${batchCount} entities`);
    }

    console.log(`✅ [ENRICH] Completed: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped`);
    
    return result;
  } catch (error: any) {
    console.error('❌ [ENRICH] Error:', error);
    result.errors.push(error.message);
    return result;
  }
}

/**
 * RESTORE: Validates that entities have proper SaaS industry data
 * 
 * Verifies:
 * - Entity has industry: 'SaaS'
 * - Entity has valid industryData with all required fields
 */
export async function restoreSaaSMigration(): Promise<IndustryMigrationResult> {
  const result: IndustryMigrationResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log('🔍 [RESTORE] Validating SaaS industry data on entities...');

    // Get all institution entities
    const entitiesSnapshot = await adminDb.collection('entities').get();
    
    const institutionEntities = entitiesSnapshot.docs.filter(doc => {
      const entity = doc.data();
      return entity.entityType === 'institution';
    });

    result.total = institutionEntities.length;
    console.log(`📊 [RESTORE] Validating ${result.total} institution entities...`);

    for (const entityDoc of institutionEntities) {
      try {
        const entity = entityDoc.data();
        const entityId = entityDoc.id;

        // Validate industry field
        if (entity.industry !== 'SaaS') {
          result.failed++;
          result.errors.push(`${entityId} (${entity.name}): Missing or incorrect industry field (found: ${entity.industry})`);
          continue;
        }

        // Validate industryData exists
        if (!entity.industryData) {
          result.failed++;
          result.errors.push(`${entityId} (${entity.name}): Missing industryData`);
          continue;
        }

        // Validate required SaaS fields
        const saasData = entity.industryData as any;
        const requiredFields = ['industry', 'entityType', 'companySize', 'planType', 'features', 'signupDate', 'accountStatus'];
        const missingFields = requiredFields.filter(field => saasData[field] === undefined);
        
        if (missingFields.length > 0) {
          result.failed++;
          result.errors.push(`${entityId} (${entity.name}): Missing required SaaS fields: ${missingFields.join(', ')}`);
          continue;
        }

        // Validation passed
        result.succeeded++;
        console.log(`  ✓ Entity ${entityId} (${entity.name}) has valid SaaS industry data`);
      } catch (error: any) {
        console.error(`❌ [RESTORE] Error validating entity ${entityDoc.id}:`, error);
        result.failed++;
        result.errors.push(`${entityDoc.id}: ${error.message}`);
      }
    }

    console.log(`✅ [RESTORE] Completed: ${result.succeeded} valid, ${result.failed} invalid`);
    
    return result;
  } catch (error: any) {
    console.error('❌ [RESTORE] Error:', error);
    result.errors.push(error.message);
    return result;
  }
}

/**
 * ROLLBACK: Removes SaaS industry data from entities
 */
export async function rollbackSaaSMigration(): Promise<IndustryMigrationResult> {
  const result: IndustryMigrationResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log('🔄 [ROLLBACK] Starting SaaS industry data rollback...');

    // Get all entities with SaaS industry
    const entitiesSnapshot = await adminDb.collection('entities').get();
    
    const saasEntities = entitiesSnapshot.docs.filter(doc => {
      const entity = doc.data();
      return entity.entityType === 'institution' && entity.industry === 'SaaS';
    });

    result.total = saasEntities.length;
    console.log(`📊 [ROLLBACK] Processing ${result.total} SaaS entities...`);

    const batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const entityDoc of saasEntities) {
      try {
        const entityId = entityDoc.id;
        const entity = entityDoc.data();

        // Remove industry and industryData fields
        const entityRef = adminDb.collection('entities').doc(entityId);
        batch.update(entityRef, {
          industry: null,
          industryData: null,
          updatedAt: new Date().toISOString(),
        });

        result.succeeded++;
        batchCount++;
        console.log(`  ✓ Rolled back entity ${entityId} (${entity.name})`);

        // Commit batch if size limit reached
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ [ROLLBACK] Committed batch of ${batchCount} entities`);
          batchCount = 0;
        }
      } catch (error: any) {
        console.error(`❌ [ROLLBACK] Error rolling back entity ${entityDoc.id}:`, error);
        result.failed++;
        result.errors.push(`${entityDoc.id}: ${error.message}`);
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ [ROLLBACK] Committed final batch of ${batchCount} entities`);
    }

    console.log(`✅ [ROLLBACK] Completed: ${result.succeeded} succeeded, ${result.failed} failed`);
    
    return result;
  } catch (error: any) {
    console.error('❌ [ROLLBACK] Error:', error);
    result.errors.push(error.message);
    return result;
  }
}

// Helper functions

function calculateRenewalDate(signupDate?: string): string | undefined {
  if (!signupDate) return undefined;
  
  try {
    const signup = new Date(signupDate);
    const renewal = new Date(signup);
    renewal.setFullYear(renewal.getFullYear() + 1); // Add 1 year
    return renewal.toISOString();
  } catch {
    return undefined;
  }
}

function deriveCustomerTier(planType: string): 'basic' | 'pro' | 'enterprise' | undefined {
  const lowerPlan = planType.toLowerCase();
  
  if (lowerPlan.includes('enterprise') || lowerPlan.includes('premium')) {
    return 'enterprise';
  } else if (lowerPlan.includes('pro') || lowerPlan.includes('professional')) {
    return 'pro';
  } else if (lowerPlan.includes('basic') || lowerPlan.includes('standard')) {
    return 'basic';
  }
  
  return undefined;
}
