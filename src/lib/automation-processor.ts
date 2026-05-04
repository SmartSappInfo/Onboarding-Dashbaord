
'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Automation, AutomationRun, AutomationTrigger, School, MessageTemplate, SenderProfile, TaskCategory, TaskPriority, AutomationJob, EntityType } from './types';
import { sendMessage } from './messaging-engine';
import { createTaskNonBlocking } from './task-actions';
import { addDays } from 'date-fns';
import { logActivity } from './activity-logger';
import { resolveContact } from './contact-adapter';
import { evaluateTagCondition } from './tag-condition';

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
            
            // 1. Filter by workspaceId (Requirement 10.2)
            if (automation.workspaceIds && automation.workspaceIds.length > 0) {
                if (!automation.workspaceIds.includes(payload.workspaceId)) {
                    console.log(`>>> [LOGIC:PROCESSOR] Skipping automation [${automation.name}] - workspace mismatch`);
                    continue;
                }
            }

            // 2. Filter by Trigger Config (Requirement 4.1.1)
            // Specialized filtering for Tag-based triggers
            if (trigger === 'TAG_ADDED' || trigger === 'TAG_REMOVED') {
                if (!evaluateTriggerConfig(automation, payload)) {
                    console.log(`>>> [LOGIC:PROCESSOR] Skipping automation [${automation.name}] - trigger config mismatch`);
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
 * Filter logic for specialized triggers.
 */
function evaluateTriggerConfig(automation: Automation, payload: Record<string, any>): boolean {
    const triggerNode = automation.nodes.find(n => n.type === 'triggerNode');
    if (!triggerNode || !triggerNode.data?.config) return true; // Default to allow if no config

    const config = triggerNode.data.config;

    // Tag filtering
    if (automation.trigger === 'TAG_ADDED' || automation.trigger === 'TAG_REMOVED') {
        // Filter by Tag IDs
        if (config.tagIds && config.tagIds.length > 0) {
            if (!config.tagIds.includes(payload.tagId)) return false;
        }

        // Filter by Contact Type
        if (config.contactType && config.contactType !== payload.contactType) return false;

        // Filter by Application Method
        if (config.appliedBy) {
            const isAutomatic = payload.appliedBy === 'automation' || (payload.appliedBy && payload.appliedBy.startsWith('system'));
            if (config.appliedBy === 'manual' && isAutomatic) return false;
            if (config.appliedBy === 'automatic' && !isAutomatic) return false;
        }
    }

    return true;
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
 * Trigger an explicit automation by ID directly.
 * Useful for manual workflows or specific bulk actions.
 */
export async function runAutomationById(automationId: string, triggerPayload: Record<string, any>) {
    try {
        const autoDoc = await adminDb.collection('automations').doc(automationId).get();
        if (!autoDoc.exists) return;
        
        const automation = { id: autoDoc.id, ...autoDoc.data() } as Automation;
        if (!automation.isActive) return;

        await executeAutomation(automation, triggerPayload);
    } catch (error: any) {
        console.error(`>>> [LOGIC:PROCESSOR] Failed to run manual automation ${automationId}:`, error.message);
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
    } else if (currentNode.type === 'tagConditionNode') {
        const isTrue = await evaluateTagConditionNode(currentNode, context);
        const targetHandle = isTrue ? 'true' : 'false';
        
        // Filter edges to only follow the matching branch
        outgoingEdges = outgoingEdges.filter(e => e.sourceHandle === targetHandle);
        console.log(`>>> [LOGIC:BRANCH] Tag Condition [${currentNode.data.label}] evaluated to: ${isTrue}`);
    }

    for (const edge of outgoingEdges) {
        const nextNode = automation.nodes.find(n => n.id === edge.target);
        if (!nextNode) continue;

        console.log(`>>> [LOGIC:STEP] Moving to Node: ${nextNode.data?.label || nextNode.type}`);

        try {
            if (nextNode.type === 'actionNode') {
                await processActionNode(nextNode, context);
            } else if (nextNode.type === 'tagActionNode') {
                await processTagActionNode(nextNode, context);
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
        case 'CREATE_DEAL':
            await handleCreateDeal(resolvedConfig, context);
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
 * Evaluates a tag condition node against the current contact's tags.
 */
async function evaluateTagConditionNode(node: any, context: ExecutionContext): Promise<boolean> {
    // Resolve contact to get current tags
    const contact = await resolveContact(context.entityId!, context.workspaceId);
    if (!contact) return false;

    return evaluateTagCondition(contact.tags || [], node);
}

/**
 * High-fidelity action handler for tag-based operations.
 */
async function processTagActionNode(node: any, context: ExecutionContext) {
    const { action, tagIds } = node.data || {};
    if (!action || !tagIds || tagIds.length === 0) return;

    const contact = await resolveContact(context.entityId!, context.workspaceId);
    if (!contact) throw new Error("Tag action failed: Contact not found.");

    const batch = adminDb.batch();
    const timestamp = new Date().toISOString();

    // Determine target documents based on migration status
    // Workspace Tags (operational)
    if (contact.workspaceEntityId) {
        const weRef = adminDb.collection('workspace_entities').doc(contact.workspaceEntityId);
        if (action === 'add_tags') {
            batch.update(weRef, { 
                workspaceTags: FieldValue.arrayUnion(...tagIds),
                updatedAt: timestamp
            });
        } else if (action === 'remove_tags') {
            batch.update(weRef, { 
                workspaceTags: FieldValue.arrayRemove(...tagIds),
                updatedAt: timestamp
            });
        }
    }

    // Also update legacy schools/prospects if still in dual-write or legacy
    const schoolRef = adminDb.collection('schools').doc(contact.id);
    const prospectRef = adminDb.collection('prospects').doc(contact.id);
    
    // We try both as we don't know the type for sure without re-fetching, 
    // but resolveContact usually handles the type mapping.
    // Actually, ResolvedContact should indicate type.
    const legacyRef = contact.entityType === 'institution' ? schoolRef : prospectRef;

    if (action === 'add_tags') {
        batch.update(legacyRef, { 
            tags: FieldValue.arrayUnion(...tagIds),
            updatedAt: timestamp
        });
    } else if (action === 'remove_tags') {
        batch.update(legacyRef, { 
            tags: FieldValue.arrayRemove(...tagIds),
            updatedAt: timestamp
        });
    }

    await batch.commit();
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
    // Task 15.1: Support both legacy templateId and new category/type approach
    if (!config.templateId && (!config.templateCategory || !config.templateType)) {
        throw new Error("Message action missing template configuration (templateId or category/type).");
    }
    
    // Resolve contact using entityId (Requirement 14.3)
    const contactId = context.entityId;
    let resolvedRecipient = config.recipient;
    
    if (contactId && !resolvedRecipient) {
        const contact = await resolveContact(contactId, context.workspaceId);
        // FER-01: Correctly resolve primary email from entityContacts
        const primaryEmail = contact?.entityContacts?.find(ec => ec.isPrimary)?.email;
        if (primaryEmail) {
            resolvedRecipient = primaryEmail;
        } else if (contact?.contacts?.[0]?.email) {
            // Fallback for extreme cases during migration
            resolvedRecipient = contact.contacts[0].email;
        }
    }
    
    // Task 15.1: Use new template resolution if category/type provided
    // Otherwise fall back to legacy templateId approach for backward compatibility
    if (config.templateCategory && config.templateType) {
        // Get organizationId from workspace
        const workspaceSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
        if (!workspaceSnap.exists) {
            throw new Error(`Workspace ${context.workspaceId} not found`);
        }
        const organizationId = workspaceSnap.data()!.organizationId;
        
        // Use resolveAndRender for new template system
        const { resolveAndRender } = await import('./template-resolver');
        const rendered = await resolveAndRender(
            config.templateCategory,
            config.templateType,
            organizationId,
            {
                entityId: context.entityId,
                workspaceId: context.workspaceId,
                extraVars: context.payload
            }
        );
        
        // Send message with rendered content
        await sendMessage({
            templateId: config.templateId || 'automation-generated',
            senderProfileId: config.senderProfileId || 'default',
            recipient: resolvedRecipient,
            variables: { ...context.payload },
            entityId: context.entityId,
            workspaceId: context.workspaceId,
            // Override with rendered content
            ...(rendered.subject && { subject: rendered.subject }),
            body: rendered.body
        });
    } else {
        // Legacy path: use templateId directly
        await sendMessage({
            templateId: config.templateId,
            senderProfileId: config.senderProfileId || 'default',
            recipient: resolvedRecipient, 
            variables: { ...context.payload },
            entityId: context.entityId,
            workspaceId: context.workspaceId
        });
    }
}

async function handleCreateTask(config: any, context: ExecutionContext) {
    const dueDate = addDays(new Date(), config.dueOffsetDays || 3).toISOString();
    
    // Use unified entityId
    const entityId = context.entityId;
    let entityName: string | null | undefined = context.payload.entityName || null;
    let entityType: 'institution' | 'family' | 'person' | null | undefined = context.entityType || null;
    
    if (entityId) {
        const contact = await resolveContact(entityId, context.workspaceId);
        if (contact) {
            entityName = contact.name;
            entityType = contact.entityType;
        }
    }
   
    // Set workspaceId on created task to match triggering workspace (Requirement 10.4)
    await adminDb.collection('tasks').add({
        title: config.title || 'Automated Task',
        description: config.description || 'Generated by protocol engine.',
        priority: (config.priority || 'medium') as any,
        status: 'todo' as any,
        category: (config.category || 'general') as any,
        workspaceId: context.workspaceId,
        entityId, 
        entityName,
        entityType,
        assignedTo: config.assignedTo === 'auto' ? (context.payload.assignedTo?.userId || '') : config.assignedTo,
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
    // Prefer entityId (Requirement 14.4)
    const contactId = context.entityId;
    if (!contactId) throw new Error("Cannot update contact: Context missing entityId.");
    
    // Use adapter to check migration status (Requirement 18)
    const contact = await resolveContact(contactId, context.workspaceId);
    
    if (contact && contact.entityId) {
        await adminDb.collection('entities').doc(contact.entityId).update({
            ...config.updates,
            updatedAt: new Date().toISOString()
        });
        
        if (contact.workspaceEntityId && (config.updates.pipelineId || config.updates.stageId || config.updates.assignedTo)) {
            const workspaceUpdates: any = {
                updatedAt: new Date().toISOString()
            };
            if (config.updates.pipelineId) workspaceUpdates.pipelineId = config.updates.pipelineId;
            if (config.updates.stageId) workspaceUpdates.stageId = config.updates.stageId;
            if (config.updates.assignedTo) workspaceUpdates.assignedTo = config.updates.assignedTo;
            
            await adminDb.collection('workspace_entities').doc(contact.workspaceEntityId).update(workspaceUpdates);
        }
    } else {
        throw new Error("Cannot update contact: Contact not found or invalid.");
    }
}

async function handleCreateDeal(config: any, context: ExecutionContext) {
    const { createDeal } = await import('../app/actions/deal-actions');
    
    let pipelineId = config.pipelineId;
    if (!pipelineId) {
        const pipelinesSnap = await adminDb.collection('pipelines')
            .where('workspaceId', '==', context.workspaceId)
            .limit(1)
            .get();
        if (!pipelinesSnap.empty) {
            pipelineId = pipelinesSnap.docs[0].id;
        } else {
            throw new Error("No pipeline found in workspace to create a deal.");
        }
    }

    const name = config.name || `${context.payload.entityName || context.payload.name || 'New'} Deal`;

    await createDeal({
        entityId: context.entityId!,
        workspaceId: context.workspaceId,
        organizationId: context.payload.organizationId || 'smartsapp-hq',
        pipelineId,
        name,
        value: config.value || 0,
        assignmentStrategy: config.assignmentStrategy || 'direct'
    });
}
