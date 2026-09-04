/**
 * @fileOverview Seed & Showcase CLI for Knowledge Federation & Cross-Platform Ingestion
 *
 * Usage: npx tsx scripts/seed-knowledge-federation.ts [workspaceId] [organizationId]
 */

import { adminDb } from '../src/lib/firebase-admin';
import { KnowledgeFederationRepository } from '../src/lib/knowledge-federation-repository';
import { generateApiKey } from '../src/lib/api-key-actions';
import { QuickNotesRepository } from '../src/lib/quick-notes-repository';
import type { FederatedKnowledgeSpace, QuickNote } from '../src/lib/quick-notes-types';

async function main() {
  const workspaceId = process.argv[2] || 'demo-workspace';
  const organizationId = process.argv[3] || 'demo-organization';

  console.log(`[SEED_FEDERATION] Seeding Knowledge Federation for workspace: ${workspaceId}, org: ${organizationId}...`);

  const now = new Date().toISOString();

  // 1. Create Showcase Shared Knowledge Spaces
  const sampleSpaces: Array<Omit<FederatedKnowledgeSpace, 'id' | 'createdAt' | 'updatedAt'>> = [
    {
      name: 'Central HQ Brand Guidelines & Parent Communications',
      description: 'Standardized brand voice, welcome messaging templates, and parent interaction protocols published organization-wide.',
      icon: 'Megaphone',
      color: '#4f46e5',
      organizationId,
      ownerWorkspaceId: workspaceId,
      subscriberWorkspaceIds: ['branch-north-campus', 'branch-south-campus', 'branch-international'],
      accessLevel: 'viewer',
      federationPolicy: 'organization_shared',
      publishedCollectionIds: ['cat_brand', 'cat_parent_comms'],
      tags: ['brand', 'communications', 'parent-voice'],
      isArchived: false,
      createdBy: 'system_seed',
      createdByName: 'Central Academic Directorate',
    },
    {
      name: 'Curriculum Excellence & STEM Playbooks',
      description: 'Shared lesson plans, STEM laboratory safety procedures, and examination guidelines curated across regional campuses.',
      icon: 'BookOpen',
      color: '#059669',
      organizationId,
      ownerWorkspaceId: workspaceId,
      subscriberWorkspaceIds: ['branch-north-campus'],
      accessLevel: 'contributor',
      federationPolicy: 'selective_peers',
      publishedCollectionIds: ['cat_academics', 'cat_stem'],
      tags: ['curriculum', 'stem', 'academics'],
      isArchived: false,
      createdBy: 'system_seed',
      createdByName: 'Dean of Academics',
    },
    {
      name: 'Executive Sales Objection Playbooks & Win Strategies',
      description: 'High-converting objection rebuttals and fee structure talking points for admissions counselors across all regional offices.',
      icon: 'Swords',
      color: '#d97706',
      organizationId,
      ownerWorkspaceId: workspaceId,
      subscriberWorkspaceIds: ['branch-north-campus', 'branch-south-campus'],
      accessLevel: 'viewer',
      federationPolicy: 'organization_shared',
      publishedCollectionIds: ['cat_sales_battlecards'],
      tags: ['admissions', 'battlecards', 'sales'],
      isArchived: false,
      createdBy: 'system_seed',
      createdByName: 'Head of Admissions',
    },
  ];

  for (const spaceData of sampleSpaces) {
    const space = await KnowledgeFederationRepository.createSpace(spaceData);
    console.log(`[SEED_FEDERATION] Created Space: "${space.name}" (ID: ${space.id})`);
  }

  // 2. Generate a default Ingestion Webhook Key
  const apiKeyRes = await generateApiKey(
    workspaceId,
    organizationId,
    'Slack & Zapier Inbound Webhook (Demo Key)',
    'system_seed'
  );

  if (apiKeyRes.success && apiKeyRes.key) {
    console.log(`[SEED_FEDERATION] Generated Demo Ingestion API Key: ${apiKeyRes.key}`);
    console.log(`[SEED_FEDERATION] Webhook Ingest Endpoint: /api/v1/quick-notes/ingest`);
  }

  // 3. Create Sample Ingested Notes to demonstrate badges
  const sampleIngestedNote: QuickNote = {
    id: `note_ingest_demo_${Date.now()}`,
    workspaceId,
    title: 'Slack #admissions: Lead Inquiry on IB Diploma Scholarship',
    document: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Inbound message from Slack #admissions-leads: Prospective parent inquired whether academic merit scholarships apply to the IB Diploma Year 1 program.',
            },
          ],
        },
      ],
    },
    categoryName: 'Inbound Webhooks',
    tags: ['slack', 'admissions', 'scholarship', 'inbox'],
    knowledgeType: 'opportunity',
    sentiment: 'positive',
    isPinned: false,
    isArchived: false,
    authorId: 'slack_webhook',
    authorName: 'Slack Bot (#admissions-leads)',
    createdAt: now,
    updatedAt: now,
  };

  await QuickNotesRepository.create(sampleIngestedNote);
  console.log(`[SEED_FEDERATION] Created Sample Ingested Note: "${sampleIngestedNote.title}"`);

  console.log('[SEED_FEDERATION] Successfully completed seeding for Phase 9!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[SEED_FEDERATION_ERROR]', err);
  process.exit(1);
});
