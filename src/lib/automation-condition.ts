type ConditionNodeLike = {
  data?: {
    config?: {
      field?: string;
      operator?: string;
      value?: unknown;
      emailTemplateId?: string;
      linkUrl?: string;
      relation?: 'and' | 'or' | 'AND' | 'OR';
      groups?: ConditionGroup[];
    };
  };
};

export interface ConditionItem {
  id: string;
  field: string;
  operator: string;
  value?: any;
  emailTemplateId?: string;
  linkUrl?: string;
  surveyId?: string;
  surveyFieldId?: string;
  pdfId?: string;
  pdfFieldId?: string;
  customFieldId?: string;
  pipelineId?: string;
  campaignId?: string;
  qrId?: string;
  shortPath?: string;
  pageId?: string;
  [key: string]: any;
}

export interface ConditionGroup {
  id: string;
  relation: 'and' | 'or' | 'AND' | 'OR';
  conditions: ConditionItem[];
}

/**
 * Evaluates a condition node against the current context payload.
 * Supports recursive nested groups and async saved audience lookup.
 */
export async function evaluateConditionNode(
  node: ConditionNodeLike,
  payload: Record<string, unknown>,
  resolveAudience?: (audienceId: string) => Promise<any>
): Promise<boolean> {
  const config = node.data?.config;
  if (!config) return false;

  // 1. Recursive evaluation of condition groups
  if (config.groups && Array.isArray(config.groups) && config.groups.length > 0) {
    const groupRelation = (config.relation || 'and').toLowerCase() as 'and' | 'or';
    
    // Evaluate each group in parallel
    const groupResults = await Promise.all(
      config.groups.map(async (group) => {
        const groupConditions = group.conditions || [];
        if (groupConditions.length === 0) return true; // Empty group matches

        const condRelation = (group.relation || 'and').toLowerCase() as 'and' | 'or';
        const condResults = await Promise.all(
          groupConditions.map((cond) => evaluateSingleCondition(cond, payload, resolveAudience))
        );

        if (condRelation === 'or') {
          return condResults.some((res) => res);
        } else {
          return condResults.every((res) => res);
        }
      })
    );

    if (groupRelation === 'or') {
      return groupResults.some((res) => res);
    } else {
      return groupResults.every((res) => res);
    }
  }

  // 2. Fallback to legacy single condition
  return evaluateSingleCondition(
    {
      id: 'legacy_node',
      field: config.field || '',
      operator: config.operator || '',
      value: config.value,
      emailTemplateId: config.emailTemplateId,
      linkUrl: config.linkUrl,
    },
    payload,
    resolveAudience
  );
}

/**
 * Evaluates a single condition rule against the context payload.
 */
/**
 * Helper to perform general value comparisons.
 */
function compareValues(actualValue: unknown, operator: string, comparisonValue: unknown): boolean {
  switch (operator) {
    case 'equals':
    case 'is':
      return String(actualValue ?? '') === String(comparisonValue ?? '');
    case 'not_equals':
    case 'is_not':
      return String(actualValue ?? '') !== String(comparisonValue ?? '');
    case 'contains':
      return String(actualValue ?? '')
        .toLowerCase()
        .includes(String(comparisonValue ?? '').toLowerCase());
    case 'not_contains':
      return !String(actualValue ?? '')
        .toLowerCase()
        .includes(String(comparisonValue ?? '').toLowerCase());
    case 'greater_than':
      return Number(actualValue ?? 0) > Number(comparisonValue ?? 0);
    case 'less_than':
      return Number(actualValue ?? 0) < Number(comparisonValue ?? 0);
    case 'is_empty':
      return actualValue === undefined || actualValue === null || actualValue === '';
    case 'is_not_empty':
      return actualValue !== undefined && actualValue !== null && actualValue !== '';
    default:
      return false;
  }
}

/**
 * Evaluates a single condition rule against the context payload.
 */
async function evaluateSingleCondition(
  cond: ConditionItem,
  payload: Record<string, unknown>,
  resolveAudience?: (audienceId: string) => Promise<any>
): Promise<boolean> {
  const { field, operator, value, emailTemplateId, linkUrl } = cond;
  if (!field || !operator) return false;

  // Case A: Saved Audience Condition (interoperable saved audience logic)
  if ((field === 'saved_audience' || field === 'audience') && resolveAudience) {
    const audienceId = String(value);
    try {
      const audienceData = await resolveAudience(audienceId);
      if (!audienceData) return false;

      // Map filters or groups to evaluation tree
      const targetGroups = audienceData.groups || [];
      const relation = audienceData.filterLogic || 'AND';

      // If audience has legacy flat filters but no groups, wrap them
      let groupsToEvaluate = targetGroups;
      if (groupsToEvaluate.length === 0 && audienceData.filters && audienceData.filters.length > 0) {
        groupsToEvaluate = [{
          id: 'audience_flat_group',
          relation: relation,
          conditions: audienceData.filters.map((f: any) => ({
            id: f.id,
            field: f.field,
            operator: f.operator,
            value: f.value,
          })),
        }];
      }

      const matchNode = { data: { config: { groups: groupsToEvaluate, relation } } };
      const isMatched = await evaluateConditionNode(matchNode, payload, resolveAudience);
      return operator === 'in_audience' ? isMatched : !isMatched;
    } catch (err) {
      console.error(`[evaluateSingleCondition] Failed resolving audience ${audienceId}:`, err);
      return false;
    }
  }

  // Case B: Tag checking logic
  if (field === 'tags' || field === 'tag') {
    const contactTags = (payload.tagIds || payload.tags || payload.workspaceTags || []) as string[];
    const checkTags = Array.isArray(value) ? value : (value ? [String(value)] : []);
    if (checkTags.length === 0) {
      if (operator === 'exists') return contactTags.length > 0;
      if (operator === 'not_exists') return contactTags.length === 0;
      return false;
    }
    if (operator === 'exists' || operator === 'any_of') {
      return checkTags.some((t) => contactTags.includes(t));
    }
    if (operator === 'not_exists' || operator === 'is_not' || operator === 'none_of') {
      return !checkTags.some((t) => contactTags.includes(t));
    }
    if (operator === 'all_of') {
      return checkTags.every((t) => contactTags.includes(t));
    }
  }

  // Case C: Email Opened / Link Clicked behavioral check
  if (operator === 'has_opened' || operator === 'email_opened') {
    const opened = (payload.openedEmails || []) as string[];
    return opened.includes(String(emailTemplateId || value));
  }

  if (operator === 'has_clicked' || operator === 'link_clicked') {
    const clicked = (payload.clickedLinks || {}) as Record<string, string[]>;
    const urls = clicked[String(emailTemplateId || value)] || [];
    if (!linkUrl) return urls.length > 0;
    return urls.includes(String(linkUrl));
  }

  // Email verification status
  if (field === 'emailVerified') {
    const verified = !!payload.emailVerified;
    const expected = String(value) === 'true';
    return operator === 'is' ? verified === expected : verified !== expected;
  }

  // Custom Fields (app_field)
  if (field === 'app_field') {
    const fieldId = cond.customFieldId || '';
    const actualValue = (payload.customFields as any)?.[fieldId] ??
                        payload[fieldId] ??
                        (payload.customFields as any)?.[cond.fieldName || ''] ??
                        payload[cond.fieldName || ''];
    return compareValues(actualValue, operator, value);
  }

  // Survey responses
  if (field === 'survey_field') {
    const surveyId = cond.surveyId || '';
    const questionId = cond.surveyFieldId || '';
    const responses = (payload.surveyResponses || {}) as Record<string, Record<string, any>>;
    const surveyAnswers = responses[surveyId] || {};
    const actualValue = surveyAnswers[questionId];

    if (operator === 'answered') {
      return actualValue !== undefined && actualValue !== null && actualValue !== '';
    }
    if (operator === 'not_answered') {
      return actualValue === undefined || actualValue === null || actualValue === '';
    }
    return compareValues(actualValue, operator, value);
  }

  // PDF form submission fields
  if (field === 'form_field') {
    const pdfId = cond.pdfId || '';
    const fieldId = cond.pdfFieldId || '';
    const submissions = (payload.pdfSubmissions || {}) as Record<string, Record<string, any>>;
    const pdfAnswers = submissions[pdfId] || {};
    const actualValue = pdfAnswers[fieldId];

    if (operator === 'submitted') {
      return actualValue !== undefined && actualValue !== null && actualValue !== '';
    }
    if (operator === 'not_submitted') {
      return actualValue === undefined || actualValue === null || actualValue === '';
    }
    return compareValues(actualValue, operator, value);
  }

  // Deals details
  if (field === 'deal_status' || field === 'deal_stage' || field === 'deal_owner' || field === 'deal_value') {
    const deals = (payload.deals || []) as Array<Record<string, any>>;
    if (deals.length === 0) return false;

    return deals.some((deal) => {
      if (field === 'deal_status') {
        const actual = deal.status;
        return operator === 'is' ? actual === value : actual !== value;
      }
      if (field === 'deal_stage') {
        const actual = deal.stageId || deal.stage;
        return operator === 'is' ? actual === value : actual !== value;
      }
      if (field === 'deal_owner') {
        const actual = deal.ownerId || deal.owner;
        return operator === 'is' ? actual === value : actual !== value;
      }
      if (field === 'deal_value') {
        const actual = Number(deal.value || 0);
        const expected = Number(value || 0);
        return compareValues(actual, operator, expected);
      }
      return false;
    });
  }

  // Campaign Actions (opened, clicked, replied, watched_video, watched_full_video)
  if (field === 'campaign_action') {
    const templateId = cond.emailTemplateId || cond.campaignId || String(value);

    if (operator === 'opened' || operator === 'not_opened') {
      const opened = (payload.openedEmails || payload.openedTemplates || []) as string[];
      const hasOpened = opened.includes(templateId);
      return operator === 'opened' ? hasOpened : !hasOpened;
    }
    if (operator === 'replied') {
      const replied = (payload.repliedEmails || payload.repliedTemplates || []) as string[];
      return replied.includes(templateId);
    }
    if (operator === 'clicked') {
      const clicked = (payload.clickedLinks || {}) as Record<string, string[]>;
      const urls = clicked[templateId] || [];
      if (!linkUrl) return urls.length > 0;
      return urls.includes(String(linkUrl));
    }
    if (operator === 'watched_video') {
      const watched = (payload.watchedVideos || []) as string[];
      return watched.includes(templateId);
    }
    if (operator === 'watched_full_video') {
      const watchedFull = (payload.watchedFullVideos || []) as string[];
      return watchedFull.includes(templateId);
    }
  }

  // Landing page actions
  if (field === 'landing_page_action') {
    const pageId = cond.pageId || String(value);
    const visited = (payload.visitedPages || []) as string[];

    if (operator === 'page_visited') {
      return visited.includes(pageId);
    }
    if (operator === 'page_not_visited') {
      return !visited.includes(pageId);
    }
    if (operator === 'page_submitted') {
      const submitted = (payload.submittedPageForms || []) as string[];
      return submitted.includes(pageId);
    }
  }

  // Scanned QR code
  if (field === 'scanned_qr') {
    const qrId = cond.qrId || String(value);
    const scanned = (payload.scannedQrs || []) as string[];
    const hasScanned = scanned.includes(qrId);
    return operator === 'has_scanned' ? hasScanned : !hasScanned;
  }

  // Short link scanned/visited
  if (field === 'short_link') {
    const shortPath = cond.shortPath || String(value);
    const visited = (payload.visitedShortlinks || []) as string[];
    const hasVisited = visited.includes(shortPath);
    return operator === 'has_visited' ? hasVisited : !hasVisited;
  }

  // Case D: General comparisons
  let actualValue = payload[field];
  if (field === 'primaryEmail') {
    actualValue = payload.primaryEmail ?? payload.email;
  } else if (field === 'displayName') {
    actualValue = payload.displayName ?? payload.name ?? `${payload.firstName || ''} ${payload.lastName || ''}`.trim();
  } else if (field === 'primaryPhone') {
    actualValue = payload.primaryPhone ?? payload.phone;
  }
  return compareValues(actualValue, operator, value);
}
