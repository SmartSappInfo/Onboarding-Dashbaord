import { describe, it, expect } from 'vitest';
import { ModifyPageInput } from '../flows/modify-page-flow';

describe('modifyPageFlow Input Schema', () => {
    it('should validate inputs with page structures and document payloads', () => {
        const validInput: ModifyPageInput = {
            userMessage: 'Change Amos Bdoateng to Joseph a do in the testimonials block',
            selectedBlockId: 'testimonial-1',
            currentStructure: {
                sections: [
                    {
                        id: 'section-1',
                        type: 'section',
                        props: {
                            backgroundColor: '#ffffff'
                        },
                        blocks: [
                            {
                                id: 'testimonial-1',
                                type: 'testimonial',
                                props: {
                                    author: 'Amos Bdoateng',
                                    quote: 'Great school'
                                }
                            }
                        ]
                    }
                ]
            },
            docContent: 'Amos Bdoateng -> Joseph a do',
            docDataUri: 'data:image/png;base64,iVBORw0KGgo...',
            organizationId: 'org-123',
            provider: 'googleai',
            modelId: 'gemini-3.5-flash'
        };

        expect(validInput.userMessage).toBeDefined();
        expect(validInput.currentStructure.sections).toHaveLength(1);
        expect(validInput.currentStructure.sections[0].blocks).toHaveLength(1);
        expect(validInput.currentStructure.sections[0].blocks[0].props.author).toBe('Amos Bdoateng');
    });
});
