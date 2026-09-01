'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Question Bank Server Actions
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tier Visibility & Scoping:
 *    - System items (`visibility: 'system'`) are available to all tenants.
 *    - Workspace items (`visibility: 'workspace'`) are strictly scoped to `workspaceId`.
 * 2. Standardized Educational & Customer Experience Libraries:
 *    - Seeding action provides instant out-of-the-box NPS, CSAT, and parent feedback questions.
 * 3. Strict Zero-Any Invariant:
 *    - Strictly typed inputs and returns.
 * 4. Testability:
 *    - Tested in src/lib/surveys/__tests__/question-bank-actions.test.ts.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { QuestionBankItem } from './survey-v2-types';

export interface QuestionBankFilterOptions {
  category?: string;
  searchQuery?: string;
  questionType?: string;
}

export interface QuestionBankResult {
  success: boolean;
  items?: QuestionBankItem[];
  item?: QuestionBankItem;
  error?: string;
}

/**
 * Retrieves question bank items available for the specified workspace.
 */
export async function getQuestionBankItemsAction(
  workspaceId: string,
  filters?: QuestionBankFilterOptions
): Promise<QuestionBankResult> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'workspaceId is required.' };
    }

    const items: QuestionBankItem[] = [];

    // 1. Fetch system-wide standardized questions
    const systemSnap = await adminDb
      .collection('question_bank')
      .where('visibility', '==', 'system')
      .get();

    for (const doc of systemSnap.docs) {
      const data = doc.data();
      items.push({
        id: doc.id,
        visibility: 'system',
        category: data.category || 'general',
        industry: data.industry,
        metric: data.metric,
        title: data.title || '',
        description: data.description || '',
        questionType: data.questionType || 'text',
        options: Array.isArray(data.options) ? data.options : undefined,
        tags: Array.isArray(data.tags) ? data.tags : [],
        scoringWeight: data.scoringWeight,
        usageCount: data.usageCount || 0,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    }

    // 2. Fetch workspace-private custom questions
    const wsSnap = await adminDb
      .collection('question_bank')
      .where('workspaceId', '==', workspaceId)
      .where('visibility', '==', 'workspace')
      .get();

    for (const doc of wsSnap.docs) {
      const data = doc.data();
      items.push({
        id: doc.id,
        workspaceId,
        organizationId: data.organizationId,
        visibility: 'workspace',
        category: data.category || 'custom',
        industry: data.industry,
        metric: data.metric,
        title: data.title || '',
        description: data.description || '',
        questionType: data.questionType || 'text',
        options: Array.isArray(data.options) ? data.options : undefined,
        tags: Array.isArray(data.tags) ? data.tags : [],
        scoringWeight: data.scoringWeight,
        usageCount: data.usageCount || 0,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    }

    // Apply in-memory filtering
    let filtered = items;
    if (filters?.category && filters.category !== 'all') {
      filtered = filtered.filter((i) => i.category.toLowerCase() === filters.category?.toLowerCase());
    }
    if (filters?.questionType && filters.questionType !== 'all') {
      filtered = filtered.filter((i) => i.questionType === filters.questionType);
    }
    if (filters?.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort by category and usage count
    filtered.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

    return { success: true, items: filtered };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error querying question bank';
    console.error('[getQuestionBankItemsAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Saves a reusable question to the workspace question bank.
 */
export async function saveQuestionToBankAction(
  workspaceId: string,
  organizationId: string,
  itemData: Omit<QuestionBankItem, 'id' | 'createdAt' | 'updatedAt' | 'workspaceId' | 'organizationId'>
): Promise<QuestionBankResult> {
  try {
    if (!workspaceId || !itemData.title.trim()) {
      return { success: false, error: 'workspaceId and title are required.' };
    }

    const ref = adminDb.collection('question_bank').doc();
    const now = new Date().toISOString();

    const newItem: QuestionBankItem = {
      id: ref.id,
      workspaceId,
      organizationId,
      visibility: itemData.visibility || 'workspace',
      category: itemData.category || 'general',
      industry: itemData.industry,
      metric: itemData.metric,
      title: itemData.title.trim(),
      description: itemData.description?.trim(),
      questionType: itemData.questionType,
      options: itemData.options,
      tags: Array.isArray(itemData.tags) ? itemData.tags : [],
      scoringWeight: itemData.scoringWeight || 1,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(newItem);
    return { success: true, item: newItem };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error saving to question bank';
    console.error('[saveQuestionToBankAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Platform Seeding Action: Populates standard system libraries in /question_bank.
 */
export async function seedSystemQuestionBankAction(): Promise<{ success: boolean; seededCount: number; error?: string }> {
  try {
    const SEED_QUESTIONS: Array<Omit<QuestionBankItem, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        visibility: 'system',
        category: 'nps',
        metric: 'NPS',
        industry: 'Education & SaaS',
        title: 'How likely are you to recommend our institution to a friend or colleague?',
        description: 'Standard 0-10 Net Promoter Score scale for promoter/detractor segmentation.',
        questionType: 'rating',
        tags: ['nps', 'recommendation', 'loyalty'],
        scoringWeight: 1,
        usageCount: 150,
      },
      {
        visibility: 'system',
        category: 'csat',
        metric: 'CSAT',
        industry: 'Education',
        title: 'Overall, how satisfied are you with the support and services provided this term?',
        description: '5-point Customer Satisfaction Rating Scale.',
        questionType: 'rating',
        options: [
          { id: 'opt_1', text: '1 - Very Dissatisfied', value: 1, score: 20 },
          { id: 'opt_2', text: '2 - Dissatisfied', value: 2, score: 40 },
          { id: 'opt_3', text: '3 - Neutral', value: 3, score: 60 },
          { id: 'opt_4', text: '4 - Satisfied', value: 4, score: 80 },
          { id: 'opt_5', text: '5 - Very Satisfied', value: 5, score: 100 },
        ],
        tags: ['csat', 'satisfaction', 'term-feedback'],
        scoringWeight: 1,
        usageCount: 120,
      },
      {
        visibility: 'system',
        category: 'parent_experience',
        metric: 'Communication Quality',
        industry: 'K-12 Education',
        title: 'How effective is the school in keeping you informed about your child’s academic progress?',
        description: 'Assesses communication transparency between school administration and parents.',
        questionType: 'multiple-choice',
        options: [
          { id: 'p_opt_1', text: 'Extremely Effective', value: 'extremely_effective', score: 100 },
          { id: 'p_opt_2', text: 'Very Effective', value: 'very_effective', score: 80 },
          { id: 'p_opt_3', text: 'Somewhat Effective', value: 'somewhat_effective', score: 50 },
          { id: 'p_opt_4', text: 'Not Effective', value: 'not_effective', score: 10 },
        ],
        tags: ['parent', 'communication', 'progress'],
        scoringWeight: 1,
        usageCount: 95,
      },
      {
        visibility: 'system',
        category: 'teacher_wellbeing',
        metric: 'Workplace Climate',
        industry: 'Education',
        title: 'Do you feel you have the classroom resources and administrative support required to succeed?',
        description: 'Staff engagement and workplace resource adequacy assessment.',
        questionType: 'multiple-choice',
        options: [
          { id: 't_opt_1', text: 'Yes, fully supported', value: 'fully_supported', score: 100 },
          { id: 't_opt_2', text: 'Mostly supported', value: 'mostly_supported', score: 75 },
          { id: 't_opt_3', text: 'Needs improvement', value: 'needs_improvement', score: 40 },
          { id: 't_opt_4', text: 'Not supported', value: 'not_supported', score: 10 },
        ],
        tags: ['staff', 'wellbeing', 'resources'],
        scoringWeight: 1,
        usageCount: 60,
      },
      {
        visibility: 'system',
        category: 'general',
        metric: 'Open Feedback',
        title: 'What is one specific improvement that would make the biggest positive difference for you?',
        description: 'Open-ended qualitative response for sentiment and topic clustering.',
        questionType: 'text',
        tags: ['qualitative', 'suggestions', 'open-text'],
        scoringWeight: 0,
        usageCount: 200,
      },
    ];

    const batch = adminDb.batch();
    const now = new Date().toISOString();

    for (const q of SEED_QUESTIONS) {
      const ref = adminDb.collection('question_bank').doc();
      batch.set(ref, {
        ...q,
        id: ref.id,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
    return { success: true, seededCount: SEED_QUESTIONS.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error seeding question bank';
    console.error('[seedSystemQuestionBankAction Error]:', message);
    return { success: false, seededCount: 0, error: message };
  }
}
