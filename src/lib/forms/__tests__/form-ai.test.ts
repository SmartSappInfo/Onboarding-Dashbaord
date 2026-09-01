import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateFormWithAiAction,
  suggestFormQuestionsAction,
  optimizeFormWithAiAction,
  generateFormLogicWithAiAction,
  rewriteQuestionCopyAction,
} from '../form-ai-actions';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => {
  const batchSet = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue({});
  const batchMock = vi.fn(() => ({
    set: batchSet,
    commit: batchCommit,
  }));

  const docMock = vi.fn((docId?: string) => ({
    id: docId || 'mock_generated_form_id_123',
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ id: 'current_draft' })),
    })),
  }));

  const collectionMock = vi.fn(() => ({
    doc: docMock,
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          docs: [
            { id: 'af_email', data: () => ({ label: 'Email Address', variableName: 'primaryEmail', type: 'email' }) },
            { id: 'af_phone', data: () => ({ label: 'Phone Number', variableName: 'primaryPhone', type: 'phone' }) },
          ],
        }),
      })),
    })),
  }));

  return {
    adminDb: {
      collection: collectionMock,
      batch: batchMock,
    },
  };
});

// Mock Next.js revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock AI flows
vi.mock('@/ai/flows/generate-form-flow', () => ({
  generateFormWithAi: vi.fn().mockResolvedValue({
    title: 'High School Boarding Admission',
    description: 'Please complete this application form to register for the upcoming academic year.',
    formPurpose: 'application',
    audienceMode: 'anonymous',
    pages: [
      { id: 'page_student', title: 'Student Information', subtitle: 'Basic bio data', order: 0 },
      { id: 'page_boarding', title: 'Boarding & Medical', subtitle: 'Disclosures and room options', order: 1 },
    ],
    components: [
      { id: 'comp_name', pageId: 'page_student', type: 'short_text', label: 'Full Student Name', isRequired: true },
      { id: 'comp_email', pageId: 'page_student', type: 'email', label: 'Parent Email', appFieldId: 'af_email', isRequired: true },
      { id: 'comp_boarding', pageId: 'page_boarding', type: 'yes_no', label: 'Do you require on-campus boarding?', isRequired: true },
      { id: 'comp_room', pageId: 'page_boarding', type: 'select', label: 'Room Preference', options: [{ label: 'Single En-suite', value: 'single' }, { label: 'Double Shared', value: 'double' }] },
    ],
    logicRules: [
      {
        id: 'rule_boarding_room',
        name: 'Show Room Preference when Boarding is Yes',
        conditionGroup: {
          operator: 'AND',
          conditions: [{ fieldId: 'comp_boarding', operator: 'equals', value: 'yes' }],
        },
        actions: [{ type: 'show_field', targetFieldId: 'comp_room' }],
      },
    ],
    successMessage: 'Application received! We will be in touch shortly.',
    suggestedNotifications: {
      sendConfirmationReceipt: true,
      alertDealOwner: true,
      confirmationSubject: 'Admission Application Received',
    },
  }),
}));

vi.mock('@/ai/flows/ai-form-assistant-flow', () => ({
  suggestQuestionsFlow: vi.fn().mockResolvedValue({
    suggestions: [
      {
        id: 'sug_allergies',
        label: 'Known Food Allergies or Dietary Restrictions',
        type: 'long_text',
        placeholder: 'e.g. Peanuts, lactose intolerance, gluten...',
        isRequired: false,
        rationale: 'Crucial health and safety information for boarding campus intake.',
      },
      {
        id: 'sug_guardian_phone',
        label: 'Emergency Guardian Phone Number',
        type: 'phone',
        isRequired: true,
        rationale: 'Primary contact channel for urgent medical or administrative notices.',
      },
    ],
  }),
  auditFormFrictionFlow: vi.fn().mockResolvedValue({
    healthScore: 88,
    estimatedCompletionSeconds: 120,
    readabilityLevel: 'simple',
    strengths: ['Clear 2-step page grouping', 'Concise labels'],
    frictionPoints: [
      { severity: 'medium', fieldId: 'comp_boarding', issue: 'Conditional field without jump logic', suggestion: 'Add skip logic for non-boarding students' },
    ],
    suggestedOptimizations: [
      { id: 'opt_1', title: 'Make Phone Optional', description: 'Improves initial conversion on mobile', actionType: 'make_optional', targetFieldId: 'comp_phone' },
    ],
  }),
  synthesizeLogicRuleFlow: vi.fn().mockResolvedValue({
    rules: [
      {
        id: 'rule_synth_1',
        name: 'Hide Room Preference when Not Boarding',
        conditionGroup: {
          operator: 'AND',
          conditions: [{ fieldId: 'comp_boarding', operator: 'equals', value: 'no' }],
        },
        actions: [{ type: 'hide_field', targetFieldId: 'comp_room' }],
      },
    ],
    explanation: 'When the respondent chooses "No" for boarding, the room preference selector is hidden.',
  }),
  rewriteQuestionCopyFlow: vi.fn().mockResolvedValue({
    label: 'What is your preferred room arrangement for boarding?',
    placeholder: 'Select single or shared room...',
    helpText: 'Subject to availability upon admission confirmation.',
    toneExplanation: 'Made the phrasing more conversational and welcoming.',
  }),
}));

describe('SmartSapp Forms 2.0: AI Form Generator & In-Canvas Copilot Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateFormWithAiAction', () => {
    it('validates missing prompt input', async () => {
      const res = await generateFormWithAiAction({
        prompt: '',
        workspaceId: 'ws_test',
        userId: 'u_test',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Please provide a prompt');
    });

    it('validates missing workspaceId', async () => {
      const res = await generateFormWithAiAction({
        prompt: 'Create a school admission form',
        workspaceId: '',
        userId: 'u_test',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('workspaceId is required');
    });

    it('synthesizes multi-page form blueprint, components, and logic rules', async () => {
      const res = await generateFormWithAiAction({
        prompt: 'Create an admission application for high school boarding with room options',
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        userId: 'u_admin',
        purpose: 'application',
        tone: 'academic',
        pageMode: 'multi',
        enableScoring: true,
      });

      expect(res.success).toBe(true);
      expect(res.formId).toBeDefined();
      expect(res.title).toBe('High School Boarding Admission');
      expect(res.slug).toContain('high-school-boarding-admission');
    });
  });

  describe('suggestFormQuestionsAction', () => {
    it('returns structured question suggestions with rationales', async () => {
      const res = await suggestFormQuestionsAction({
        formTitle: 'School Admission',
        existingQuestions: [{ id: 'comp_name', label: 'Student Name', type: 'short_text' }],
        contextPrompt: 'Add health and emergency questions',
      });

      expect(res.success).toBe(true);
      expect(res.suggestions.length).toBe(2);
      expect(res.suggestions[0].label).toContain('Allergies');
      expect(res.suggestions[1].type).toBe('phone');
    });
  });

  describe('optimizeFormWithAiAction', () => {
    it('computes UX health score, completion seconds, and friction points', async () => {
      const res = await optimizeFormWithAiAction({
        formTitle: 'School Admission',
        pagesCount: 2,
        questions: [
          { id: 'comp_1', label: 'Name', type: 'short_text', isRequired: true },
          { id: 'comp_2', label: 'Email', type: 'email', isRequired: true },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.report?.healthScore).toBe(88);
      expect(res.report?.estimatedCompletionSeconds).toBe(120);
      expect(res.report?.frictionPoints.length).toBeGreaterThan(0);
    });
  });

  describe('generateFormLogicWithAiAction', () => {
    it('compiles plain English instruction into AST logic rules', async () => {
      const res = await generateFormLogicWithAiAction({
        instruction: 'If not boarding, hide room choice',
        availableFields: [
          { id: 'comp_boarding', label: 'Boarding', type: 'yes_no' },
          { id: 'comp_room', label: 'Room Preference', type: 'select' },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.result?.rules.length).toBe(1);
      expect(res.result?.rules[0].actions[0].type).toBe('hide_field');
    });
  });

  describe('rewriteQuestionCopyAction', () => {
    it('refines question copy for target tone', async () => {
      const res = await rewriteQuestionCopyAction({
        label: 'Room choice',
        targetTone: 'friendly',
      });

      expect(res.success).toBe(true);
      expect(res.refined?.label).toContain('preferred room arrangement');
      expect(res.refined?.toneExplanation).toBeDefined();
    });
  });
});
