import type { IndustryVertical, ContactScope, ContactIdentifierPolicy, WorkspaceStatus } from '@/lib/types';

export interface WorkspaceFormState {
    name: string;
    description: string;
    color: string;
    industry: IndustryVertical;
    contactScope: ContactScope;
    contactPolicy: ContactIdentifierPolicy;
    restrictVisibilityToAssigned: boolean;
    statuses: WorkspaceStatus[];
}

export const INITIAL_FORM_STATE: WorkspaceFormState = {
    name: '',
    description: '',
    color: '#3B5FFF',
    industry: 'SaaS',
    contactScope: 'institution',
    contactPolicy: 'phone_or_email',
    restrictVisibilityToAssigned: true,
    statuses: [
        { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF' },
        { value: 'Active', label: 'Active', color: '#10b981' },
        { value: 'Churned', label: 'Churned', color: '#ef4444' }
    ]
};

export const STEPPER_STEPS = [
    { label: 'Basics', description: 'Name, objective and theme' },
    { label: 'Industry & Scope', description: 'Domain focus and data model' },
    { label: 'Governance', description: 'Policies and visibility scope' },
    { label: 'Lifecycles & Finish', description: 'Custom statuses and preview' }
] as const;
