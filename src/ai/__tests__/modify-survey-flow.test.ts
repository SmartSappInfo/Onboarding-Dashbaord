import { describe, it, expect } from 'vitest';
import { ModifySurveyInput } from '../flows/modify-survey-flow';

describe('modifySurveyFlow Input Schema', () => {
    it('should validate inputs with multimodal images and documents', () => {
        const validDocInput: ModifySurveyInput = {
            userMessage: 'Extract these fields from the document',
            docContent: 'Field 1: Name\nField 2: Email',
            docDataUri: 'data:application/pdf;base64,JVBERi0xLjQKJ...',
            docUrl: 'https://firebasestorage.googleapis.com/v0/b/bucket/o/doc.pdf',
            currentSurvey: {
                title: 'Contact Survey',
                description: 'A basic information capture form',
                elements: [],
                scoringEnabled: false,
                maxScore: 0,
                resultRules: [],
                resultPages: []
            },
            organizationId: 'org-123',
            provider: 'anthropic',
            modelId: 'claude-3-5-sonnet'
        };

        const validImageInput: ModifySurveyInput = {
            userMessage: 'Add these fields from this screenshot',
            docDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIA...',
            currentSurvey: {
                title: 'Enrollment Survey',
                description: 'Capture enrollment details',
                elements: [
                    { id: 'q_name', type: 'question', questionType: 'text', label: 'Name' }
                ],
                scoringEnabled: false,
                maxScore: 100,
                resultRules: [],
                resultPages: []
            },
            organizationId: 'org-456'
        };

        expect(validDocInput.docDataUri).toBeDefined();
        expect(validImageInput.docDataUri).toContain('data:image/png;base64');
    });

    it('should support currentSurvey validation containing styling properties', () => {
        const styledInput: ModifySurveyInput = {
            userMessage: 'Change styling to professional blue',
            currentSurvey: {
                title: 'styled survey',
                elements: [],
                backgroundColor: '#0f172a',
                backgroundPattern: 'grid',
                patternColor: '#38bdf8',
                startButtonText: 'Start Quiz',
                submitButtonText: 'Submit Answers',
                embedRedirectMode: 'parent',
                showCoverPage: true,
                showSurveyTitles: false
            }
        };

        expect(styledInput.currentSurvey.backgroundColor).toBe('#0f172a');
        expect(styledInput.currentSurvey.backgroundPattern).toBe('grid');
        expect(styledInput.currentSurvey.embedRedirectMode).toBe('parent');
    });

    it('should validate output elements without branching blowup', async () => {
        const { elementSchema, resultPageSchema, resultRuleSchema } = await import('../schemas/survey-schemas');

        // Test singleElementSchema handles questions, layout blocks, and logic blocks
        const validQuestion = elementSchema.parse({
            id: 'q_admin_role',
            type: 'text',
            title: 'What is your role?',
            isRequired: true,
        });
        expect(validQuestion.id).toBe('q_admin_role');

        const validSection = elementSchema.parse({
            id: 'sec_onboarding',
            type: 'section',
            title: 'Onboarding Flow',
            renderAsPage: true,
            stepperTitle: 'Flow',
        });
        expect(validSection.id).toBe('sec_onboarding');

        const validLogic = elementSchema.parse({
            id: 'logic_1',
            type: 'logic',
            rules: [{
                sourceQuestionId: 'q_admin_role',
                operator: 'isNotEmpty',
                action: { type: 'show', targetElementId: 'sec_onboarding' }
            }]
        });
        expect(validLogic.id).toBe('logic_1');

        const validResultPage = resultPageSchema.parse({
            id: 'rp_redesign_strategy',
            name: 'Product Redesign Focus',
            isDefault: true,
            blocks: [
                {
                    id: 'b_head',
                    type: 'heading',
                    title: 'Product Redesign Focus',
                    variant: 'h1',
                },
                {
                    id: 'b_list',
                    type: 'list',
                    items: ['Reduce unnecessary steps', 'Group related tasks together'],
                    listStyle: 'unordered',
                }
            ]
        });
        expect(validResultPage.name).toBe('Product Redesign Focus');
        expect(validResultPage.blocks.length).toBe(2);

        const validResultRule = resultRuleSchema.parse({
            id: 'rr_default',
            label: 'All Respondents',
            minScore: 0,
            maxScore: 100,
            priority: 1,
            pageId: 'rp_redesign_strategy',
        });
        expect(validResultRule.pageId).toBe('rp_redesign_strategy');
    });

    it('should validate interactiveActionSchema for canvas management', async () => {
        const { interactiveActionSchema } = await import('../schemas/survey-schemas');

        const validAction = interactiveActionSchema.parse({
            type: 'replace_or_append_canvas',
            title: 'Canvas Update Options',
            message: 'Would you like to replace the existing canvas or append below?',
            proposedElementsCount: 4,
            existingElementsCount: 2,
            proposedResultBlocksCount: 6,
            existingResultBlocksCount: 3,
            targetArea: 'result_page_blocks',
        });

        expect(validAction.type).toBe('replace_or_append_canvas');
        expect(validAction.targetArea).toBe('result_page_blocks');
        expect(validAction.proposedElementsCount).toBe(4);
    });

    it('should prune outcome-categories and score-card blocks when scoring is disabled in mergeSurveyPhases', async () => {
        const { mergeSurveyPhases } = await import('../utils/merge-survey-phases');

        const blueprint = {
            title: 'Customer Feedback',
            description: 'Unscored feedback collection',
            sections: [{ id: 'sec_1', title: 'Feedback', stepperTitle: 'Feedback', estimatedQuestions: 2 }],
            scoringEnabled: false,
            thankYouTitle: 'Thank You',
            thankYouDescription: 'We appreciate your time',
            bannerImageQuery: 'feedback',
        };

        const questions = {
            elements: [
                { id: 'q_feedback', type: 'text', title: 'Your Feedback' }
            ]
        };

        const logic = {
            maxScore: 0,
            resultPages: [
                {
                    id: 'rp_thanks',
                    name: 'Thank You Page',
                    isDefault: true,
                    blocks: [
                        { id: 'b_score', type: 'score-card' as const },
                        { id: 'b_cat', type: 'outcome-categories' as const },
                        { id: 'b_head', type: 'heading' as const, title: 'Thank You' },
                        { id: 'b_text', type: 'text' as const, content: 'Your submission has been recorded.' }
                    ]
                }
            ]
        };

        const merged = mergeSurveyPhases(blueprint, questions, logic);
        expect(merged.scoringEnabled).toBe(false);
        const firstPage = merged.resultPages[0] as { blocks?: Array<{ type?: unknown }> };
        const pageBlocks = firstPage.blocks || [];
        expect(pageBlocks.length).toBe(2);
        expect(pageBlocks.some(b => b.type === 'outcome-categories')).toBe(false);
        expect(pageBlocks.some(b => b.type === 'score-card')).toBe(false);
    });
});

