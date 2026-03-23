'use client';

import { collection, query, where, getDocs, doc, getDoc, type Firestore } from 'firebase/firestore';
import type { AutomationRule, AutomationAction, AutomationTrigger, School, FocalPerson } from './types';
import { sendMessage } from './messaging-engine';
import { createTaskNonBlocking } from './task-actions';
import { addDays } from 'date-fns';

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
            if (!action.templateId) return;
            
            const recipient = await resolveRecipient(action, school);
            if (!recipient) return;

            await sendMessage({
                templateId: action.templateId,
                senderProfileId: action.senderProfileId || 'default',
                recipient,
                variables: { 
                    school_name: school.name, 
                    school_id: school.id,
                    contact_name: school.contactPerson || ''
                },
                schoolId: school.id
            });
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
                schoolId: school.id,
                workspaceId: 'onboarding',
                schoolName: school.name,
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
    
    if (action.recipientType === 'focal_person' && action.focalPersonType) {
        const person = school.focalPersons?.find(p => p.type === action.focalPersonType);
        return person?.email || null;
    }

    return school.focalPersons[0].email || null;
}
