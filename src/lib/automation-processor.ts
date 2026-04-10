
'use server';

import { adminDb } from './firebase-admin';
import type { Automation, AutomationRun, AutomationTrigger, School, MessageTemplate, SenderProfile, TaskCategory, TaskPriority, AutomationJob } from './types';
import { sendMessage } from './messaging-engine';
import { createTaskNonBlocking } from './task-actions';
import { addDays } from 'date-fns';
import { logActivity } from './activity-logger';
import { resolveContact } from './contact-adapter';

/**
 * @fileOverview The SmartSapp Logic Processor (Execution Engine).
 * 
 * SCHEDULING LOGIC (Automations):
 * Unlike the Composer which uses provider-level scheduling, Automation "Delay Nodes"
 * are queued in the 'automation_jobs' collection in Firestore. 
 * 
 * The 'processScheduledJobsAction' function acts as the "Heartbeat" that fires these
 * jobs. This heartbeat must be pulsed either manually from the UI or via a Cron job.
 * 
 * Updated to use the Contact Adapter Layer for backward compatibility (Requirement 18)
 */

interface ExecutionContext {
    entityId?: string;
    entityType?: 'institution' | 'family' | 'person'; // New field
    workspaceId: string;
    payload: Record<string, any>;
    automationId: string;
    runId: string;
}

/**
 * Orchestrator: Finds all active automations for a specific trigger and executes them.
 * Updated for workspace awareness (Requirement 10)
 */
export async function triggerAutomationProtocols(trigger: AutomationTrigger, payload: Record<string, any>) {
    console.log(`>>> [LOGIC:PROCESSOR] Detecting Trigger: ${trigger}`);

    try {
        // Ensure workspaceId is present in payload (Requirement 10.1)
        if (!payload.workspaceId) {
            console.warn(`>>> [LOGIC:PROCESSOR] Missing workspaceId in payload for trigger: ${trigger}`);
            return;
        }

        const automationsSnap = await adminDb.collection('automations')
            .where('trigger', '==', trigger)
            .where('isActive', '==', true)
            .get();

        if (automationsSnap.empty) return;

        for (const autoDoc of automationsSnap.docs) {
            const automation = { id: autoDoc.id, ...autoDoc.data() } as Automation;
            
            // Filter by workspaceId (Requirement 10.2)
            if (automation.workspaceIds && automation.workspaceIds.length > 0) {
                if (!automation.workspaceIds.includes(payload.workspaceId)) {
                    console.log(`>>> [LOGIC:PROCESSOR] Skipping automation [${automation.name}] - workspace mismatch`);
                    continue;
                }
            }
            
            await executeAutomation(automation, payload);
        }
    } catch (error: any) {
        console.error(`>>> [LOGIC:PROCESSOR] Failed to poll automations:`, error.message);
    }
}

/**
 * Heartbeat: Scans for and executes pending delayed jobs.
 * Intended to be called by a 1-minute Cron job (e.g., Google Cloud Scheduler).
 */
export async function processScheduledJobsAction() {
    console.log(`>>> [LOGIC:HEARTBEAT] Scanning for pending protocols...`);
    const now = new Date().toISOString();
    
    try {
        const jobsSnap = await adminDb.collection('automation_jobs')
            .where('status', '==', 'pending')
            .where('executeAt', '<=', now)
            .limit(20)
            .get();

        if (jobsSnap.empty) return { success: true, processed: 0 };

        let processedCount = 0;
        for (const jobDoc of jobsSnap.docs) {
            const job = { id: jobDoc.id, ...jobDoc.data() } as AutomationJob;
            
            // 1. Mark as processing to prevent race conditions
            await jobDoc.ref.update({ status: 'processing' });

            // 2. Resume Workflow
            const success = await resumeAutomationRun(job);
            
            // 3. Finalize Job
            await jobDoc.ref.update({ 
                status: success ? 'completed' : 'failed'
            });
            processedCount++;
        }

        return { success: true, processed: processedCount };
    } catch (error: any) {
        console.error(`>>> [LOGIC:HEARTBEAT] CRITICAL FAILURE:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Resumption Logic: Restores state and continues path traversal from a delay checkpoint.
 */
async function resumeAutomationRun(job: AutomationJob) {
    try {
        const [autoSnap, runSnap] = await Promise.all([
            adminDb.collection('automations').doc(job.automationId).get(),
            adminDb.collection('automation_runs').doc(job.runId).get()
        ]);

        if (!autoSnap.exists || !runSnap.exists) {
            throw new Error("Blueprint or Run trace missing during resumption.");
        }

        const automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;
        const runData = runSnap.data();

        const context: ExecutionContext = {
            entityId: job.payload.entityId,
            entityType: job.payload.entityType, // Support entityType in resumed jobs
            workspaceId: job.payload.workspaceId,
            payload: job.payload,
            automationId: job.automationId,
            runId: job.runId
        };

        console.log(`>>> [LOGIC:RESUME] Waking protocol [${automation.name}] at node: ${job.targetNodeId}`);

        // Continue traversal from the next nodes connected to the delay node
        await traverseNodes(job.targetNodeId, automation, context);
        return true;
    } catch (e: any) {
        console.error(`>>> [LOGIC:RESUME] Failed:`, e.message);
        return false;
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
        entityId: triggerPayload.entityId,
        entityType: triggerPayload.entityType, // Support entityType in triggers
        workspaceId: triggerPayload.workspaceId,
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

        // 4. Mark Success (Unless jobs are pending)
        const activeJobs = await adminDb.collection('automation_jobs')
            .where('runId', '==', runRef.id)
            .where('status', '==', 'pending')
            .get();

        if (activeJobs.empty) {
            await runRef.update({
                status: 'completed',
                finishedAt: new Date().toISOString()
            });
        } else {
            console.log(`>>> [LOGIC:RUN] Paused for pending jobs.`);
        }

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
    const currentNode = automation.nodes.find(n => n.id === nodeId);
    if (!currentNode) return;

    let outgoingEdges = automation.edges.filter(e => e.source === nodeId);
    
    // LOGIC NODE SPECIAL HANDLING
    if (currentNode.type === 'conditionNode') {
        const isTrue = evaluateConditionNode(currentNode, context.payload);
        const targetHandle = isTrue ? 'true' : 'false';
        
        // Filter edges to only follow the matching branch
        outgoingEdges = outgoingEdges.filter(e => e.sourceHandle === targetHandle);
        console.log(`>>> [LOGIC:BRANCH] Condition [${currentNode.data.label}] evaluated to: ${isTrue}`);
    }

    for (const edge of outgoingEdges) {
        const nextNode = automation.nodes.find(n => n.id === edge.target);
        if (!nextNode) continue;

        console.log(`>>> [LOGIC:STEP] Moving to Node: ${nextNode.data?.label || nextNode.type}`);

        try {
            if (nextNode.type === 'actionNode') {
                await processActionNode(nextNode, context);
            } else if (nextNode.type === 'delayNode') {
                await handleDelayNode(nextNode, context);
                // Delays stop linear execution. Resumption will pick up from HERE (nextNode.id).
                return; 
            }
            
            // Continue recursion down the path
            await traverseNodes(nextNode.id, automation, context);
        } catch (e: any) {
            throw new Error(`Node [${nextNode.data?.label || nextNode.id}] failed: ${e.message}`);
        }
    }
}

/**
 * Evaluates a condition node against the current context payload.
 */
function evaluateConditionNode(node: any, payload: Record<string, any>): boolean {
    const { field, operator, value } = node.data?.config || {};
    if (!field || !operator) return false;

    const actualValue = payload[field];
    const comparisonValue = value;

    switch (operator) {
        case 'equals': return String(actualValue) === String(comparisonValue);
        case 'not_equals': return String(actualValue) !== String(comparisonValue);
        case 'contains': return String(actualValue).toLowerCase().includes(String(comparisonValue).toLowerCase());
        case 'greater_than': return Number(actualValue) > Number(comparisonValue);
        case 'less_than': return Number(actualValue) < Number(comparisonValue);
        default: return false;
    }
}

/**
 * Action Handler: Executes the functional logic for a specific action node.
 */
async function processActionNode(node: any, context: ExecutionContext) {
    const actionType = node.data?.actionType;
    const config = node.data?.config || {};

    if (!actionType) return;

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

/**
 * Delay Infrastructure: Queues a job for future execution.
 */
async function handleDelayNode(node: any, context: ExecutionContext) {
    const { value, unit } = node.data?.config || { value: 5, unit: 'Minutes' };
    
    let executeAt = new Date();
    if (unit === 'Minutes') executeAt.setMinutes(executeAt.getMinutes() + value);
    else if (unit === 'Hours') executeAt.setHours(executeAt.getHours() + value);
    else if (unit === 'Days') executeAt.setDate(executeAt.getDate() + value);

    await adminDb.collection('automation_jobs').add({
        automationId: context.automationId,
        runId: context.runId,
        targetNodeId: node.id,
        payload: context.payload,
        executeAt: executeAt.toISOString(),
        status: 'pending'
    });

    console.log(`>>> [LOGIC:DELAY] Pausing flow. Resuming at ${executeAt.toISOString()}`);
}

// --- Specific Action Handlers ---

async function handleSendMessage(config: any, context: ExecutionContext) {
    if (!config.templateId) throw new Error("Message action missing templateId.");
    
    // Resolve contact using entityId (Requirement 14.3)
    const contactId = context.entityId;
    let resolvedRecipient = config.recipient;
    
    if (contactId && !resolvedRecipient) {
        const contact = await resolveContact(contactId, context.workspaceId);
        if (contact?.contacts?.[0]?.email) {
            resolvedRecipient = contact.contacts[0].email;
        }
    }
    
    await sendMessage({
        templateId: config.templateId,
        senderProfileId: config.senderProfileId || 'default',
        recipient: resolvedRecipient, 
        variables: { ...context.payload },
        entityId: context.entityId,
        workspaceId: context.workspaceId // Pass workspace context (Requirement 11)
    });
}

async function handleCreateTask(config: any, context: ExecutionContext) {
    const dueDate = addDays(new Date(), config.dueOffsetDays || 3).toISOString();
    
    // Prefer entityId
    let entityId: string | null | undefined = context.entityId || null;
    let entityName: string | null | undefined = context.payload.entityName || null;
    let entityType: 'institution' | 'family' | 'person' | null | undefined = context.entityType || null;
    
    // If we have entityId, use it as primary identifier
    if (entityId) {
        const contact = await resolveContact(entityId, context.workspaceId);
        if (contact) {
            entityName = contact.name;
            // Populate entityId for backward compatibility if available
            if (contact.schoolData?.id) {
                entityId = contact.schoolData.id;
            }
        }
    } else if (entityId) {
        // Fallback: resolve from entityId
        const contact = await resolveContact(entityId, context.workspaceId);
        if (contact) {
            entityName = contact.name;
            entityId = contact.entityId;
            entityType = contact.entityType;
        }
    }
    
    // Set workspaceId on created task to match triggering workspace (Requirement 10.4)
    // Populate both entityId and entityId (dual-write pattern, Requirement 14.2)
    await adminDb.collection('tasks').add({
        title: config.title || 'Automated Task',
        description: config.description || 'Generated by protocol engine.',
        priority: (config.priority || 'medium') as any,
        status: 'todo' as any,
        category: (config.category || 'general') as any,
        workspaceId: context.workspaceId, // Requirement 10.4
        entityId, // Dual-write: new field
        entityName, // Dual-write: legacy field
        entityType, // Dual-write: new field
        assignedTo: config.assignedTo === 'auto' ? (context.payload.assignedTo?.userId || '') : config.assignedTo,
        dueDate,
        source: 'automation', // Requirement 14.2: Set source to 'automation'
        automationId: context.automationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminders: [],
        reminderSent: false
    });
}

async function handleUpdateSchool(config: any, context: ExecutionContext) {
    // Prefer entityId (Requirement 14.4)
    const contactId = context.entityId;
    if (!contactId) throw new Error("Cannot update contact: Context missing entityId.");
    
    // Use adapter to check migration status (Requirement 18)
    const contact = await resolveContact(contactId, context.workspaceId);
    
    if (contact && contact.migrationStatus === 'migrated' && contact.entityId) {
        // Update entity instead of school (Requirement 14.4)
        await adminDb.collection('entities').doc(contact.entityId).update({
            ...config.updates,
            updatedAt: new Date().toISOString()
        });
        
        // Also update workspace_entities if workspace-specific fields
        if (contact.workspaceEntityId && (config.updates.pipelineId || config.updates.stageId || config.updates.assignedTo)) {
            const workspaceUpdates: any = {
                updatedAt: new Date().toISOString()
            };
            if (config.updates.pipelineId) workspaceUpdates.pipelineId = config.updates.pipelineId;
            if (config.updates.stageId) workspaceUpdates.stageId = config.updates.stageId;
            if (config.updates.assignedTo) workspaceUpdates.assignedTo = config.updates.assignedTo;
            
            await adminDb.collection('workspace_entities').doc(contact.workspaceEntityId).update(workspaceUpdates);
        }
    } else if (contact?.schoolData?.id) {
        // Update legacy school document
        await adminDb.collection('schools').doc(contact.schoolData.id).update({
            ...config.updates,
            updatedAt: new Date().toISOString()
        });
    } else {
        throw new Error("Cannot update contact: Contact not found or invalid.");
    }
}
