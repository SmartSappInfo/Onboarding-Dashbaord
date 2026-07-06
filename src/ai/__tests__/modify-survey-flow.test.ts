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
            modelId: 'claude-sonnet-4-6'
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
});
