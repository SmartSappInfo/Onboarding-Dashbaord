/**
 * Survey Analytics Utility Functions
 * 
 * Extracted from analytics-view.tsx to reduce component complexity,
 * improve testability, and leverage optimized data structures (Map/Set).
 * 
 * @see vercel-react-best-practices: js-index-maps, js-combine-iterations
 */

import type { Survey, SurveyResponse, SurveyQuestion, SurveyElement, SurveySession } from "@/lib/types";

// ─── Shared Constants ──────────────────────────────────────────────────────────

export const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
] as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ChartDataPoint = { name: string; value: number; percentage: number };

export type AnalyzedResult = {
    question: SurveyQuestion;
    insight: string;
    totalScore?: number;
    averageScore?: number;
} & (
    | { type: 'chart'; data: ChartDataPoint[]; total: number }
    | { type: 'rating'; data: ChartDataPoint[]; total: number; average: number }
    | { type: 'checkbox'; data: ChartDataPoint[]; otherText: string[]; total: number }
    | { type: 'text'; data: string[]; total: number }
    | { type: 'unknown'; data: any[] }
);

export type FunnelStep = {
    index: number;
    label: string;
    count: number;
    percentage: number;
    color: string;
};

export type DropoffInsight = {
    from: string;
    to: string;
    lost: number;
    lossPercentage: number;
};

export type ScoringMetrics = {
    avg: number;
    total: number;
    outcomeData: { name: string; value: number; color: string }[];
};

export type AttributionRow = {
    id: string;
    name: string;
    responses: number;
    leads: number;
    yield: number;
};

// ─── Type Guards ───────────────────────────────────────────────────────────────

export const isQuestion = (element: SurveyElement): element is SurveyQuestion =>
    'isRequired' in element;

// ─── Insight Generation ────────────────────────────────────────────────────────

export function generateInsight(result: AnalyzedResult): string {
    if (result.type === 'chart' && result.data.length > 0) {
        const sorted = [...result.data].sort((a, b) => b.value - a.value);
        const mostPopular = sorted[0];
        if (mostPopular.value === result.total && result.total > 0) return `All respondents selected "${mostPopular.name}".`;
        if (result.total > 0) return `The most common answer was "${mostPopular.name}".`;
    }
    if (result.type === 'rating' && result.total > 0) {
        if (result.average > 4) return `The average rating of ${result.average.toFixed(1)} stars indicates a highly positive response.`;
        if (result.average > 2.5) return `The average rating was ${result.average.toFixed(1)} stars.`;
        return `The average rating of ${result.average.toFixed(1)} stars indicates room for improvement.`;
    }
    if (result.type === 'checkbox' && result.data.length > 0) {
        const sorted = [...result.data].sort((a, b) => b.value - a.value);
        const mostPopular = sorted[0];
        if (mostPopular.percentage > 50) return `"${mostPopular.name}" was the most frequently selected option.`;
    }
    if (result.type === 'text' && result.total > 0) {
        return `Received ${result.total} text ${result.total === 1 ? 'response' : 'responses'}.`;
    }
    return '';
}

// ─── Funnel Aggregation ────────────────────────────────────────────────────────

export function computeFunnelData(survey: Survey, sessions: SurveySession[]): FunnelStep[] {
    if (sessions.length === 0) return [];

    const pageElements: SurveyElement[][] = [];
    let currentPage: SurveyElement[] = [];

    if (survey.showIntroAsPage !== false) pageElements.push([]);
    survey.elements.forEach(element => {
        if (element.type === 'section' && (element as any).renderAsPage && currentPage.length > 0) {
            pageElements.push(currentPage);
            currentPage = [element];
        } else {
            currentPage.push(element);
        }
    });
    if (currentPage.length > 0) pageElements.push(currentPage);

    const totalSessions = sessions.length;

    return pageElements.map((page, index) => {
        const section = page[0] as any;
        const label = index === 0 && survey.showCoverPage
            ? 'Cover Page'
            : (section?.stepperTitle || section?.title || `Step ${index + 1}`);

        const count = sessions.filter(s => s.maxStepReached >= index).length;

        return {
            index,
            label,
            count,
            percentage: (count / totalSessions) * 100,
            color: CHART_COLORS[index % CHART_COLORS.length],
        };
    });
}

export function computeDropoffInsights(funnelData: FunnelStep[]): DropoffInsight[] {
    if (funnelData.length < 2) return [];

    const insights: DropoffInsight[] = [];
    for (let i = 0; i < funnelData.length - 1; i++) {
        const current = funnelData[i];
        const next = funnelData[i + 1];
        const lost = current.count - next.count;
        const lossPercentage = current.count > 0 ? (lost / current.count) * 100 : 0;
        if (lossPercentage > 0) {
            insights.push({ from: current.label, to: next.label, lost, lossPercentage });
        }
    }
    return insights.sort((a, b) => b.lossPercentage - a.lossPercentage);
}

// ─── Scoring Metrics ───────────────────────────────────────────────────────────

export function computeScoringMetrics(survey: Survey, responses: SurveyResponse[]): ScoringMetrics | null {
    if (!survey.scoringEnabled || responses.length === 0) return null;

    let total = 0;
    const ruleCountMap = new Map<string, number>();
    survey.resultRules?.forEach(rule => ruleCountMap.set(rule.id, 0));

    // js-combine-iterations: single pass for score sum + rule matching
    const sortedRules = survey.resultRules ? [...survey.resultRules].sort((a, b) => a.priority - b.priority) : [];
    responses.forEach(res => {
        const score = res.score || 0;
        total += score;
        const matchedRule = sortedRules.find(rule => score >= rule.minScore && score <= rule.maxScore);
        if (matchedRule) {
            ruleCountMap.set(matchedRule.id, (ruleCountMap.get(matchedRule.id) || 0) + 1);
        }
    });

    const avg = total / responses.length;

    const outcomeData = (survey.resultRules || [])
        .map((rule, idx) => ({
            name: rule.label,
            value: ruleCountMap.get(rule.id) || 0,
            color: CHART_COLORS[idx % CHART_COLORS.length],
        }))
        .filter(d => d.value > 0);

    return { avg, total, outcomeData };
}

// ─── Question-by-Question Analysis ─────────────────────────────────────────────

export function analyzeQuestions(survey: Survey, responses: SurveyResponse[]): AnalyzedResult[] {
    if (!survey || !responses) return [];

    const questions = survey.elements.filter(isQuestion);

    // js-index-maps: Build a Map<questionId, value[]> for O(1) lookups
    const answersByQuestion = new Map<string, any[]>();
    questions.forEach(q => answersByQuestion.set(q.id, []));

    responses.forEach(res => {
        res.answers.forEach(a => {
            const arr = answersByQuestion.get(a.questionId);
            if (arr && a.value !== undefined && a.value !== null && a.value !== '') {
                arr.push(a.value);
            }
        });
    });

    return questions.map(question => {
        const questionResponses = answersByQuestion.get(question.id) || [];
        let result: AnalyzedResult;

        if (question.type === 'yes-no' || question.type === 'multiple-choice' || question.type === 'dropdown') {
            const options = question.type === 'yes-no' ? ['Yes', 'No'] : question.options || [];
            const counts = new Map<string, number>(options.map(opt => [opt, 0]));
            questionResponses.forEach(value => {
                if (typeof value === 'string' && counts.has(value)) {
                    counts.set(value, (counts.get(value) || 0) + 1);
                }
            });
            const total = questionResponses.length;
            const data = Array.from(counts.entries()).map(([name, value]) => ({
                name, value, percentage: total > 0 ? (value / total) * 100 : 0,
            }));
            result = { question, type: 'chart' as const, data, total, insight: '' };

        } else if (question.type === 'checkboxes') {
            const optionsList = question.options || [];
            const counts = new Map<string, number>(optionsList.map(opt => [opt, 0]));
            if (question.allowOther) counts.set('Other', 0);
            const otherText: string[] = [];

            questionResponses.forEach((value: any) => {
                const selectedOptions = value?.options || (Array.isArray(value) ? value : []);
                if (Array.isArray(selectedOptions)) {
                    selectedOptions.forEach((v: string) => {
                        if (counts.has(v)) counts.set(v, (counts.get(v) || 0) + 1);
                    });
                }
                if (value?.other && value.other.trim()) {
                    counts.set('Other', (counts.get('Other') || 0) + 1);
                    otherText.push(value.other.trim());
                }
            });

            const totalRespondents = questionResponses.length;
            const data = Array.from(counts.entries()).map(([name, value]) => ({
                name, value, percentage: totalRespondents > 0 ? (value / totalRespondents) * 100 : 0,
            }));
            result = { question, type: 'checkbox' as const, data, otherText, total: totalRespondents, insight: '' };

        } else if (question.type === 'text' || question.type === 'long-text' || question.type === 'date' || question.type === 'time') {
            const textResponses = questionResponses.filter(
                (v): v is string => typeof v === 'string' && v.trim().length > 0
            );
            result = { question, type: 'text' as const, data: textResponses, total: textResponses.length, insight: '' };

        } else if (question.type === 'rating') {
            const counts = new Map<string, number>([['1', 0], ['2', 0], ['3', 0], ['4', 0], ['5', 0]]);
            let totalScore = 0;
            let validCount = 0;

            questionResponses.forEach(v => {
                if (typeof v === 'number' && v >= 1 && v <= 5) {
                    const key = String(v);
                    counts.set(key, (counts.get(key) || 0) + 1);
                    totalScore += v;
                    validCount++;
                }
            });

            const average = validCount > 0 ? totalScore / validCount : 0;
            const data = Array.from(counts.entries()).map(([name, value]) => ({
                name: `${name} ★`, value, percentage: validCount > 0 ? (value / validCount) * 100 : 0,
            }));
            result = { question, type: 'rating' as const, data, total: validCount, average, insight: '' };

        } else {
            result = { question, type: 'unknown' as const, data: [], insight: '' };
        }

        return { ...result, insight: generateInsight(result) };
    });
}

// ─── Attribution Analytics ─────────────────────────────────────────────────────

export function computeAttribution(
    responses: SurveyResponse[],
    users: { id: string; name?: string; email?: string }[] | null
): AttributionRow[] {
    if (!responses || !users) return [];

    // js-set-map-lookups: Build user lookup Map for O(1) resolution
    const userMap = new Map(users.map(u => [u.id, u]));
    const statsMap = new Map<string, { responses: number; leads: number }>();

    responses.forEach(res => {
        if (res.assignedUserId) {
            const existing = statsMap.get(res.assignedUserId) || { responses: 0, leads: 0 };
            existing.responses++;
            if (res.entityId) existing.leads++;
            statsMap.set(res.assignedUserId, existing);
        }
    });

    return Array.from(statsMap.entries())
        .map(([uid, stats]) => {
            const user = userMap.get(uid);
            return {
                id: uid,
                name: user?.name || user?.email || 'Team Member',
                responses: stats.responses,
                leads: stats.leads,
                yield: stats.responses > 0 ? Math.round((stats.leads / stats.responses) * 100) : 0,
            };
        })
        .sort((a, b) => b.responses - a.responses);
}
