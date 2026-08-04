import { describe, it, expect } from 'vitest';
import { resolveTextWithMap } from '../utils/variable-replacer';
import { FieldsVariablesService } from '../services/fields-variables-service-impl';
import type { Survey, SurveyResponse } from '../types';

describe('Survey Variable Resolution Engine', () => {
    it('resolves dynamic question variable tokens like {{q_entity_name_input}}', () => {
        const valuesMap = new Map<string, unknown>();
        valuesMap.set('q_entity_name_input', 'SmartSapp School A');
        valuesMap.set('contact_name', 'Alberta Sasu');
        valuesMap.set('contact_phone', '0276732535');
        valuesMap.set('contact_email', 'albertafosua@icloud.com');

        const smsText = 'Hi {{contact_name}}, Your quiz results for {{q_entity_name_input}} is ready.';
        const resolved = resolveTextWithMap(smsText, valuesMap);

        expect(resolved).toBe('Hi Alberta Sasu, Your quiz results for SmartSapp School A is ready.');
    });

    it('prioritizes submitted respondent phone and email over default fallbacks', () => {
        const valuesMap = new Map<string, unknown>();
        valuesMap.set('contact_phone', '0276732535');
        valuesMap.set('contact_email', 'albertafosua@icloud.com');
        valuesMap.set('__fallback__contact_phone', 'our contact number');
        valuesMap.set('__fallback__contact_email', 'info@domain.com');

        const alertText = 'Respondent: Alberta Sasu Phone: {{contact_phone}} Email: {{contact_email}}';
        const resolved = resolveTextWithMap(alertText, valuesMap);

        expect(resolved).toBe('Respondent: Alberta Sasu Phone: 0276732535 Email: albertafosua@icloud.com');
        expect(resolved).not.toContain('our contact number');
        expect(resolved).not.toContain('info@domain.com');
    });

    it('resolves question variable key aliases for survey answers', async () => {
        const mockSurvey: Partial<Survey> = {
            id: 'survey_parents_1',
            title: 'Parents Survey - SmartSapp School A and B Campaign',
            elements: [
                {
                    id: 'q_1001',
                    variableName: 'q_entity_name_input',
                    title: 'Select your school',
                    type: 'text',
                    isRequired: true,
                } as any,
                {
                    id: 'q_1002',
                    variableName: 'parent_phone',
                    fieldKey: 'contact_phone',
                    title: 'Your Phone Number',
                    type: 'phone',
                    isRequired: true,
                } as any,
                {
                    id: 'q_1003',
                    variableName: 'parent_email',
                    fieldKey: 'contact_email',
                    title: 'Your Email Address',
                    type: 'email',
                    isRequired: true,
                } as any,
            ],
        };

        const mockResponse: Partial<SurveyResponse> = {
            id: 'resp_alberta_1',
            surveyId: 'survey_parents_1',
            submittedAt: new Date().toISOString(),
            respondentName: 'Alberta Sasu',
            score: 9,
            answers: [
                { questionId: 'q_1001', value: 'SmartSapp School A' },
                { questionId: 'q_1002', value: '0276732535' },
                { questionId: 'q_1003', value: 'albertafosua@icloud.com' },
            ] as any,
        };

        // Get variable map
        const valuesMap = await FieldsVariablesService.getVariableValuesMap({
            workspaceId: 'mock-workspace-id',
            surveyId: 'survey_parents_1',
            responseId: 'resp_alberta_1',
            preloadedEntity: { id: 'ent_1', name: 'SmartSapp School A' } as any,
            extraVars: {
                q_entity_name_input: 'SmartSapp School A',
                contact_phone: '0276732535',
                contact_email: 'albertafosua@icloud.com',
            },
        });

        expect(valuesMap.get('q_entity_name_input')).toBe('SmartSapp School A');
        expect(valuesMap.get('contact_phone')).toBe('0276732535');
        expect(valuesMap.get('contact_email')).toBe('albertafosua@icloud.com');
    });
});
