/**
 * {{Org_name}} Experience Platform — Shared Content Starter Templates
 *
 * Single source of truth for pedagogical and editorial starter layouts
 * (Articles, Lessons, Resource Guides, Documentation).
 *
 * Rules:
 * - Strictly typed: ZERO `any`, ZERO `any[]`, ZERO unhandled `unknown`.
 * - Strictly valid PageBlock structures conforming to registered Zod schemas.
 * - Reusable across Content Studio and Page Builder without marketing bloat.
 * - Deep-clone hydration via `instantiateContentTemplate()` with fresh unique block IDs.
 *
 * CAUTION FOR MAINTAINERS:
 * When modifying or adding templates, ensure block `props` strictly conform to the schemas
 * in `src/lib/page-builder/blocks/*`. Validate with `content-templates.test.ts`.
 */

import type { PageBlock } from '@/lib/types';
import type { ContentItemType } from '@/lib/types/content';

export interface ContentStarterTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: ContentItemType;
  readonly category: string;
  readonly badge: string;
  readonly blocks: PageBlock[];
  readonly suggestedSummary?: string;
  readonly thumbnailUrl?: string;
}

/**
 * Standard Editorial Article Template
 * Ideal for thought leadership, policy updates, company news, and blogs.
 */
const STANDARD_ARTICLE_TEMPLATE: ContentStarterTemplate = {
  id: 'article-standard-starter',
  name: 'Standard Editorial Article',
  description: 'Clean editorial structure with title, lead paragraph, multi-column analysis, and call-to-action.',
  type: 'article',
  category: 'Editorial',
  badge: 'Article',
  suggestedSummary: 'Comprehensive analysis and practical guidelines on key institutional strategies.',
  blocks: [
    {
      id: 'art-title-1',
      type: 'title',
      props: {
        preset: 'section-heading',
        title: 'Transforming Institutional Workflows: A Modern Blueprint',
        subheading: 'Practical methodologies to streamline team operations and eliminate administrative overhead.',
        alignment: 'left',
        textColorMode: 'dark',
      },
    },
    {
      id: 'art-divider-1',
      type: 'divider',
      props: {
        style: 'solid',
        color: '#e2e8f0',
      },
    },
    {
      id: 'art-text-lead',
      type: 'text',
      props: {
        preset: 'lead',
        content: '<p>Modern organizations require agile operational frameworks. By automating repetitive administrative tasks and consolidating communications into a unified portal, teams achieve higher engagement with minimal friction.</p>',
        textColorMode: 'dark',
        textAlign: 'left',
      },
    },
    {
      id: 'art-img-hero',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
        alt: 'Strategic operations planning meeting',
        caption: 'Figure 1: Cross-departmental alignment session during onboarding implementation.',
        width: 'full',
        borderRadius: 'rounded',
        alignment: 'center',
      },
    },
    {
      id: 'art-text-body1',
      type: 'text',
      props: {
        preset: 'paragraph',
        content: '<h3><b>Key Pillars of Digital Modernization</b></h3><p>To establish durable improvements, institutions must address three critical operational dimensions simultaneously: data centralization, automated verification, and proactive member communication.</p>',
        textColorMode: 'dark',
        textAlign: 'left',
      },
    },
    {
      id: 'art-cols-takeaways',
      type: 'columns',
      props: {
        variant: '1-1',
        gap: 24,
      },
      blocks: [
        {
          id: 'art-col-1-text',
          type: 'text',
          props: {
            preset: 'paragraph',
            content: '<h4><b>1. Unified Data Governance</b></h4><p>Maintain a single source of truth across all contact touchpoints to prevent mismatched records and duplicate outreach.</p>',
            textColorMode: 'dark',
            textAlign: 'left',
          },
        },
        {
          id: 'art-col-2-text',
          type: 'text',
          props: {
            preset: 'paragraph',
            content: '<h4><b>2. Automated Escalation</b></h4><p>Deploy event-triggered notifications to instantly notify managers when member engagement drops or tasks stall.</p>',
            textColorMode: 'dark',
            textAlign: 'left',
          },
        },
      ],
    },
    {
      id: 'art-cta-bottom',
      type: 'cta',
      props: {
        label: 'Access Knowledge Hub',
        url: '#',
        variant: 'primary',
        actionType: 'url',
      },
    },
  ],
};

/**
 * Interactive Curriculum Lesson Template
 * Ideal for structured courses, onboarding modules, video masterclasses, and training paths.
 */
const CURRICULUM_LESSON_TEMPLATE: ContentStarterTemplate = {
  id: 'lesson-curriculum-starter',
  name: 'Interactive Curriculum Lesson',
  description: 'Pedagogical layout with video embed, learning objectives, action checklist, and completion summary.',
  type: 'lesson',
  category: 'Learning',
  badge: 'Course Lesson',
  suggestedSummary: 'In this lesson, learners master core execution concepts and complete hands-on verification tasks.',
  blocks: [
    {
      id: 'les-title-1',
      type: 'title',
      props: {
        preset: 'section-heading',
        title: 'Module 1: Core Fundamentals & Workflow Setup',
        subheading: 'Watch the instructional video below and complete the action checklist to unlock next module.',
        alignment: 'left',
        textColorMode: 'dark',
      },
    },
    {
      id: 'les-video-1',
      type: 'video',
      props: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        videoData: {
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnailUrl: '',
          title: '12-Minute Guided Walkthrough on Workspace Configuration',
          description: 'Instructional walkthrough of workspace setup and multi-tenant access boundaries',
        },
        provider: 'youtube',
        playMode: 'inline',
      },
    },
    {
      id: 'les-objectives-list',
      type: 'procedure_list',
      props: {
        title: 'Learning Objectives',
        steps: [
          'Understand workspace scoping and multi-tenant access boundaries',
          'Configure custom contact tags and automated outcome triggers',
          'Publish verified digital onboarding pages with real-time analytics',
        ],
      },
    },
    {
      id: 'les-text-concept',
      type: 'text',
      props: {
        preset: 'paragraph',
        content: '<h3><b>Detailed Concept Breakdown</b></h3><p>When provisioning institutional accounts, security policies dictate that administrators maintain distinct workspace credentials while allowing unified reporting at the organization tier.</p>',
        textColorMode: 'dark',
        textAlign: 'left',
      },
    },
    {
      id: 'les-action-checklist',
      type: 'text',
      props: {
        preset: 'checklist',
        content: '<h4><b>Action Checklist: Complete Before Next Lesson</b></h4><p>✅ <b>Step 1:</b> Verify organization settings in the admin sidebar.</p><p>✅ <b>Step 2:</b> Assign contact tags to your first pilot cohort.</p><p>✅ <b>Step 3:</b> Submit the verification quiz below to record course credit.</p>',
        textColorMode: 'dark',
        textAlign: 'left',
      },
    },
    {
      id: 'les-faq-troubleshoot',
      type: 'faq',
      props: {
        items: [
          {
            id: 'q1',
            question: 'What if my verification link does not generate immediately?',
            answer: 'Check that your organization has active domain credentials configured under Portal Settings -> Domain.',
          },
          {
            id: 'q2',
            question: 'Can I re-take this lesson after submitting?',
            answer: 'Yes, all enrolled members have permanent lifetime review access to completed curriculum materials.',
          },
        ],
        textColorMode: 'dark',
      },
    },
  ],
};

/**
 * Downloadable Resource Guide Template
 * Ideal for downloadable worksheets, spreadsheets, PDF handbooks, templates, and checklists.
 */
const RESOURCE_DOWNLOAD_TEMPLATE: ContentStarterTemplate = {
  id: 'resource-download-starter',
  name: 'Downloadable Resource Guide',
  description: 'Resource showcase with file preview details, usage guide, and technical download specs.',
  type: 'resource',
  category: 'Vault',
  badge: 'Resource',
  suggestedSummary: 'Downloadable spreadsheet template and implementation guidelines for team distribution.',
  blocks: [
    {
      id: 'res-title-1',
      type: 'title',
      props: {
        preset: 'section-heading',
        title: 'Bursary Fee Collection & Reconciliation Worksheet',
        subheading: 'Official template in XLSX format with pre-built formulas, automated balance tracking, and audit tabs.',
        alignment: 'left',
        textColorMode: 'dark',
      },
    },
    {
      id: 'res-text-overview',
      type: 'text',
      props: {
        preset: 'lead',
        content: '<p><b>Resource Specifications:</b></p><p>• <b>Format:</b> Microsoft Excel (.xlsx) & Google Sheets<br/>• <b>Version:</b> 2026.4 (Updated This Term)<br/>• <b>License:</b> Unrestricted internal use for all verified portal members</p>',
        textColorMode: 'dark',
        textAlign: 'left',
      },
    },
    {
      id: 'res-steps-guide',
      type: 'step_section',
      props: {
        stepNumber: 1,
        heading: 'How to Implement This Template',
        description: 'Download the source file using the vault button, import student ledger rosters into Column A, and reconcile bank statements weekly.',
        videoUrl: '',
        imageUrl: '',
        mediaPosition: 'bottom',
        accentColor: '#10b981',
      },
    },
    {
      id: 'res-cta-download',
      type: 'cta',
      props: {
        label: 'Download File (.xlsx)',
        url: '#',
        variant: 'primary',
        actionType: 'url',
      },
    },
  ],
};

/**
 * Knowledge Base & Documentation Article Template
 * Ideal for help centres, technical documentation, API guides, and troubleshooting wikis.
 */
const DOCUMENTATION_KB_TEMPLATE: ContentStarterTemplate = {
  id: 'documentation-kb-starter',
  name: 'Knowledge Base Documentation',
  description: 'Structured documentation page with summary callout, numbered procedure steps, and troubleshooting FAQ.',
  type: 'page',
  category: 'Documentation',
  badge: 'Help Doc',
  suggestedSummary: 'Step-by-step instructions for configuring and troubleshooting system integration endpoints.',
  blocks: [
    {
      id: 'doc-title-1',
      type: 'title',
      props: {
        preset: 'section-heading',
        title: 'Configuring Webhook Endpoints & Event Subscriptions',
        subheading: 'Learn how to receive real-time payload alerts when portal members complete lessons or register.',
        alignment: 'left',
        textColorMode: 'dark',
      },
    },
    {
      id: 'doc-callout-summary',
      type: 'text',
      props: {
        preset: 'paragraph',
        content: '<h4><b>Prerequisites</b></h4><p>Before configuring endpoints, ensure you have Organization Admin permissions and your server accepts HTTPS POST payloads with valid TLS certificates.</p>',
        textColorMode: 'dark',
        textAlign: 'left',
      },
    },
    {
      id: 'doc-procedure-steps',
      type: 'procedure_list',
      props: {
        title: 'Step-by-Step Setup Procedure',
        steps: [
          'Step 1: Generate Webhook Signing Secret in Portal Settings -> API Keys',
          'Step 2: Register Destination HTTPS Callback URL',
          'Step 3: Test Event Delivery with simulated payload',
        ],
      },
    },
    {
      id: 'doc-faq-troubleshoot',
      type: 'faq',
      props: {
        items: [
          {
            id: 'd1',
            question: 'What happens if my server responds with a 500 error?',
            answer: 'Our webhook dispatcher automatically retries failed deliveries using exponential backoff (up to 5 attempts over 24 hours).',
          },
          {
            id: 'd2',
            question: 'How do I rotate my webhook secret without downtime?',
            answer: 'Our system supports dual-active secret windows during 48-hour rotation intervals.',
          },
        ],
        textColorMode: 'dark',
      },
    },
  ],
};

/**
 * Complete catalog of built-in starter templates for Content Studio.
 */
export const CONTENT_STARTER_TEMPLATES: ReadonlyArray<ContentStarterTemplate> = [
  STANDARD_ARTICLE_TEMPLATE,
  CURRICULUM_LESSON_TEMPLATE,
  RESOURCE_DOWNLOAD_TEMPLATE,
  DOCUMENTATION_KB_TEMPLATE,
];

/**
 * Deep-clones a starter template and regenerates unique block IDs
 * to prevent ID collisions when inserted into the canvas.
 *
 * Recursively walks nested layout blocks (`columns`, `container`)
 * and generates fresh, globally unique IDs.
 */
export function instantiateContentTemplate(templateId: string): PageBlock[] {
  const tpl = CONTENT_STARTER_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) {
    throw new Error(`Starter template "${templateId}" not found in catalog.`);
  }

  const cloneBlocksWithNewIds = (blocks: PageBlock[]): PageBlock[] => {
    return blocks.map((block) => {
      const uniqueSuffix = Math.random().toString(36).slice(2, 9);
      const newId = `blk_${block.type}_${Date.now()}_${uniqueSuffix}`;

      const cloned: PageBlock = {
        id: newId,
        type: block.type,
        props: JSON.parse(JSON.stringify(block.props || {})) as Record<string, unknown>,
      };

      if (Array.isArray(block.blocks) && block.blocks.length > 0) {
        cloned.blocks = cloneBlocksWithNewIds(block.blocks);
      }

      return cloned;
    });
  };

  return cloneBlocksWithNewIds(tpl.blocks);
}
