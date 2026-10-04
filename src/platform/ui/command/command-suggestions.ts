/**
 * @fileOverview Contextual Suggestion Engine for Global Command Bar
 *
 * Dynamically synthesizes high-leverage workspace suggestions and context-aware
 * shortcuts tailored to the active entity view or global operator surface.
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]` typing policy.
 * - Rule 7: Everyday, actionable UI language.
 * - Rule 54: High performance ($<10\text{ms}$ synthesis).
 */

import { type CommandSuggestion } from './command-types';

export interface CommandSuggestionsOptions {
  organizationId: string;
  workspaceId: string;
  contextEntityId?: string;
  contextEntityType?: string;
  query?: string;
}

const GLOBAL_DEFAULT_SUGGESTIONS: CommandSuggestion[] = [
  {
    id: 'sug_whats_going_on_greenfield',
    label: "What's going on with Greenfield School?",
    prompt: "What's going on with Greenfield School?",
    intent: 'ANALYZE',
    icon: 'Sparkles',
    badge: 'SIGNATURE',
  },
  {
    id: 'sug_find_deals_month',
    label: 'Find deals closing this month',
    prompt: 'Find all deals expected to close this month with value > $10,000',
    intent: 'SEARCH',
    icon: 'Search',
    badge: 'CRM',
  },
  {
    id: 'sug_analyze_pipeline',
    label: 'Analyze sales pipeline velocity',
    prompt: 'Analyze sales pipeline velocity and identify stalled deals',
    intent: 'ANALYZE',
    icon: 'TrendingUp',
    badge: 'Analytics',
  },
  {
    id: 'sug_create_task',
    label: 'Create follow-up task for today',
    prompt: 'Create high-priority follow-up task for today: Review Q4 commitments',
    intent: 'EXECUTE',
    icon: 'CheckSquare',
    badge: 'Actions',
  },
  {
    id: 'sug_delegate_research',
    label: 'Delegate competitor research to AI agent',
    prompt: 'Have Lead Researcher agent analyze key competitors and pricing models',
    intent: 'DELEGATE',
    icon: 'Bot',
    badge: 'Agents',
  },
  {
    id: 'sug_automate_intake',
    label: 'Automate new lead intake workflow',
    prompt: 'Automate inbound lead routing: assign to tier 1 reps and send intro note',
    intent: 'AUTOMATE',
    icon: 'Workflow',
    badge: 'Workflow',
  },
];

export function generateCommandSuggestions(
  options: CommandSuggestionsOptions
): CommandSuggestion[] {
  const { contextEntityId, contextEntityType, query } = options;

  let suggestions: CommandSuggestion[] = [];

  // 1. Entity-Specific Contextual Suggestions
  if (contextEntityId && contextEntityType) {
    const formattedType = contextEntityType.toLowerCase();
    suggestions = [
      {
        id: `sug_entity_summary_${contextEntityId}`,
        label: `Summarize all notes and history for this ${formattedType}`,
        prompt: `Summarize all recent meetings, notes, and activity for ${formattedType} ${contextEntityId}`,
        intent: 'ANALYZE',
        icon: 'FileText',
        badge: formattedType.toUpperCase(),
      },
      {
        id: `sug_entity_followup_${contextEntityId}`,
        label: `Draft personalized follow-up for this ${formattedType}`,
        prompt: `Draft follow-up email based on latest meeting for ${formattedType} ${contextEntityId}`,
        intent: 'EXECUTE',
        icon: 'Mail',
        badge: 'ACTION',
      },
      {
        id: `sug_entity_investigate_${contextEntityId}`,
        label: `Delegate deep research on this ${formattedType}`,
        prompt: `Delegate research agent to investigate sentiment and expansion opportunities for ${formattedType} ${contextEntityId}`,
        intent: 'DELEGATE',
        icon: 'Bot',
        badge: 'AGENT',
      },
      {
        id: `sug_entity_workflow_${contextEntityId}`,
        label: `Automate weekly status check for this ${formattedType}`,
        prompt: `Schedule weekly status check workflow for ${formattedType} ${contextEntityId}`,
        intent: 'AUTOMATE',
        icon: 'Workflow',
        badge: 'WORKFLOW',
      },
    ];
  } else {
    // 2. Global Default Suggestions
    suggestions = [...GLOBAL_DEFAULT_SUGGESTIONS];
  }

  // 3. Filter by query if user has started typing
  if (query && query.trim().length > 0) {
    const normalized = query.toLowerCase().trim();
    suggestions = suggestions.filter(
      (s) =>
        s.label.toLowerCase().includes(normalized) ||
        s.prompt.toLowerCase().includes(normalized) ||
        s.intent.toLowerCase().includes(normalized)
    );

    // If query matches an intent directly, prepend custom prompt suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        id: `sug_custom_${Date.now().toString(36)}`,
        label: `Run "${query.slice(0, 45)}${query.length > 45 ? '...' : ''}"`,
        prompt: query,
        intent: 'SEARCH',
        icon: 'Sparkles',
        badge: 'PROMPT',
      });
    }
  }

  return suggestions.slice(0, 6);
}
