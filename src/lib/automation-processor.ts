
'use server';

import { adminDb } from './firebase-admin';
import type { Automation, AutomationRun, AutomationTrigger, School, MessageTemplate, SenderProfile, TaskCategory, TaskPriority } from './types';
import { sendMessage } from './messaging-engine';
import { createTaskNonBlocking } from './task-actions';
import { addDays } from 'date-fns';
import { logActivity } from './activity-logger';

/**
 * @fileOverview The SmartSapp Logic Processor (Execution Engine).
 * Orchestrates the real-time execution of automated protocols by traversing node trees.
 */

interface ExecutionContext {
    schoolId?: string;
    payload: Record<string, any>;
    automationId: string;
    runId: string;
}

/**
 * Orchestrator: Finds all active automations for a specific trigger and executes them.
 */
export async function triggerAutomationProtocols(trigger: AutomationTrigger, payload: Record<string, any>) {
    console.log(`>>> [LOGIC:PROCESSOR] Detecting Trigger: ${trigger}`);

    try {
        const automationsSnap = await adminDb.collection('automations')
            .where('trigger', '==', trigger)
            .where('isActive', '==', true)
            .get();

        if (automationsSnap.empty) return;

        for (const autoDoc of automationsSnap.docs) {
            const automation = { id: autoDoc.id, ...autoDoc.data() } as Automation;
            await executeAutomation(automation, payload);
        }
    } catch (error: any) {
        console.error(`>>> [LOGIC:PROCESSOR] Failed to poll automations:`, error.message);
    }
}

/**
 * Execution Engine: Traverses the node tree for a single automation run.
 */
async function executeAutomation(automation: Automation, triggerPayload: Record<string, any>) {
    const timestamp = new Date().toISOString();
    
    // 1. Initialize Run Ledger
    const runRef = await adminDb.collection('automation_runs').add({
        automationId: automation.id,
        automationName: automation.name,
        triggerData: triggerPayload,
        status: 'running',
        startedAt: timestamp,
    });

    const context: ExecutionContext = {
        schoolId: triggerPayload.schoolId,
        payload: triggerPayload,
        automationId: automation.id,
        runId: runRef.id
    };

    try {
        // 2. Locate Entry Node (Trigger)
        const triggerNode = automation.nodes.find(n => n.type === 'triggerNode');
        if (!triggerNode) throw new Error("Entry point not found in blueprint.");

        // 3. Begin Path Traversal
        await traverseNodes(triggerNode.id, automation, context);

        // 4. Mark Success
        await runRef.update({
            status: 'completed',
            finishedAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error(`>>> [LOGIC:RUN] Execution Failed [${automation.name}]:`, error.message);
        await runRef.update({
            status: 'failed',
            finishedAt: new Date().toISOString(),
            error: error.message
        });
    }
}

/**
 * Path Traversal: Recursive function to follow edges and execute node logic.
 */
async function traverseNodes(nodeId: string, automation: Automation, context: ExecutionContext) {
    const outgoingEdges = automation.edges.filter(e => e.source === nodeId);
    
    for (const edge of outgoingEdges) {
        const nextNode = automation.nodes.find(n => n.id === edge.target);
        if (!nextNode) continue;

        console.log(`>>> [LOGIC:STEP] Moving to Node: ${nextNode.data?.label || nextNode.type}`);

        try {
            if (nextNode.type === 'actionNode') {
                await processActionNode(nextNode, context);
            }
            
            // Continue recursion down the path
            await traverseNodes(nextNode.id, automation, context);
        } catch (e: any) {
            // Log node-specific failure but allow engine to handle cleanup
            throw new Error(`Node [${nextNode.data?.label || nextNode.id}] failed: ${e.message}`);
        }
    }
}

/**
 * Action Handler: Executes the functional logic for a specific action node.
 */
async function processActionNode(node: any, context: ExecutionContext) {
    const actionType = node.data?.actionType;
    const config = node.data?.config || {};

    if (!actionType) {
        console.warn(`>>> [LOGIC:ACTION] Skipping node ${node.id} - No action type defined.`);
        return;
    }

    // Resolve variables in config strings
    const resolvedConfig = resolveConfigVariables(config, context.payload);

    switch (actionType) {
        case 'SEND_MESSAGE':
            await handleSendMessage(resolvedConfig, context);
            break;
        case 'CREATE_TASK':
            await handleCreateTask(resolvedConfig, context);
            break;
        case 'UPDATE_SCHOOL':
            await handleUpdateSchool(resolvedConfig, context);
            break;
        default:
            console.warn(`>>> [LOGIC:ACTION] Unsupported action type: ${actionType}`);
    }
}

/**
 * Variable Resolver: Injects trigger payload data into action parameters.
 */
function resolveConfigVariables(config: any, payload: Record<string, any>): any {
    const json = JSON.stringify(config);
    const resolved = json.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const cleanKey = key.trim();
        return payload[cleanKey] !== undefined ? String(payload[cleanKey]) : match;
    });
    return JSON.parse(resolved);
}

// --- Specific Action Handlers ---

async function handleSendMessage(config: any, context: ExecutionContext) {
    if (!config.templateId) throw new Error("Message action missing templateId.");
    
    await sendMessage({
        templateId: config.templateId,
        senderProfileId: config.senderProfileId || 'default',
        recipient: config.recipient, // Expecting a resolved email or phone
        variables: { ...context.payload },
        schoolId: context.schoolId
    });
}

async function handleCreateTask(config: any, context: ExecutionContext) {
    const dueDate = addDays(new Date(), config.dueOffsetDays || 3).toISOString();
    
    // Note: Since we are on server, we use a slightly different pattern for tasks
    await adminDb.collection('tasks').add({
        title: config.title || 'Automated Task',
        description: config.description || 'Generated by protocol engine.',
        priority: (config.priority || 'medium') as TaskPriority,
        status: 'todo' as TaskStatus,
        category: (config.category || 'general') as TaskCategory,
        schoolId: context.schoolId || null,
        schoolName: context.payload.schoolName || null,
        assignedTo: config.assignedTo || context.payload.assignedTo?.userId || '',
        dueDate,
        source: 'automation',
        automationId: context.automationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminders: [],
        reminderSent: false
    });
}

async function handleUpdateSchool(config: any, context: ExecutionContext) {
    if (!context.schoolId) throw new Error("Cannot update school: Context missing schoolId.");
    
    await adminDb.collection('schools').doc(context.schoolId).update({
        ...config.updates,
        updatedAt: new Date().toISOString()
    });
}
