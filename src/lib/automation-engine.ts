'use client';

import { collection, query, where, getDocs, doc, getDoc, type Firestore } from 'firebase/firestore';
import type { AutomationRule, AutomationAction, AutomationTrigger, School, FocalPerson, EntityContact } from './types';
import { sendMessage } from './messaging-engine';
import { createTaskNonBlocking } from './task-actions';
import { addDays } from 'date-fns';
import { getContactPerson } from './entity-helpers';
import { normalizeContactType, resolveEntityContacts, focalPersonToEntityContact } from './entity-contact-helpers';

/**
 * @fileOverview Global Automation Engine.
 * Evaluates rules against system events and dispatches cross-module actions.
 */

interface TriggerContext {
    school: School;
    trigger: AutomationTrigger;
    payload?: any;
}

export async function evaluateAutomations(db: Firestore, context: TriggerContext) {
    console.log(`>>> [AUTO] Evaluating ${context.trigger} for ${context.school.name}`);

    try {
        const rulesRef = collection(db, 'automations');
        const rulesQuery = query(rulesRef, where('trigger', '==', context.trigger), where('isActive', '==', true));
        const rulesSnap = await getDocs(rulesQuery);

        if (rulesSnap.empty) return;

        for (const ruleDoc of rulesSnap.docs) {
            const rule = { id: ruleDoc.id, ...ruleDoc.data() } as AutomationRule;
            
            // Check Conditions
            const isMatch = rule.conditions.every(condition => {
                const actualValue = (context.school as any)[condition.field] || (context.payload as any)?.[condition.field];
                
                switch (condition.operator) {
                    case 'equals': return String(actualValue) === String(condition.value);
                    case 'not_equals': return String(actualValue) !== String(condition.value);
                    case 'contains': return String(actualValue).toLowerCase().includes(String(condition.value).toLowerCase());
                    default: return false;
                }
            });

            if (isMatch) {
                console.log(`>>> [AUTO] Rule Matched: ${rule.name}`);
                for (const action of rule.actions) {
                    await executeAction(db, action, context);
                }
            }
        }
    } catch (error) {
        console.error(">>> [AUTO] Engine Failure:", error);
    }
}

async function executeAction(db: Firestore, action: AutomationAction, context: TriggerContext) {
    const { school } = context;

    switch (action.type) {
        case 'SEND_MESSAGE':
            // Task 15.1: Support both legacy templateId and new category/type approach
            if (!action.templateId && (!action.templateCategory || !action.templateType)) return;
            
            const recipient = await resolveRecipient(action, school);
            if (!recipient) return;

            const workspaceId = school.workspaceIds?.[0] || 'onboarding';
            
            // Task 15.1: Use resolveAndRender for new template system if category/type provided
            if (action.templateCategory && action.templateType) {
                // Get organizationId from workspace
                const workspaceDoc = await getDoc(doc(db, 'workspaces', workspaceId));
                if (!workspaceDoc.exists()) {
                    console.error(`Workspace ${workspaceId} not found`);
                    return;
                }
                const organizationId = workspaceDoc.data()!.organizationId;
                
                // Import resolveAndRender dynamically to avoid circular dependencies
                const { resolveAndRender } = await import('./template-resolver');
                const rendered: { subject?: string; body: string } = await resolveAndRender(
                    action.templateCategory,
                    action.templateType,
                    organizationId,
                    {
                        entityId: school.id,
                        workspaceId,
                        extraVars: {
                            school_name: school.name,
                            school_id: school.id,
                            contact_name: getContactPerson(school) || ''
                        }
                    }
                );
                
                // Send message with rendered content
                await sendMessage({
                    templateId: action.templateId || 'automation-generated',
                    senderProfileId: action.senderProfileId || 'default',
                    recipient,
                    variables: {
                        school_name: school.name,
                        school_id: school.id,
                        contact_name: getContactPerson(school) || ''
                    },
                    entityId: school.id,
                    workspaceId,
                    // Override with rendered content
                    ...(rendered.subject && { subject: rendered.subject }),
                    body: rendered.body as string
                });
            } else {
                // Legacy path: use templateId directly
                await sendMessage({
                    templateId: action.templateId || 'default-template',
                    senderProfileId: action.senderProfileId || 'default',
                    recipient,
                    variables: { 
                        school_name: school.name, 
                        school_id: school.id,
                        contact_name: getContactPerson(school) || ''
                    },
                    entityId: school.id,
                    workspaceId
                });
            }
            break;

        case 'CREATE_TASK':
            const assignedTo = school.assignedTo?.userId || '';
            if (!assignedTo) return;

            const dueDate = addDays(new Date(), action.taskDueOffsetDays || 1);

            /*FIX This Manually*/
     /*       createTaskNonBlocking(db, {
                title: action.taskTitle || 'Automated Follow-up',
                description: action.taskDescription || `Triggered by ${context.trigger}`,
                priority: action.taskPriority || 'medium',
                status: 'todo',
                category: action.taskCategory || 'general',
                entityId: school.id,
                workspaceId: 'onboarding',
                entityName: school.name,
                assignedTo,
                assignedToName: school.assignedTo?.name || 'Manager',
                dueDate: dueDate.toISOString(),
                source: 'automation',
                automationId: 'auto_sys',
            });*/
            break;
    }
}

async function resolveRecipient(action: AutomationAction, school: School): Promise<string | null> {
    if (action.recipientType === 'fixed') return action.fixedRecipient || null;
    if (action.recipientType === 'manager') return school.assignedTo?.email || null;
    
    // FER-01: Resolve recipient dynamically using EntityContact model
    const contacts = resolveEntityContacts(school as any);
    
    if (action.recipientType === 'focal_person' && action.focalPersonType) {
        const targetTypeKey = normalizeContactType(action.focalPersonType);
        const person = contacts.find(c => c.typeKey === targetTypeKey);
        if (person?.email) return person.email;
    }

    // Default: use derived primary contact (or fallback to first contact)
    const primary = contacts.find(c => c.isPrimary) || contacts[0];
    return primary?.email || null;
}
