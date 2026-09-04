import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  KNOWLEDGE_TEMPLATES_COLLECTION,
  type KnowledgeTemplate,
  type KnowledgeType,
  type NoteDocument,
} from './quick-notes-types';
import { pruneUndefined } from './quick-notes-domain';

export interface TemplatePresetDefinition {
  name: string;
  description: string;
  knowledgeType: KnowledgeType;
  icon: string;
  color: string;
  order: number;
  content: NoteDocument;
}

/** Helper to generate standard TipTap document nodes */
function createSection(headingText: string, placeholderText = ''): NoteDocument[] {
  const nodes: NoteDocument[] = [
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: headingText }],
    },
  ];
  if (placeholderText) {
    nodes.push({
      type: 'paragraph',
      content: [{ type: 'text', text: placeholderText }],
    });
  } else {
    nodes.push({
      type: 'paragraph',
      content: [],
    });
  }
  return nodes;
}

export const DEFAULT_TEMPLATE_PRESETS: TemplatePresetDefinition[] = [
  {
    name: 'Customer Call & Objections',
    description: 'Structure client calls, pain points, objections, and buying signals.',
    knowledgeType: 'feedback',
    icon: 'PhoneCall',
    color: 'emerald',
    order: 0,
    content: {
      type: 'doc',
      content: [
        ...createSection('📞 Call Context', 'Customer / Lead name, date, and primary purpose:'),
        ...createSection('💬 Key Discussion & Needs', 'What specific requirements or challenges did they highlight?'),
        ...createSection('⚠️ Objections & Concerns', 'Pricing, timing, competitor comparison, or onboarding friction:'),
        ...createSection('🎯 Buying Signals & Sentiment', 'Interest level, urgency, decision timeline:'),
        ...createSection('✅ Commitments & Next Steps', 'Who is doing what by when?'),
      ],
    },
  },
  {
    name: 'Meeting Notes & Next Steps',
    description: 'Document team alignment, key takeaways, and accountable action items.',
    knowledgeType: 'note',
    icon: 'Users',
    color: 'blue',
    order: 1,
    content: {
      type: 'doc',
      content: [
        ...createSection('🎯 Meeting Objective', 'Core purpose and desired outcome of this session:'),
        ...createSection('👥 Attendees', 'Participants present:'),
        ...createSection('📋 Key Discussion Points', 'Summary of main topics covered:'),
        ...createSection('💡 Key Decisions', 'Agreements and conclusions reached:'),
        ...createSection('🚀 Action Items', 'Task | Assignee | Due Date:'),
      ],
    },
  },
  {
    name: 'Strategic Decision (RFC)',
    description: 'Record architectural, operational, or business decisions with rationale.',
    knowledgeType: 'decision',
    icon: 'CheckCircle2',
    color: 'emerald',
    order: 2,
    content: {
      type: 'doc',
      content: [
        ...createSection('📌 Context & Problem Statement', 'Why does this decision need to be made now?'),
        ...createSection('⚖️ Options Considered', 'Option A vs Option B with pros and cons:'),
        ...createSection('🏆 Chosen Direction', 'The selected option and primary rationale:'),
        ...createSection('📉 Trade-offs & Risks', 'What are we giving up, and how do we mitigate the risks?'),
        ...createSection('📈 Impact & Success Metrics', 'How will we measure whether this was the right decision?'),
      ],
    },
  },
  {
    name: 'Product / Feature Idea Hypothesis',
    description: 'Explore concepts, problem hypotheses, assumptions, and experiments.',
    knowledgeType: 'idea',
    icon: 'Lightbulb',
    color: 'amber',
    order: 3,
    content: {
      type: 'doc',
      content: [
        ...createSection('💡 The Concept', 'One paragraph describing the idea and user experience:'),
        ...createSection('🎯 Problem Solved', 'What user friction or organizational pain point does this eliminate?'),
        ...createSection('🔍 Key Assumptions to Validate', 'What must be true for this idea to succeed?'),
        ...createSection('🧪 Proposed Experiment / Prototype', 'The fastest, lowest-cost way to test this:'),
        ...createSection('📊 Target Success Metric', 'How will we know if it succeeded?'),
      ],
    },
  },
  {
    name: 'School Visit & Field Observation',
    description: 'Capture on-site observations, stakeholder needs, and field findings.',
    knowledgeType: 'observation',
    icon: 'School',
    color: 'indigo',
    order: 4,
    content: {
      type: 'doc',
      content: [
        ...createSection('🏫 School & Visit Details', 'School name, location, visit date, and primary contact:'),
        ...createSection('👀 Environment & Culture', 'Physical infrastructure, digital readiness, daily workflow observations:'),
        ...createSection('📢 Stakeholder Feedback', 'Quotes and direct feedback from teachers, heads, or administrators:'),
        ...createSection('🌟 Opportunity Areas', 'Where can SmartSapp provide immediate value?'),
        ...createSection('📌 Follow-up Actions', 'Immediate next steps post-visit:'),
      ],
    },
  },
  {
    name: 'Campaign Concept Brief',
    description: 'Outline audience, core message, value proposition, and channel tactics.',
    knowledgeType: 'strategy',
    icon: 'Compass',
    color: 'purple',
    order: 5,
    content: {
      type: 'doc',
      content: [
        ...createSection('🚀 Campaign Theme & Goal', 'Core campaign concept and overarching objective:'),
        ...createSection('🎯 Target Audience Segment', 'Who are we speaking to (demographics, job roles, pain points)?'),
        ...createSection('✨ Core Message & Hook', 'The central value proposition that captures attention:'),
        ...createSection('📡 Distribution Channels', 'Email, WhatsApp, Webinars, Social, Field events:'),
        ...createSection('📈 Target KPIs & Conversions', 'Leads generated, signups, response rate target:'),
      ],
    },
  },
];

/**
 * Seeds the default knowledge templates for a workspace if none exist yet.
 * Safe to run multiple times; checks for existing templates first.
 */
export async function seedDefaultKnowledgeTemplates(
  firestore: Firestore,
  workspaceId: string,
  organizationId: string,
  userId: string
): Promise<number> {
  if (!firestore || !workspaceId || !organizationId || !userId) return 0;

  const existingQuery = query(
    collection(firestore, KNOWLEDGE_TEMPLATES_COLLECTION),
    where('workspaceId', '==', workspaceId)
  );
  const snap = await getDocs(existingQuery);
  if (!snap.empty) {
    return 0; // Already seeded or has custom templates
  }

  const now = new Date().toISOString();
  let seededCount = 0;

  for (const preset of DEFAULT_TEMPLATE_PRESETS) {
    const data: Omit<KnowledgeTemplate, 'id'> = {
      organizationId,
      workspaceId,
      name: preset.name,
      description: preset.description,
      knowledgeType: preset.knowledgeType,
      icon: preset.icon,
      color: preset.color,
      content: preset.content,
      order: preset.order,
      isSystem: true,
      isArchived: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await addDoc(collection(firestore, KNOWLEDGE_TEMPLATES_COLLECTION), pruneUndefined(data as unknown as Record<string, unknown>));
    seededCount++;
  }

  return seededCount;
}
