// @ts-nocheck
/**
 * Industry Migration Phase 1: Audit and Data Integrity Validation
 * 
 * This script performs a comprehensive audit of existing data before migration:
 * - Reads all documents from the `schools` collection
 * - Reads all `entities` with entityType: 'institution'
 * - Identifies and logs SaaS-specific fields
 * - Validates data integrity and flags anomalies
 * - Outputs a detailed audit report
 * 
 * Requirements: 21.1–21.4
 * 
 * Run with: npx tsx scripts/migrate-industry-phase1.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { School, Entity, InstitutionData } from '../src/lib/types';

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// SaaS-specific fields to audit (Requirement 8)
const SAAS_FIELDS = {
  required: [
    'nominalRoll',        // Maps to companySize
    'subscriptionPackageId', // Maps to planType
    'modules',            // Maps to features
    'implementationDate', // Maps to signupDate
  ],
  optional: [
    'billingAddress',
    'currency',
    'subscriptionRate',
    'discountPercentage',
    'arrearsBalance',
    'creditBalance',
  ]
};

interface AuditReport {
  timestamp: string;
  schools: {
    total: number;
    withOrganizationId: number;
    withoutOrganizationId: number;
    withMigrationStatus: number;
    byMigrationStatus: Record<string, number>;
    withEntityId: number;
    saasFieldCoverage: {
      [field: string]: {
        present: number;
        missing: number;
        nullOrEmpty: number;
      };
    };
    anomalies: Array<{
      schoolId: string;
      schoolName: string;
      issue: string;
      severity: 'warning' | 'error';
    }>;
  };
  entities: {
    total: number;
    institutions: number;
    families: number;
    persons: number;
    withIndustry: number;
    withIndustryData: number;
    withMigrationStatus: number;
    byMigrationStatus: Record<string, number>;
    institutionDataCoverage: {
      [field: string]: {
        present: number;
        missing: number;
      };
    };
    anomalies: Array<{
      entityId: string;
      entityName: string;
      issue: string;
      severity: 'warning' | 'error';
    }>;
  };
  dataIntegrity: {
    orphanedWorkspaceEntities: number;
    missingEntityReferences: number;
    duplicateSlugs: Array<{ slug: string; count: number }>;
    invalidWorkspaceIds: number;
  };
}

async function auditSchools(): Promise<AuditReport['schools']> {
  console.log('\n📊 Auditing schools collection...');
  
  const schoolsRef = db.collection('schools');
  const snapshot = await schoolsRef.get();
  
  const report: AuditReport['schools'] = {
    total: snapshot.size,
    withOrganizationId: 0,
    withoutOrganizationId: 0,
    withMigrationStatus: 0,
    byMigrationStatus: {},
    withEntityId: 0,
    saasFieldCoverage: {},
    anomalies: []
  };
  
  // Initialize field coverage tracking
  [...SAAS_FIELDS.required, ...SAAS_FIELDS.optional].forEach(field => {
    report.saasFieldCoverage[field] = {
      present: 0,
      missing: 0,
      nullOrEmpty: 0
    };
  });
  
  snapshot.forEach((doc) => {
    const school = doc.data() as School;
    
    // Check organizationId presence
    if (school.organizationId) {
      report.withOrganizationId++;
    } else {
      report.withoutOrganizationId++;
      report.anomalies.push({
        schoolId: doc.id,
        schoolName: school.name,
        issue: 'Missing organizationId field',
        severity: 'warning'
      });
    }
    
    // Check migrationStatus
    if (school.migrationStatus) {
      report.withMigrationStatus++;
      report.byMigrationStatus[school.migrationStatus] = 
        (report.byMigrationStatus[school.migrationStatus] || 0) + 1;
    }
    
    // Check entityId reference
    if (school.entityId) {
      report.withEntityId++;
    }
    
    // Audit SaaS-specific fields
    [...SAAS_FIELDS.required, ...SAAS_FIELDS.optional].forEach(field => {
      const value = (school as any)[field];
      
      if (value === undefined) {
        report.saasFieldCoverage[field].missing++;
      } else if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        report.saasFieldCoverage[field].nullOrEmpty++;
      } else {
        report.saasFieldCoverage[field].present++;
      }
    });
    
    // Check for required field anomalies
    SAAS_FIELDS.required.forEach(field => {
      const value = (school as any)[field];
      if (value === undefined || value === null) {
        report.anomalies.push({
          schoolId: doc.id,
          schoolName: school.name,
          issue: `Missing required SaaS field: ${field}`,
          severity: 'error'
        });
      }
    });
    
    // Check for invalid workspaceIds
    if (!school.workspaceIds || school.workspaceIds.length === 0) {
      report.anomalies.push({
        schoolId: doc.id,
        schoolName: school.name,
        issue: 'Missing or empty workspaceIds array',
        severity: 'error'
      });
    }
    
    // Check for data type mismatches
    if (school.nominalRoll !== undefined && typeof school.nominalRoll !== 'number') {
      report.anomalies.push({
        schoolId: doc.id,
        schoolName: school.name,
        issue: `nominalRoll has invalid type: ${typeof school.nominalRoll}`,
        severity: 'error'
      });
    }
  });
  
  console.log(`✅ Audited ${report.total} schools`);
  return report;
}

async function auditEntities(): Promise<AuditReport['entities']> {
  console.log('\n📊 Auditing entities collection...');
  
  const entitiesRef = db.collection('entities');
  const snapshot = await entitiesRef.get();
  
  const report: AuditReport['entities'] = {
    total: snapshot.size,
    institutions: 0,
    families: 0,
    persons: 0,
    withIndustry: 0,
    withIndustryData: 0,
    withMigrationStatus: 0,
    byMigrationStatus: {},
    institutionDataCoverage: {},
    anomalies: []
  };
  
  // Initialize institution data field coverage
  const institutionFields = [
    'nominalRoll',
    'subscriptionPackageId',
    'subscriptionRate',
    'billingAddress',
    'currency',
    'modules',
    'implementationDate'
  ];
  
  institutionFields.forEach(field => {
    report.institutionDataCoverage[field] = {
      present: 0,
      missing: 0
    };
  });
  
  snapshot.forEach((doc) => {
    const entity = doc.data() as Entity;
    
    // Count by entity type
    if (entity.entityType === 'institution') {
      report.institutions++;
    } else if (entity.entityType === 'family') {
      report.families++;
    } else if (entity.entityType === 'person') {
      report.persons++;
    }
    
    // Check industry field
    if (entity.industry) {
      report.withIndustry++;
    }
    
    // Check industryData field
    if (entity.industryData) {
      report.withIndustryData++;
    }
    
    // Check migrationStatus
    if (entity.migrationStatus) {
      report.withMigrationStatus++;
      report.byMigrationStatus[entity.migrationStatus] = 
        (report.byMigrationStatus[entity.migrationStatus] || 0) + 1;
    }
    
    // Audit institution-specific data
    if (entity.entityType === 'institution' && entity.institutionData) {
      institutionFields.forEach(field => {
        const value = (entity.institutionData as any)?.[field];
        if (value !== undefined && value !== null) {
          report.institutionDataCoverage[field].present++;
        } else {
          report.institutionDataCoverage[field].missing++;
        }
      });
    }
    
    // Check for anomalies
    if (!entity.organizationId) {
      report.anomalies.push({
        entityId: doc.id,
        entityName: entity.name,
        issue: 'Missing organizationId field',
        severity: 'error'
      });
    }
    
    if (!entity.name || entity.name.trim() === '') {
      report.anomalies.push({
        entityId: doc.id,
        entityName: entity.name || '(empty)',
        issue: 'Missing or empty name field',
        severity: 'error'
      });
    }
    
    // Check for industry/industryData consistency
    if (entity.industry && !entity.industryData) {
      report.anomalies.push({
        entityId: doc.id,
        entityName: entity.name,
        issue: 'Has industry field but missing industryData',
        severity: 'warning'
      });
    }
    
    if (!entity.industry && entity.industryData) {
      report.anomalies.push({
        entityId: doc.id,
        entityName: entity.name,
        issue: 'Has industryData but missing industry field',
        severity: 'error'
      });
    }
  });
  
  console.log(`✅ Audited ${report.total} entities`);
  return report;
}

async function auditDataIntegrity(): Promise<AuditReport['dataIntegrity']> {
  console.log('\n📊 Auditing data integrity...');
  
  const report: AuditReport['dataIntegrity'] = {
    orphanedWorkspaceEntities: 0,
    missingEntityReferences: 0,
    duplicateSlugs: [],
    invalidWorkspaceIds: 0
  };
  
  // Check for orphaned workspace_entities
  const workspaceEntitiesRef = db.collection('workspace_entities');
  const weSnapshot = await workspaceEntitiesRef.get();
  
  const entityIds = new Set<string>();
  const entitiesSnapshot = await db.collection('entities').get();
  entitiesSnapshot.forEach(doc => entityIds.add(doc.id));
  
  weSnapshot.forEach((doc) => {
    const we = doc.data();
    if (!entityIds.has(we.entityId)) {
      report.orphanedWorkspaceEntities++;
    }
  });
  
  // Check for missing entity references in schools
  const schoolsSnapshot = await db.collection('schools').get();
  schoolsSnapshot.forEach((doc) => {
    const school = doc.data() as School;
    if (school.entityId && !entityIds.has(school.entityId)) {
      report.missingEntityReferences++;
    }
  });
  
  // Check for duplicate slugs
  const slugCounts = new Map<string, number>();
  entitiesSnapshot.forEach((doc) => {
    const entity = doc.data() as Entity;
    if (entity.slug) {
      slugCounts.set(entity.slug, (slugCounts.get(entity.slug) || 0) + 1);
    }
  });
  
  slugCounts.forEach((count, slug) => {
    if (count > 1) {
      report.duplicateSlugs.push({ slug, count });
    }
  });
  
  // Check for invalid workspace IDs in schools
  const workspaceIds = new Set<string>();
  const workspacesSnapshot = await db.collection('workspaces').get();
  workspacesSnapshot.forEach(doc => workspaceIds.add(doc.id));
  
  schoolsSnapshot.forEach((doc) => {
    const school = doc.data() as School;
    if (school.workspaceIds) {
      school.workspaceIds.forEach(wsId => {
        if (!workspaceIds.has(wsId)) {
          report.invalidWorkspaceIds++;
        }
      });
    }
  });
  
  console.log('✅ Data integrity audit complete');
  return report;
}

function printReport(report: AuditReport) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 INDUSTRY MIGRATION PHASE 1 - AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(`\nGenerated: ${report.timestamp}\n`);
  
  // Schools Summary
  console.log('📚 SCHOOLS COLLECTION');
  console.log('-'.repeat(80));
  console.log(`Total schools: ${report.schools.total}`);
  console.log(`  With organizationId: ${report.schools.withOrganizationId}`);
  console.log(`  Without organizationId: ${report.schools.withoutOrganizationId}`);
  console.log(`  With migrationStatus: ${report.schools.withMigrationStatus}`);
  if (Object.keys(report.schools.byMigrationStatus).length > 0) {
    console.log('  By migration status:');
    Object.entries(report.schools.byMigrationStatus).forEach(([status, count]) => {
      console.log(`    ${status}: ${count}`);
    });
  }
  console.log(`  With entityId reference: ${report.schools.withEntityId}`);
  
  console.log('\n  SaaS Field Coverage:');
  Object.entries(report.schools.saasFieldCoverage).forEach(([field, stats]) => {
    const total = stats.present + stats.missing + stats.nullOrEmpty;
    const coverage = total > 0 ? ((stats.present / total) * 100).toFixed(1) : '0.0';
    const isRequired = SAAS_FIELDS.required.includes(field);
    const marker = isRequired ? '(required)' : '(optional)';
    console.log(`    ${field} ${marker}:`);
    console.log(`      Present: ${stats.present} (${coverage}%)`);
    console.log(`      Missing: ${stats.missing}`);
    console.log(`      Null/Empty: ${stats.nullOrEmpty}`);
  });
  
  if (report.schools.anomalies.length > 0) {
    console.log(`\n  ⚠️  Anomalies Found: ${report.schools.anomalies.length}`);
    const errors = report.schools.anomalies.filter(a => a.severity === 'error');
    const warnings = report.schools.anomalies.filter(a => a.severity === 'warning');
    console.log(`    Errors: ${errors.length}`);
    console.log(`    Warnings: ${warnings.length}`);
    
    // Show first 10 anomalies
    console.log('\n  Sample Anomalies (first 10):');
    report.schools.anomalies.slice(0, 10).forEach(anomaly => {
      const icon = anomaly.severity === 'error' ? '❌' : '⚠️';
      console.log(`    ${icon} [${anomaly.schoolId}] ${anomaly.schoolName}: ${anomaly.issue}`);
    });
    
    if (report.schools.anomalies.length > 10) {
      console.log(`    ... and ${report.schools.anomalies.length - 10} more`);
    }
  }
  
  // Entities Summary
  console.log('\n\n🏢 ENTITIES COLLECTION');
  console.log('-'.repeat(80));
  console.log(`Total entities: ${report.entities.total}`);
  console.log(`  Institutions: ${report.entities.institutions}`);
  console.log(`  Families: ${report.entities.families}`);
  console.log(`  Persons: ${report.entities.persons}`);
  console.log(`  With industry field: ${report.entities.withIndustry}`);
  console.log(`  With industryData field: ${report.entities.withIndustryData}`);
  console.log(`  With migrationStatus: ${report.entities.withMigrationStatus}`);
  if (Object.keys(report.entities.byMigrationStatus).length > 0) {
    console.log('  By migration status:');
    Object.entries(report.entities.byMigrationStatus).forEach(([status, count]) => {
      console.log(`    ${status}: ${count}`);
    });
  }
  
  console.log('\n  Institution Data Coverage:');
  Object.entries(report.entities.institutionDataCoverage).forEach(([field, stats]) => {
    const total = stats.present + stats.missing;
    const coverage = total > 0 ? ((stats.present / total) * 100).toFixed(1) : '0.0';
    console.log(`    ${field}: ${stats.present}/${total} (${coverage}%)`);
  });
  
  if (report.entities.anomalies.length > 0) {
    console.log(`\n  ⚠️  Anomalies Found: ${report.entities.anomalies.length}`);
    const errors = report.entities.anomalies.filter(a => a.severity === 'error');
    const warnings = report.entities.anomalies.filter(a => a.severity === 'warning');
    console.log(`    Errors: ${errors.length}`);
    console.log(`    Warnings: ${warnings.length}`);
    
    // Show first 10 anomalies
    console.log('\n  Sample Anomalies (first 10):');
    report.entities.anomalies.slice(0, 10).forEach(anomaly => {
      const icon = anomaly.severity === 'error' ? '❌' : '⚠️';
      console.log(`    ${icon} [${anomaly.entityId}] ${anomaly.entityName}: ${anomaly.issue}`);
    });
    
    if (report.entities.anomalies.length > 10) {
      console.log(`    ... and ${report.entities.anomalies.length - 10} more`);
    }
  }
  
  // Data Integrity Summary
  console.log('\n\n🔗 DATA INTEGRITY');
  console.log('-'.repeat(80));
  console.log(`Orphaned workspace_entities: ${report.dataIntegrity.orphanedWorkspaceEntities}`);
  console.log(`Missing entity references: ${report.dataIntegrity.missingEntityReferences}`);
  console.log(`Duplicate slugs: ${report.dataIntegrity.duplicateSlugs.length}`);
  if (report.dataIntegrity.duplicateSlugs.length > 0) {
    console.log('  Duplicate slug details:');
    report.dataIntegrity.duplicateSlugs.forEach(({ slug, count }) => {
      console.log(`    "${slug}": ${count} occurrences`);
    });
  }
  console.log(`Invalid workspace IDs: ${report.dataIntegrity.invalidWorkspaceIds}`);
  
  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('-'.repeat(80));
  const totalAnomalies = report.schools.anomalies.length + report.entities.anomalies.length;
  const totalErrors = 
    report.schools.anomalies.filter(a => a.severity === 'error').length +
    report.entities.anomalies.filter(a => a.severity === 'error').length;
  const totalWarnings = 
    report.schools.anomalies.filter(a => a.severity === 'warning').length +
    report.entities.anomalies.filter(a => a.severity === 'warning').length;
  
  console.log(`Total anomalies: ${totalAnomalies}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`  Warnings: ${totalWarnings}`);
  
  if (totalErrors > 0) {
    console.log('\n❌ CRITICAL: Errors found that must be resolved before migration');
  } else if (totalWarnings > 0) {
    console.log('\n⚠️  WARNING: Some issues found but migration can proceed');
  } else {
    console.log('\n✅ SUCCESS: No critical issues found, ready for Phase 2');
  }
  
  console.log('\n' + '='.repeat(80));
}

async function runAudit() {
  console.log('🚀 Starting Industry Migration Phase 1: Audit');
  console.log('This script will analyze existing data without making any changes.\n');
  
  try {
    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      schools: await auditSchools(),
      entities: await auditEntities(),
      dataIntegrity: await auditDataIntegrity()
    };
    
    printReport(report);
    
    // Save report to file
    const fs = require('fs');
    const reportPath = `migration-audit-phase1-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Full report saved to: ${reportPath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  }
}

runAudit();
