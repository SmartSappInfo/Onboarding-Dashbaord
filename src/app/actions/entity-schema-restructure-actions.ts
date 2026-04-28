'use server';

import { adminDb } from '@/lib/firebase-admin';

import { FieldValue } from 'firebase-admin/firestore';

export interface MigrationResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export async function fetchEntitiesForSchemaRestructure(organizationId: string) {
  try {
    
    
    const entitiesSnapshot = await adminDb.collection('entities')
      .where('organizationId', '==', organizationId)
      .where('entityType', '==', 'institution')
      .get();
      
    const entities = entitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const needingMigration = entities.filter(entity => {
      const data = entity as any;
      const hasInstitutionData = !!data.institutionData;
      const missingFinanceData = !data.financeData;
      const hasDuplicateFields = data.industryData && (
        'entityType' in data.industryData ||
        'companySize' in data.industryData ||
        'nominalRoll' in data.industryData ||
        'enrollmentCapacity' in data.industryData ||
        'features' in data.industryData ||
        'currency' in data.industryData ||
        'billingAddress' in data.industryData
      );
      
      return hasInstitutionData || missingFinanceData || hasDuplicateFields;
    });
    
    return {
      success: true,
      data: {
        total: entities.length,
        needingMigration: needingMigration.length,
        entities: needingMigration.slice(0, 50) // Return sample for UI
      }
    };
  } catch (error: any) {
    console.error('Error fetching entities for migration:', error);
    return { success: false, error: error.message };
  }
}

export async function enrichEntitiesWithNewSchema(organizationId: string) {
  try {
    
    
    const entitiesSnapshot = await adminDb.collection('entities')
      .where('organizationId', '==', organizationId)
      .where('entityType', '==', 'institution')
      .get();
      
    const result: MigrationResult = {
      total: entitiesSnapshot.size,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
    
    const batches = [];
    let currentBatch = adminDb.batch();
    let batchCount = 0;
    
    for (const doc of entitiesSnapshot.docs) {
      try {
        const data = doc.data() as any;
        const updates: any = {};
        let needsUpdate = false;
        
        const instData = data.institutionData || {};
        const indData = data.industryData || {};
        const existingFinance = data.financeData || {};
        
        // 1. Extract to Root
        if (data.institutionData) {
          if (instData.initials !== undefined && data.initials === undefined) updates.initials = instData.initials;
          if (instData.logoUrl !== undefined && data.logoUrl === undefined) updates.logoUrl = instData.logoUrl;
          if (instData.referee !== undefined && data.referee === undefined) updates.referee = instData.referee;
          if (instData.location !== undefined && data.location === undefined) updates.location = instData.location;
          
          // Map modules -> interests
          if (instData.modules && Array.isArray(instData.modules)) {
             const interests = instData.modules.map((m: any) => m.id || m.name || String(m));
             if (interests.length > 0) {
               updates.interests = interests;
             }
          }
          
          updates.institutionData = FieldValue.delete();
          needsUpdate = true;
        }

        // Feature array mapping in SaaS
        if (indData.features && Array.isArray(indData.features)) {
          if (!updates.interests && !data.interests) {
            updates.interests = indData.features;
          } else if (updates.interests) {
             updates.interests = Array.from(new Set([...updates.interests, ...indData.features]));
          }
          needsUpdate = true;
        }
        
        // 2. Build Finance Data
        const financeData: any = { ...existingFinance };
        let financeUpdated = false;
        
        if (!financeData.currency && (instData.currency || indData.currency)) {
          financeData.currency = instData.currency || indData.currency || 'GHS';
          financeUpdated = true;
        }
        if (!financeData.billingAddress && (instData.billingAddress || indData.billingAddress)) {
          financeData.billingAddress = instData.billingAddress || indData.billingAddress;
          financeUpdated = true;
        }
        if (!financeData.subscriptionRate && (instData.subscriptionRate || indData.subscriptionRate)) {
          financeData.subscriptionRate = instData.subscriptionRate || indData.subscriptionRate;
          financeUpdated = true;
        }
        if (!financeData.planType && (instData.subscriptionPackageName || indData.planType)) {
          financeData.planType = instData.subscriptionPackageName || indData.planType;
          financeUpdated = true;
        }
        if (!financeData.signupDate && (instData.implementationDate || indData.signupDate)) {
          financeData.signupDate = instData.implementationDate || indData.signupDate;
          financeUpdated = true;
        }
        if (!financeData.renewalDate && indData.renewalDate) {
          financeData.renewalDate = indData.renewalDate;
          financeUpdated = true;
        }
        if (!financeData.customerTier && indData.customerTier) {
          financeData.customerTier = indData.customerTier;
          financeUpdated = true;
        }
        if (!financeData.subscriptionIds && indData.subscriptionIds) {
          financeData.subscriptionIds = indData.subscriptionIds;
          financeUpdated = true;
        }
        
        if (financeUpdated || !data.financeData) {
          updates.financeData = Object.keys(financeData).length > 0 ? financeData : { currency: 'GHS' };
          needsUpdate = true;
        }
        
        // 3. Clean Industry Data
        const cleanIndustryData: any = { ...indData };
        let industryUpdated = false;
        
        const duplicateFields = [
          'entityType', 'billingAddress', 'currency', 'subscriptionRate', 
          'planType', 'subscriptionIds', 'signupDate', 'renewalDate', 'customerTier', 'features'
        ];
        
        for (const field of duplicateFields) {
          if (field in cleanIndustryData) {
            delete cleanIndustryData[field];
            industryUpdated = true;
          }
        }
        
        // Rename companySize / nominalRoll / enrollmentCapacity -> capacity
        if ('companySize' in cleanIndustryData) {
          cleanIndustryData.capacity = cleanIndustryData.companySize;
          delete cleanIndustryData.companySize;
          industryUpdated = true;
        }
        if ('nominalRoll' in cleanIndustryData) {
          cleanIndustryData.capacity = cleanIndustryData.nominalRoll;
          delete cleanIndustryData.nominalRoll;
          industryUpdated = true;
        }
        if ('enrollmentCapacity' in cleanIndustryData) {
          cleanIndustryData.capacity = cleanIndustryData.enrollmentCapacity;
          delete cleanIndustryData.enrollmentCapacity;
          industryUpdated = true;
        }
        
        if (industryUpdated) {
          updates.industryData = cleanIndustryData;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          currentBatch.update(doc.ref, updates);
          batchCount++;
          result.succeeded++;
          
          if (batchCount === 500) {
            batches.push(currentBatch.commit());
            currentBatch = adminDb.batch();
            batchCount = 0;
          }
        } else {
          result.skipped++;
        }
        
      } catch (err: any) {
        result.failed++;
        result.errors.push(`Entity ${doc.id}: ${err.message}`);
      }
    }
    
    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }
    
    await Promise.all(batches);
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in enrich phase:', error);
    return { success: false, error: error.message };
  }
}

export async function restoreEntitySchemaRestructure(organizationId: string) {
  try {
    
    
    const entitiesSnapshot = await adminDb.collection('entities')
      .where('organizationId', '==', organizationId)
      .where('entityType', '==', 'institution')
      .get();
      
    const result = {
      total: entitiesSnapshot.size,
      valid: 0,
      invalid: 0,
      errors: [] as string[]
    };
    
    for (const doc of entitiesSnapshot.docs) {
      const data = doc.data() as any;
      const errors = [];
      
      if (data.institutionData) {
        errors.push('institutionData node still exists');
      }
      
      if (!data.financeData) {
        errors.push('financeData node is missing');
      }
      
      if (data.industryData) {
        if ('entityType' in data.industryData) errors.push('industryData contains entityType');
        if ('companySize' in data.industryData) errors.push('industryData contains companySize instead of capacity');
        if ('nominalRoll' in data.industryData) errors.push('industryData contains nominalRoll instead of capacity');
        if ('features' in data.industryData) errors.push('industryData contains features instead of interests at root');
        if ('currency' in data.industryData) errors.push('industryData contains currency');
      }
      
      if (errors.length > 0) {
        result.invalid++;
        result.errors.push(`Entity ${doc.id}: ${errors.join(', ')}`);
      } else {
        result.valid++;
      }
    }
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in restore phase:', error);
    return { success: false, error: error.message };
  }
}

export async function rollbackEntitySchemaRestructure(organizationId: string) {
  // A simple rollback that restores 'companySize', 'features' and clears financeData.
  // Full reconstruction of institutionData is complex because it was originally scattered.
  // This serves as a safety hatch if requested.
  try {
    
    
    const entitiesSnapshot = await adminDb.collection('entities')
      .where('organizationId', '==', organizationId)
      .where('entityType', '==', 'institution')
      .get();
      
    const batches = [];
    let currentBatch = adminDb.batch();
    let batchCount = 0;
    
    let succeeded = 0;
    let failed = 0;
    
    for (const doc of entitiesSnapshot.docs) {
      try {
        const data = doc.data() as any;
        const updates: any = {};
        let needsUpdate = false;
        
        if (data.industryData && 'capacity' in data.industryData) {
           const indData = { ...data.industryData };
           indData.companySize = indData.capacity;
           indData.entityType = 'institution'; // Re-add
           delete indData.capacity;
           
           if (data.interests && data.interests.length > 0) {
             indData.features = data.interests;
           }
           
           updates.industryData = indData;
           needsUpdate = true;
        }
        
        if (data.financeData) {
           const finData = data.financeData;
           const instData: any = {};
           if (data.initials) instData.initials = data.initials;
           if (data.logoUrl) instData.logoUrl = data.logoUrl;
           if (data.location) instData.location = data.location;
           if (finData.currency) instData.currency = finData.currency;
           if (finData.billingAddress) instData.billingAddress = finData.billingAddress;
           if (finData.subscriptionRate) instData.subscriptionRate = finData.subscriptionRate;
           
           updates.institutionData = instData;
           needsUpdate = true;
        }
        
        if (needsUpdate) {
          currentBatch.update(doc.ref, updates);
          batchCount++;
          succeeded++;
          
          if (batchCount === 500) {
            batches.push(currentBatch.commit());
            currentBatch = adminDb.batch();
            batchCount = 0;
          }
        }
      } catch (e) {
        failed++;
      }
    }
    
    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }
    
    await Promise.all(batches);
    
    return { success: true, data: { succeeded, failed } };
  } catch (error: any) {
    console.error('Error in rollback phase:', error);
    return { success: false, error: error.message };
  }
}
