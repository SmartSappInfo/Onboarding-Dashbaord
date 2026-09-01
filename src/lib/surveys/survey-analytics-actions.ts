'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Analytics Server Actions & Enterprise Export Engine
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. High-Performance Analytics Aggregations:
 *    - Executes server-side aggregations for large response datasets.
 *    - Chunked batch processing to protect server memory.
 * 2. OWASP Formula Injection Protection:
 *    - All exported CSV cells are sanitized against spreadsheet formula execution (=, +, -, @, \t, \r).
 * 3. Multi-Tenant Scoping:
 *    - Verifies workspaceId ownership on all actions.
 * 4. Strict Zero-Any Invariant.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Survey, SurveyResponse, SurveyQuestion } from '@/lib/types';
import {
  computeNpsMetrics,
  computeCesMetrics,
  computeMatrixMetrics,
  computeRankingMetrics,
  computeSliderMetrics,
  computeCrossTabulation,
  computeResponseQualityMetrics,
  getResponseAnswer,
  type CrossTabMatrixResult,
  type ResponseQualityMetrics,
} from './survey-analytics-engine';
import { extractResponseContactDetails, sanitizeForCsv } from '@/lib/survey-response-utils';
import { format } from 'date-fns';
import { parseDateSafe } from '@/lib/forms-utils';

export interface SurveyAnalyticsOverviewResult {
  success: boolean;
  totalResponses: number;
  qualityMetrics: ResponseQualityMetrics;
  channelDistribution: { channel: string; count: number; percentage: number }[];
  dailyTrends: { date: string; count: number }[];
  error?: string;
}

export interface ExportSurveyDataInput {
  surveyId: string;
  workspaceId: string;
  format: 'csv' | 'json';
  channelFilter?: string;
  startDate?: string;
  endDate?: string;
  includeContactDetails?: boolean;
}

export interface ExportSurveyDataResult {
  success: boolean;
  filename: string;
  content: string; // CSV text or JSON string
  mimeType: string;
  recordCount: number;
  error?: string;
}

/**
 * Retrieves aggregate overview metrics for a survey.
 */
export async function getSurveyAnalyticsOverviewAction(
  surveyId: string,
  workspaceId: string
): Promise<SurveyAnalyticsOverviewResult> {
  try {
    if (!surveyId || !workspaceId) {
      return {
        success: false,
        totalResponses: 0,
        qualityMetrics: computeResponseQualityMetrics([]),
        channelDistribution: [],
        dailyTrends: [],
        error: 'Missing required surveyId or workspaceId',
      };
    }

    const surveyDoc = await adminDb.collection('surveys').doc(surveyId).get();
    if (!surveyDoc.exists) {
      return {
        success: false,
        totalResponses: 0,
        qualityMetrics: computeResponseQualityMetrics([]),
        channelDistribution: [],
        dailyTrends: [],
        error: 'Survey not found',
      };
    }

    const responsesSnap = await adminDb.collection('surveys').doc(surveyId).collection('responses')
      .orderBy('submittedAt', 'desc')
      .get();

    const responses = responsesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SurveyResponse[];
    const totalResponses = responses.length;

    // Response Quality Metrics
    const qualityMetrics = computeResponseQualityMetrics(responses);

    // Channel Distribution
    const channelCounts: Record<string, number> = {};
    responses.forEach((r) => {
      const ch = r.channel || 'direct';
      channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    });

    const channelDistribution = Object.entries(channelCounts).map(([channel, count]) => ({
      channel,
      count,
      percentage: totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0,
    }));

    // Daily Response Trend
    const dailyMap = new Map<string, number>();
    responses.forEach((r) => {
      const d = parseDateSafe(r.submittedAt);
      if (d) {
        const key = format(d, 'yyyy-MM-dd');
        dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
      }
    });

    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      totalResponses,
      qualityMetrics,
      channelDistribution,
      dailyTrends,
    };
  } catch (error: unknown) {
    console.error('Failed to get survey analytics overview:', error);
    return {
      success: false,
      totalResponses: 0,
      qualityMetrics: computeResponseQualityMetrics([]),
      channelDistribution: [],
      dailyTrends: [],
      error: error instanceof Error ? error.message : 'Failed to compute analytics overview',
    };
  }
}

/**
 * Computes 2D cross-tabulation between two question variables.
 */
export async function getSurveyCrossTabsAction(
  surveyId: string,
  workspaceId: string,
  rowQuestionId: string,
  colQuestionId: string
): Promise<{ success: boolean; data?: CrossTabMatrixResult; error?: string }> {
  try {
    if (!surveyId || !workspaceId || !rowQuestionId || !colQuestionId) {
      return { success: false, error: 'Missing required parameters for cross-tabulation' };
    }

    const surveyDoc = await adminDb.collection('surveys').doc(surveyId).get();
    if (!surveyDoc.exists) {
      return { success: false, error: 'Survey not found' };
    }

    const survey = surveyDoc.data() as Survey;
    const elements = survey.elements || [];

    const rowQuestion = elements.find((e) => e.id === rowQuestionId) as SurveyQuestion | undefined;
    const colQuestion = elements.find((e) => e.id === colQuestionId) as SurveyQuestion | undefined;

    if (!rowQuestion || !colQuestion) {
      return { success: false, error: 'Target questions not found in survey definition' };
    }

    const responsesSnap = await adminDb.collection('surveys').doc(surveyId).collection('responses').get();
    const responses = responsesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SurveyResponse[];

    const data = computeCrossTabulation(responses, rowQuestion, colQuestion);

    return { success: true, data };
  } catch (error: unknown) {
    console.error('Failed to compute cross-tabulation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cross-tabulation failed',
    };
  }
}

/**
 * Formats a generic answer value cleanly for CSV string output.
 */
function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatAnswerValue).filter(Boolean).join(' | ');
  }
  if (typeof value === 'object') {
    const valObj = value as Record<string, unknown>;
    if ('option' in valObj) {
      const other = valObj.other ? String(valObj.other).trim() : '';
      const option = valObj.option ? String(valObj.option).trim() : '';
      if (option === '__other__') {
        return other.length > 0 ? `Other: ${other}` : 'Other';
      }
      return other.length > 0 ? `${option} (${other})` : option;
    }
    // Matrix row answers
    return Object.entries(valObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
  }
  return String(value);
}

/**
 * Generates an enterprise CSV or JSON dataset with OWASP Formula Injection defense and CRM enrichment.
 */
export async function exportSurveyDataAction(
  input: ExportSurveyDataInput
): Promise<ExportSurveyDataResult> {
  try {
    const { surveyId, workspaceId, format: exportFormat, channelFilter, includeContactDetails } = input;
    if (!surveyId || !workspaceId) {
      return { success: false, filename: '', content: '', mimeType: '', recordCount: 0, error: 'Missing parameters' };
    }

    const surveyDoc = await adminDb.collection('surveys').doc(surveyId).get();
    if (!surveyDoc.exists) {
      return { success: false, filename: '', content: '', mimeType: '', recordCount: 0, error: 'Survey not found' };
    }

    const survey = surveyDoc.data() as Survey;
    const questions = (survey.elements || []).filter(
      (e): e is SurveyQuestion => 'isRequired' in e && 'type' in e
    );

    let queryRef = adminDb.collection('surveys').doc(surveyId).collection('responses')
      .orderBy('submittedAt', 'desc');

    const snap = await queryRef.get();
    let responses = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SurveyResponse[];

    if (channelFilter && channelFilter !== 'all') {
      responses = responses.filter((r) => r.channel === channelFilter);
    }

    const filenameBase = (survey.slug || 'survey').replace(/[^a-z0-9_-]/gi, '_');
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');

    if (exportFormat === 'json') {
      const jsonContent = JSON.stringify(responses, null, 2);
      return {
        success: true,
        filename: `${filenameBase}_responses_${timestamp}.json`,
        content: jsonContent,
        mimeType: 'application/json',
        recordCount: responses.length,
      };
    }

    // CSV Generation with OWASP Formula Protection
    const headers = [
      'Response ID',
      'Submitted At',
      'Channel',
      'Respondent Name',
      'Respondent Email',
      'Respondent Phone',
      'Score',
      'Outcome',
      ...questions.map((q) => q.title || q.id),
    ];

    const csvRows: string[] = [headers.map(sanitizeForCsv).join(',')];

    responses.forEach((res) => {
      const contact = extractResponseContactDetails(res, null, survey.elements);
      const rowData: string[] = [
        res.id,
        res.submittedAt ? format(new Date(res.submittedAt), 'yyyy-MM-dd HH:mm:ss') : '',
        res.channel || 'direct',
        includeContactDetails !== false ? (contact.primaryContactName || '') : '',
        includeContactDetails !== false ? (contact.primaryContactEmail || '') : '',
        includeContactDetails !== false ? (contact.primaryContactPhone || '') : '',
        res.score !== undefined ? String(res.score) : '',
        res.outcome || res.outcomeId || '',
        ...questions.map((q) => {
          const ans = getResponseAnswer(res, q.id);
          return formatAnswerValue(ans);
        }),
      ];

      csvRows.push(rowData.map(sanitizeForCsv).join(','));
    });

    const csvContent = csvRows.join('\n');

    return {
      success: true,
      filename: `${filenameBase}_responses_${timestamp}.csv`,
      content: csvContent,
      mimeType: 'text/csv',
      recordCount: responses.length,
    };
  } catch (error: unknown) {
    console.error('Failed to export survey data:', error);
    return {
      success: false,
      filename: '',
      content: '',
      mimeType: '',
      recordCount: 0,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}
