/**
 * @fileoverview Scoring & Effort Performance Constants & Types
 * 
 * ARCHITECTURAL GUIDELINES:
 * Extracted to an isomorphic, non-'use server' module so that:
 * 1. Client and server code alike can import types and default rule definitions without triggering
 *    Next.js Turbopack invalid-use-server-value runtime errors ("A 'use server' file can only export async functions, found object").
 * 2. Strict typing is preserved across all consumers (Zero 'any', Zero 'unknown').
 */

// Types definition (strict TypeScript, no 'any')
export interface LeadScoreDoc {
  id: string;          // Maps to contactId
  contactId: string;   
  currentScore: number;
}

export interface LeadScoreHistoryDoc {
  id: string;          
  contactId: string;   
  oldScore: number;    
  newScore: number;    
  change: number;      
  reason: string;      
  source: 'user' | 'automation' | 'system';
  actorId: string;     
  actorType: 'User' | 'Automation' | 'API' | 'System';
  createdAt: string;   
}

export interface EffortRuleDoc {
  id: string;          // Maps to workspaceId_eventType
  workspaceId: string;
  organizationId: string;
  eventType: string;   
  entityType: string;  
  points: number;      
  enabled: boolean;    
  description: string; 
}

export interface EffortEventDoc {
  id: string;          
  workspaceId?: string;
  organizationId?: string;
  eventType: string;   
  entityType: string;  
  entityId: string;    
  actorType: 'User' | 'Automation' | 'API' | 'System';
  actorId: string;     
  points: number;      
  isMachine?: boolean;
  metadata: Record<string, string | number | boolean>;
  idempotencyKey?: string;
  createdAt: string;   
}

export interface UserEffortSummaryDoc {
  id: string;          // Maps to userId or `${workspaceId}_${userId}`
  userId: string;
  workspaceId?: string;
  organizationId?: string;
  totalPoints: number;
  meetings: number;    
  calls: number;       
  tasks: number;       
  deals: number;       
  campaigns: number;   
  lastUpdated: string; 
}

export interface UserProfileEffort extends UserEffortSummaryDoc {
  userName: string;
  userEmail: string;
  photoURL?: string;
}

export interface ScoringEvent {
  organizationId: string;
  workspaceId: string;
  eventType: string;   
  entityType: string;  
  entityId: string;    
  contactId?: string;  
  actorType: 'User' | 'Automation' | 'API' | 'System';
  actorId: string;     
  durationSeconds?: number;
  metadata?: Record<string, string | number | boolean>;
}

// Defaults list
export const DEFAULT_EFFORT_RULES: Omit<EffortRuleDoc, 'id' | 'workspaceId' | 'organizationId'>[] = [
  // CRM
  { eventType: 'lead_created', entityType: 'Lead', points: 5, enabled: true, description: 'Points awarded when a new lead/prospect is created.' },
  { eventType: 'lead_assigned', entityType: 'Lead', points: 2, enabled: true, description: 'Points awarded when a lead is assigned to a user.' },
  { eventType: 'lead_updated', entityType: 'Lead', points: 1, enabled: true, description: 'Points awarded when a lead profile is updated.' },
  { eventType: 'lead_merged', entityType: 'Lead', points: 5, enabled: true, description: 'Points awarded when duplicate leads are merged.' },
  { eventType: 'lead_converted', entityType: 'Lead', points: 20, enabled: true, description: 'Points awarded when a lead is converted into a client.' },
  { eventType: 'lead_archived', entityType: 'Lead', points: 0, enabled: false, description: 'Points awarded when a lead is archived.' },

  // Communication
  { eventType: 'email_sent', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when an email is sent.' },
  { eventType: 'email_replied', entityType: 'Contact', points: 5, enabled: true, description: 'Points awarded when an email reply is received.' },
  { eventType: 'sms_sent', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when an SMS is sent.' },
  { eventType: 'whatsapp_sent', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when a WhatsApp message is sent.' },
  { eventType: 'phone_call_started', entityType: 'Contact', points: 1, enabled: true, description: 'Points awarded when an outbound phone call starts.' },
  { eventType: 'phone_call_completed', entityType: 'Contact', points: 10, enabled: true, description: 'Points awarded when a phone call is completed.' },
  { eventType: 'phone_call_connected', entityType: 'Contact', points: 5, enabled: true, description: 'Points awarded when a phone call connects with a contact.' },
  { eventType: 'call_recording_saved', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when a call recording is saved.' },
  { eventType: 'voicemail_left', entityType: 'Contact', points: 3, enabled: true, description: 'Points awarded when a voicemail is left.' },

  // Meetings
  { eventType: 'meeting_scheduled', entityType: 'Meeting', points: 5, enabled: true, description: 'Points awarded when a meeting is scheduled.' },
  { eventType: 'meeting_rescheduled', entityType: 'Meeting', points: 2, enabled: true, description: 'Points awarded when a meeting is rescheduled.' },
  { eventType: 'meeting_completed', entityType: 'Meeting', points: 25, enabled: true, description: 'Points awarded when a meeting is successfully completed.' },
  { eventType: 'meeting_cancelled', entityType: 'Meeting', points: 0, enabled: false, description: 'Points awarded when a meeting is cancelled.' },
  { eventType: 'meeting_attended', entityType: 'Meeting', points: 20, enabled: true, description: 'Points awarded when a contact attends a meeting.' },
  { eventType: 'meeting_notes_added', entityType: 'Meeting', points: 3, enabled: true, description: 'Points awarded when meeting notes are recorded.' },

  // Tasks
  { eventType: 'task_created', entityType: 'Task', points: 1, enabled: true, description: 'Points awarded when a task is created.' },
  { eventType: 'task_completed', entityType: 'Task', points: 5, enabled: true, description: 'Points awarded when a task is completed.' },
  { eventType: 'task_reopened', entityType: 'Task', points: 0, enabled: false, description: 'Points awarded when a task is reopened.' },
  { eventType: 'checklist_completed', entityType: 'Task', points: 2, enabled: true, description: 'Points awarded when a sub-task checklist is completed.' },

  // Deals
  { eventType: 'deal_created', entityType: 'Deal', points: 10, enabled: true, description: 'Points awarded when a new sales deal is created.' },
  { eventType: 'deal_stage_changed', entityType: 'Deal', points: 5, enabled: true, description: 'Points awarded when a deal is progressed in the pipeline.' },
  { eventType: 'deal_won', entityType: 'Deal', points: 100, enabled: true, description: 'Points awarded when a deal is closed won.' },
  { eventType: 'deal_lost', entityType: 'Deal', points: 0, enabled: false, description: 'Points awarded when a deal is closed lost.' },

  // Documents
  { eventType: 'proposal_sent', entityType: 'Contact', points: 10, enabled: true, description: 'Points awarded when a proposal document is sent.' },
  { eventType: 'quote_sent', entityType: 'Contact', points: 5, enabled: true, description: 'Points awarded when a quote document is sent.' },
  { eventType: 'invoice_sent', entityType: 'Contact', points: 5, enabled: true, description: 'Points awarded when an invoice is sent.' },
  { eventType: 'form_sent', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when a signature form is sent.' },
  { eventType: 'form_signed', entityType: 'Contact', points: 15, enabled: true, description: 'Points awarded when a form is signed.' },
  { eventType: 'contract_signed', entityType: 'Contact', points: 30, enabled: true, description: 'Points awarded when a contract is signed.' },

  // Surveys
  { eventType: 'survey_sent', entityType: 'Survey', points: 3, enabled: true, description: 'Points awarded when a survey is sent.' },
  { eventType: 'survey_completed', entityType: 'Survey', points: 15, enabled: true, description: 'Points awarded when a survey is completed.' },

  // Notes
  { eventType: 'note_created', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when a note is logged.' },
  { eventType: 'comment_added', entityType: 'Contact', points: 1, enabled: true, description: 'Points awarded when a comment is added to a note.' },
  { eventType: 'attachment_uploaded', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when an attachment is uploaded.' },

  // System
  { eventType: 'automation_executed', entityType: 'Contact', points: 1, enabled: true, description: 'Points awarded when an automation workflow is executed.' },
  { eventType: 'webhook_triggered', entityType: 'Contact', points: 1, enabled: true, description: 'Points awarded when an external webhook is received.' },

  // Coaching & Practice Lab (Phase 5)
  { eventType: 'roleplay_completed', entityType: 'Coaching', points: 25, enabled: true, description: 'Points awarded when a seller completes an AI buyer practice lab simulation.' },
  { eventType: 'call_reviewed', entityType: 'Coaching', points: 15, enabled: true, description: 'Points awarded when a Gong-style call scorecard review is conducted.' },

  // Buyer & Deal Intelligence (Phase 6)
  { eventType: 'buyer_signal_actioned', entityType: 'BuyerSignal', points: 10, enabled: true, description: 'Points awarded when a seller actions or converts a high-intent buyer signal.' },
  { eventType: 'meeting_completed_with_brief', entityType: 'Meeting', points: 20, enabled: true, description: 'Points awarded when a meeting is conducted with pre-brief prep and post-meeting CRM intelligence sync.' },

  // Revenue Attribution & Predictive Forecasting (Phase 7)
  { eventType: 'forecast_category_committed', entityType: 'Deal', points: 15, enabled: true, description: 'Points awarded when an opportunity is rigorously inspected and promoted to Committed forecast category.' },
  { eventType: 'revenue_attribution_confirmed', entityType: 'Deal', points: 10, enabled: true, description: 'Points awarded when multi-touch revenue credit splits are confirmed and closed on a won deal.' },

  // Sales Orchestration & Governance (Phase 8)
  { eventType: 'sales_play_step_completed', entityType: 'SalesPlay', points: 10, enabled: true, description: 'Points awarded when a seller executes a governed Sales Play action step.' },
  { eventType: 'play_approval_resolved', entityType: 'SalesPlay', points: 15, enabled: true, description: 'Points awarded when a manager or admin resolves a human-in-the-loop approval gate.' },
  { eventType: 'escalated_sla_breach_remediated', entityType: 'SalesPlay', points: 20, enabled: true, description: 'Points awarded when an SLA breach incident is remediated within target window.' },

  // AI Sales Workforce (Phase 9)
  { eventType: 'ai_recommendation_accepted', entityType: 'AiRecommendation', points: 10, enabled: true, description: 'Points awarded when a seller executes an AI-recommended next best action.' },
  { eventType: 'ai_crm_hygiene_resolved', entityType: 'Deal', points: 15, enabled: true, description: 'Points awarded when a seller or manager reviews and resolves a CRM data hygiene anomaly.' },
  { eventType: 'ai_autonomous_action_approved', entityType: 'AiApproval', points: 10, enabled: true, description: 'Points awarded when a manager reviews and approves a sensitive AI action.' },

  // Advanced Revenue Operating System (Phase 10)
  { eventType: 'revenue_scenario_calibrated', entityType: 'RevenueScenario', points: 20, enabled: true, description: 'Points awarded when an executive or manager calibrates and saves a strategic revenue simulation.' },
  { eventType: 'strategic_capacity_plan_executed', entityType: 'CapacityPlan', points: 25, enabled: true, description: 'Points awarded when an executive enacts an AI capacity plan or strategic recommendation.' }
];
