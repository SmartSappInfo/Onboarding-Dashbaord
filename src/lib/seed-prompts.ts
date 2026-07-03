import { adminDb } from './firebase-admin';
import type { GlobalPrompt, TenantPromptOverride } from './pms-types';

/**
 * Seeding prompts library for multi-tenant and multi-industry verticals.
 * Seeding covers:
 * - global_prompts (Backoffice library)
 * - prompts (Tenant industry overrides: SaaS, SchoolEnrollment, Law, Marketing, RealEstate, Consultancy)
 */
export async function seedDefaultPrompts(): Promise<{ success: boolean; seededCount: number; error?: string }> {
  try {
    const batch = adminDb.batch();
    const timestamp = new Date().toISOString();
    let seededCount = 0;

    // ─────────────────────────────────────────────────────────
    // 1. Seed Global Prompts (Baseline templates in Backoffice)
    // ─────────────────────────────────────────────────────────
    const globalPrompts: GlobalPrompt[] = [
      {
        id: 'summarizeEntityNotesFlow',
        title: 'CRM Interaction Summarizer',
        description: 'Standard summaries of interaction logs, client requests, and sentiment history.',
        category: 'crm',
        tags: ['notes', 'summarization', 'nlp'],
        systemPrompt: 'You are an expert CRM analyst. Analyze the following interaction note logs and provide an executive summary.',
        userPromptTemplate: 'Analyze notes for entity "{{entityName}}":\n\nNotes Log:\n{{notesContext}}\n\nProvide key Themes, Sentiment, and Action Items.',
        variables: ['entityName', 'notesContext'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.2,
        maxTokens: 500,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      },
      {
        id: 'generateEmailTemplateFlow',
        title: 'High-Fidelity Email Template Generator',
        description: 'Generates structured layouts and HTML emails with contextual variables.',
        category: 'emails',
        tags: ['email', 'copywriting', 'outreach'],
        systemPrompt: 'You are a professional email outreach copywriter. Generate HTML body layouts and subject lines.',
        userPromptTemplate: 'Write a transactional or marketing campaign outreach copy.\nInstructions: {{prompt}}\nCommunication channel: {{channel}}\nAllowed variables: {{availableVariables}}',
        variables: ['prompt', 'channel', 'availableVariables'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.7,
        maxTokens: 1200,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      },
      {
        id: 'generateScriptFlow',
        title: 'Conversational Call & Chat Copywriter',
        description: 'Generates short-form SMS or WhatsApp messages containing variable tags.',
        category: 'call_scripts',
        tags: ['sms', 'whatsapp', 'sales'],
        systemPrompt: 'You are a WhatsApp/SMS conversational interface copywriter. Generate short copy matching the tone requested.',
        userPromptTemplate: 'Draft a short-form message copy for {{channel}}.\nInstructions: {{prompt}}\nTone: {{tone}}\nAllowed merge tags: {{variables}}',
        variables: ['prompt', 'channel', 'tone', 'variables'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.6,
        maxTokens: 400,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      }
    ];

    for (const prompt of globalPrompts) {
      const ref = adminDb.collection('global_prompts').doc(prompt.id);
      batch.set(ref, prompt, { merge: true });
      seededCount++;
    }

    // ─────────────────────────────────────────────────────────
    // 2. Seed Tenant Prompt Overrides (Pre-configured per industry)
    // ─────────────────────────────────────────────────────────
    const tenantOverrides: TenantPromptOverride[] = [
      // SaaS Industry Overrides
      {
        id: 'saas-hq_global_summarizeEntityNotesFlow',
        parentPromptId: 'summarizeEntityNotesFlow',
        organizationId: 'saas-hq',
        workspaceId: '',
        flowName: 'summarizeEntityNotesFlow',
        title: 'SaaS Account Health Analyzer',
        description: 'SaaS specific notes summarizer focused on trial conversions, usage metrics, and churn indicators.',
        category: 'crm',
        tags: ['saas', 'onboarding', 'health'],
        systemPrompt: 'You are an expert SaaS Customer Success Manager. Analyze account logs for product feedback, feature requests, and renewal risks.',
        userPromptTemplate: 'Analyze onboarding notes for SaaS Account "{{entityName}}":\n\nNotes Context:\n{{notesContext}}\n\nFocus on identifying feature adoption requests, trial status, and any customer health indicators.',
        variables: ['entityName', 'notesContext'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.3,
        maxTokens: 600,
        status: 'production',
        isActive: true,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      },
      // School Enrollment (Admissions CRM) Overrides
      {
        id: 'school-hq_global_summarizeEntityNotesFlow',
        parentPromptId: 'summarizeEntityNotesFlow',
        organizationId: 'school-hq',
        workspaceId: '',
        flowName: 'summarizeEntityNotesFlow',
        title: 'Admissions Inquiry & Tour Analyzer',
        description: 'School enrollment notes summary tracking family tours, child grades, and enrollment intent.',
        category: 'crm',
        tags: ['education', 'admissions', 'enquiry'],
        systemPrompt: 'You are an Admissions Director. Review family interaction history, application check status, and school visit tour feedback.',
        userPromptTemplate: 'Analyze admissions notes for family "{{entityName}}":\n\nNotes History:\n{{notesContext}}\n\nProvide enrollment interest rating (high/med/low), document missing checklist items, and recommend next tour follow-ups.',
        variables: ['entityName', 'notesContext'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.2,
        maxTokens: 500,
        status: 'production',
        isActive: true,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      },
      // Law (Client/Matter) Overrides
      {
        id: 'law-hq_global_summarizeEntityNotesFlow',
        parentPromptId: 'summarizeEntityNotesFlow',
        organizationId: 'law-hq',
        workspaceId: '',
        flowName: 'summarizeEntityNotesFlow',
        title: 'Legal Case & Briefing Summary',
        description: 'Legal matter note processing highlighting court deadlines and pending pleadings.',
        category: 'crm',
        tags: ['legal', 'litigation', 'matters'],
        systemPrompt: 'You are a senior paralegal assistant. Summarize case logs, evidentiary collection progress, and deposition details.',
        userPromptTemplate: 'Analyze case logs for matter/client "{{entityName}}":\n\nNotes History:\n{{notesContext}}\n\nHighlight critical hearing dates, pending evidentiary filings, and immediate action items for the attorney.',
        variables: ['entityName', 'notesContext'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.1,
        maxTokens: 800,
        status: 'production',
        isActive: true,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      },
      // Marketing Industry Overrides
      {
        id: 'marketing-hq_global_summarizeEntityNotesFlow',
        parentPromptId: 'summarizeEntityNotesFlow',
        organizationId: 'marketing-hq',
        workspaceId: '',
        flowName: 'summarizeEntityNotesFlow',
        title: 'Creative Brief & Campaign Feedback Tracker',
        description: 'Marketing agency summarizer targeting project edits, design signoffs, and ad performance comments.',
        category: 'crm',
        tags: ['marketing', 'campaigns', 'deliverables'],
        systemPrompt: 'You are a Creative Director. Analyze client feedback notes and media campaign comments.',
        userPromptTemplate: 'Analyze comments for marketing client "{{entityName}}":\n\nNotes History:\n{{notesContext}}\n\nCollate graphic revision requests, approved copywriting taglines, and budget cap changes.',
        variables: ['entityName', 'notesContext'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.4,
        maxTokens: 600,
        status: 'production',
        isActive: true,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      },
      // Real Estate Overrides
      {
        id: 'realestate-hq_global_summarizeEntityNotesFlow',
        parentPromptId: 'summarizeEntityNotesFlow',
        organizationId: 'realestate-hq',
        workspaceId: '',
        flowName: 'summarizeEntityNotesFlow',
        title: 'Property Viewing & Buyer Preference Digest',
        description: 'Real estate specific agent summarizing inspection comments and price bids.',
        category: 'crm',
        tags: ['real_estate', 'viewings', 'offers'],
        systemPrompt: 'You are a licensed Realtor. Summarize buyer comments, property viewings checklist, and negotiation parameters.',
        userPromptTemplate: 'Analyze tour feedback for client "{{entityName}}":\n\nNotes Log:\n{{notesContext}}\n\nFocus on identifying liked/disliked property features, bidding caps, and viewing requests.',
        variables: ['entityName', 'notesContext'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.3,
        maxTokens: 500,
        status: 'production',
        isActive: true,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      },
      // Consultancy Industry Overrides
      {
        id: 'consulting-hq_global_summarizeEntityNotesFlow',
        parentPromptId: 'summarizeEntityNotesFlow',
        organizationId: 'consulting-hq',
        workspaceId: '',
        flowName: 'summarizeEntityNotesFlow',
        title: 'Consultancy Discovery & Diagnostic brief',
        description: 'Summarizes organizational painpoints, stakeholder quotes, and milestone status.',
        category: 'crm',
        tags: ['consulting', 'discovery', 'strategy'],
        systemPrompt: 'You are a Principal Consultant. Review workshop discovery logs, client interviews, and team milestones.',
        userPromptTemplate: 'Review discovery notes for consulting engagement "{{entityName}}":\n\nNotes Log:\n{{notesContext}}\n\nCollate core bottleneck diagnoses, critical stakeholder quotes, and milestone blocks.',
        variables: ['entityName', 'notesContext'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.2,
        maxTokens: 700,
        status: 'production',
        isActive: true,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      },
      // Default Demo HQ (Bound to School Admissions since smartsapp-hq is education-focused)
      {
        id: 'smartsapp-hq_global_summarizeEntityNotesFlow',
        parentPromptId: 'summarizeEntityNotesFlow',
        organizationId: 'smartsapp-hq',
        workspaceId: '',
        flowName: 'summarizeEntityNotesFlow',
        title: 'Demo HQ Tour & Enrollment Summary',
        description: 'Standard admissions tracking override for demo organizations.',
        category: 'crm',
        tags: ['education', 'demo'],
        systemPrompt: 'You are an Admissions Director. Review family interaction logs, visit tours, and enrollment files.',
        userPromptTemplate: 'Analyze notes for parent/family "{{entityName}}":\n\nNotes History:\n{{notesContext}}\n\nProvide enrollment interest rating (high/med/low), document missing checklist items, and recommend next tour follow-ups.',
        variables: ['entityName', 'notesContext'],
        aiModels: ['googleai/gemini-2.0-flash'],
        temperature: 0.2,
        maxTokens: 500,
        status: 'production',
        isActive: true,
        version: 1,
        updatedAt: timestamp,
        updatedBy: 'system_seed_v4'
      }
    ];

    for (const override of tenantOverrides) {
      const ref = adminDb.collection('prompts').doc(override.id);
      batch.set(ref, override, { merge: true });
      seededCount++;
    }

    await batch.commit();
    return { success: true, seededCount };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [PMS] Seeding Prompts Failed:', msg);
    return { success: false, seededCount: 0, error: msg };
  }
}
