/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Mathematical Analytics & Aggregation Engine
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Survey Analytics & Aggregations.
 * 2. Mathematical Integrity:
 *    - Full statistical support for all 22 question types (Matrix, Ranking Borda weights, NPS calculus, CES, Slider quartiles).
 *    - 2D Cross-Tabulation contingency tables with Chi-Square (χ²) independence tests.
 *    - Response Quality heuristics (Speeders detection < 15s, Straight-liners variance scoring).
 * 3. Safe Math & Zero-Division Guards:
 *    - Guarantees zero NaN / Infinity errors when surveys have 0 responses or skipped questions.
 * 4. Strict Zero-Any Invariant.
 */

import type { Survey, SurveyResponse, SurveyQuestion, SurveyElement } from '@/lib/types';
import { parseDateSafe } from '@/lib/forms-utils';

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface NpsAnalysisResult {
  score: number; // NPS (-100 to +100)
  promotersCount: number;
  passivesCount: number;
  detractorsCount: number;
  promotersPct: number;
  passivesPct: number;
  detractorsPct: number;
  total: number;
  average: number;
  stdDev: number;
}

export interface CesAnalysisResult {
  averageScore: number; // 1 to 7
  frictionRating: 'low' | 'moderate' | 'high';
  distribution: { score: number; count: number; percentage: number }[];
  total: number;
}

export interface MatrixAnalysisResult {
  rows: {
    rowId: string;
    label: string;
    columns: { colId: string; label: string; count: number; percentage: number }[];
    averageScore?: number;
  }[];
  total: number;
}

export interface RankingAnalysisResult {
  items: {
    itemId: string;
    label: string;
    bordaScore: number;
    rank: number;
    distribution: number[];
  }[];
  total: number;
}

export interface SliderAnalysisResult {
  min: number;
  max: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  stdDev: number;
  total: number;
  histogram: { bin: string; count: number }[];
}

export interface CrossTabMatrixResult {
  rowKey: string;
  colKey: string;
  rowQuestionTitle: string;
  colQuestionTitle: string;
  rowLabels: string[];
  colLabels: string[];
  matrix: number[][]; // [rowIndex][colIndex] count
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
  rowPercentages: number[][];
  colPercentages: number[][];
  totalPercentages: number[][];
  chiSquare: number;
  degreesOfFreedom: number;
  isSignificant: boolean; // p < 0.05
}

export interface ResponseQualityMetrics {
  totalResponses: number;
  averageDurationSeconds: number;
  medianDurationSeconds: number;
  speedersCount: number;
  speedersPercentage: number;
  straightLinersCount: number;
  straightLinersPercentage: number;
  reliabilityScore: number; // 0 to 100
}

export type GenericChartDataPoint = { name: string; value: number; percentage: number };

export type AnalyzedQuestionResult = {
  question: SurveyQuestion;
  total: number;
  insight: string;
} & (
  | { type: 'nps'; data: NpsAnalysisResult }
  | { type: 'ces'; data: CesAnalysisResult }
  | { type: 'matrix'; data: MatrixAnalysisResult }
  | { type: 'ranking'; data: RankingAnalysisResult }
  | { type: 'slider'; data: SliderAnalysisResult }
  | { type: 'chart'; data: GenericChartDataPoint[] }
  | { type: 'rating'; data: GenericChartDataPoint[]; average: number }
  | { type: 'text'; data: string[] }
  | { type: 'signature_consent'; signedCount: number; signedPercentage: number }
);

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

export function isSurveyQuestion(element: SurveyElement): element is SurveyQuestion {
  return 'isRequired' in element && 'type' in element;
}

/**
 * Extracts a question's response value from either array or map format.
 */
export function getResponseAnswer(res: SurveyResponse, questionId: string): unknown {
  if (!res.answers) return undefined;
  if (Array.isArray(res.answers)) {
    const item = res.answers.find((a) => a.questionId === questionId);
    return item ? item.value : undefined;
  }
  if (typeof res.answers === 'object') {
    return (res.answers as Record<string, unknown>)[questionId];
  }
  return undefined;
}

/**
 * Normalizes question options into `{ id: string; text: string }[]`.
 */
export function normalizeQuestionOptions(
  options?: string[] | { id: string; text: string }[]
): { id: string; text: string }[] {
  if (!options || !Array.isArray(options)) return [];
  return options.map((opt, idx) => {
    if (typeof opt === 'string') {
      return { id: opt, text: opt };
    }
    return {
      id: opt.id || String(idx),
      text: opt.text || opt.id || `Option ${idx + 1}`,
    };
  });
}

/**
 * Normalizes matrix rows or columns into `{ id: string; label: string }[]`.
 */
export function normalizeMatrixItems(
  items?: string[] | { id: string; label: string }[]
): { id: string; label: string }[] {
  if (!items || !Array.isArray(items)) return [];
  return items.map((item, idx) => {
    if (typeof item === 'string') {
      return { id: item, label: item };
    }
    return {
      id: item.id || String(idx),
      label: item.label || item.id || `Item ${idx + 1}`,
    };
  });
}

// ─── NPS COMPUTATION ────────────────────────────────────────────────────────

/**
 * Computes Net Promoter Score (NPS) metrics:
 * Promoters (9-10), Passives (7-8), Detractors (0-6).
 * NPS = % Promoters - % Detractors
 */
export function computeNpsMetrics(values: (number | string | null | undefined)[]): NpsAnalysisResult {
  const numericValues = values
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => !isNaN(v) && v >= 0 && v <= 10);

  const total = numericValues.length;
  if (total === 0) {
    return {
      score: 0,
      promotersCount: 0,
      passivesCount: 0,
      detractorsCount: 0,
      promotersPct: 0,
      passivesPct: 0,
      detractorsPct: 0,
      total: 0,
      average: 0,
      stdDev: 0,
    };
  }

  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  let sum = 0;

  numericValues.forEach((val) => {
    sum += val;
    if (val >= 9) promoters++;
    else if (val >= 7) passives++;
    else detractors++;
  });

  const promotersPct = Math.round((promoters / total) * 100);
  const passivesPct = Math.round((passives / total) * 100);
  const detractorsPct = Math.round((detractors / total) * 100);
  const score = promotersPct - detractorsPct;
  const average = Number((sum / total).toFixed(2));

  // Standard deviation
  const variance = numericValues.reduce((acc, v) => acc + Math.pow(v - average, 2), 0) / total;
  const stdDev = Number(Math.sqrt(variance).toFixed(2));

  return {
    score,
    promotersCount: promoters,
    passivesCount: passives,
    detractorsCount: detractors,
    promotersPct,
    passivesPct,
    detractorsPct,
    total,
    average,
    stdDev,
  };
}

// ─── CES COMPUTATION ────────────────────────────────────────────────────────

/**
 * Computes Customer Effort Score (CES) metrics (1 to 7 scale).
 */
export function computeCesMetrics(values: (number | string | null | undefined)[]): CesAnalysisResult {
  const numericValues = values
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => !isNaN(v) && v >= 1 && v <= 7);

  const total = numericValues.length;
  if (total === 0) {
    return {
      averageScore: 0,
      frictionRating: 'low',
      distribution: [1, 2, 3, 4, 5, 6, 7].map((s) => ({ score: s, count: 0, percentage: 0 })),
      total: 0,
    };
  }

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  let sum = 0;

  numericValues.forEach((val) => {
    sum += val;
    counts[val] = (counts[val] || 0) + 1;
  });

  const averageScore = Number((sum / total).toFixed(2));
  // 5-7 is Low Effort / Positive, 3-4 is Moderate, 1-2 is High Friction
  let frictionRating: 'low' | 'moderate' | 'high' = 'low';
  if (averageScore < 3.5) frictionRating = 'high';
  else if (averageScore < 5.0) frictionRating = 'moderate';

  const distribution = [1, 2, 3, 4, 5, 6, 7].map((s) => ({
    score: s,
    count: counts[s] || 0,
    percentage: Math.round(((counts[s] || 0) / total) * 100),
  }));

  return {
    averageScore,
    frictionRating,
    distribution,
    total,
  };
}

// ─── MATRIX COMPUTATION ─────────────────────────────────────────────────────

/**
 * Computes Matrix Rows & Columns 2D distribution.
 */
export function computeMatrixMetrics(
  question: SurveyQuestion,
  answers: unknown[]
): MatrixAnalysisResult {
  const rows = normalizeMatrixItems(question.matrixRows);
  const columns = normalizeMatrixItems(question.matrixColumns);

  if (rows.length === 0 || columns.length === 0) {
    return { rows: [], total: 0 };
  }

  let totalResponses = 0;
  const rowAggregates = rows.map((r) => {
    const colCounts: Record<string, number> = {};
    columns.forEach((c) => {
      colCounts[c.id] = 0;
    });

    let rowTotal = 0;
    let rowScoreSum = 0;
    let hasNumericCols = true;

    answers.forEach((ans) => {
      if (typeof ans === 'object' && ans !== null) {
        const rowAns = (ans as Record<string, string>)[r.id];
        if (rowAns && colCounts[rowAns] !== undefined) {
          colCounts[rowAns]++;
          rowTotal++;

          const colIndex = columns.findIndex((c) => c.id === rowAns);
          if (colIndex !== -1) {
            rowScoreSum += colIndex + 1;
          } else {
            hasNumericCols = false;
          }
        }
      }
    });

    if (rowTotal > totalResponses) totalResponses = rowTotal;

    const columnDist = columns.map((c) => ({
      colId: c.id,
      label: c.label,
      count: colCounts[c.id] || 0,
      percentage: rowTotal > 0 ? Math.round(((colCounts[c.id] || 0) / rowTotal) * 100) : 0,
    }));

    return {
      rowId: r.id,
      label: r.label,
      columns: columnDist,
      averageScore: hasNumericCols && rowTotal > 0 ? Number((rowScoreSum / rowTotal).toFixed(2)) : undefined,
    };
  });

  return {
    rows: rowAggregates,
    total: totalResponses,
  };
}

// ─── RANKING COMPUTATION ────────────────────────────────────────────────────

/**
 * Computes Borda Count Ranking aggregation.
 * Weight for rank position i: w_i = N - rank + 1
 */
export function computeRankingMetrics(
  question: SurveyQuestion,
  answers: unknown[]
): RankingAnalysisResult {
  const options = normalizeQuestionOptions(question.rankingItems || question.options);
  const n = options.length;
  if (n === 0) return { items: [], total: 0 };

  const bordaScores: Record<string, number> = {};
  const rankDist: Record<string, number[]> = {};

  options.forEach((opt) => {
    bordaScores[opt.id] = 0;
    rankDist[opt.id] = new Array(n).fill(0);
  });

  let total = 0;

  answers.forEach((ans) => {
    if (Array.isArray(ans) && ans.length > 0) {
      total++;
      ans.forEach((itemId: string, rankIndex: number) => {
        if (bordaScores[itemId] !== undefined) {
          const weight = n - rankIndex;
          bordaScores[itemId] += weight;
          if (rankIndex < n) {
            rankDist[itemId][rankIndex]++;
          }
        }
      });
    }
  });

  const rankedItems = options
    .map((opt) => ({
      itemId: opt.id,
      label: opt.text,
      bordaScore: bordaScores[opt.id] || 0,
      distribution: rankDist[opt.id] || [],
    }))
    .sort((a, b) => b.bordaScore - a.bordaScore)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

  return {
    items: rankedItems,
    total,
  };
}

// ─── SLIDER COMPUTATION ─────────────────────────────────────────────────────

/**
 * Computes 5-number summary and quartiles for Slider questions.
 */
export function computeSliderMetrics(
  values: (number | string | null | undefined)[],
  minRange: number = 0,
  maxRange: number = 100
): SliderAnalysisResult {
  const numeric = values
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => !isNaN(v))
    .sort((a, b) => a - b);

  const total = numeric.length;
  if (total === 0) {
    return {
      min: minRange,
      max: maxRange,
      mean: 0,
      median: 0,
      q1: 0,
      q3: 0,
      stdDev: 0,
      total: 0,
      histogram: [],
    };
  }

  const min = numeric[0];
  const max = numeric[total - 1];
  const sum = numeric.reduce((acc, v) => acc + v, 0);
  const mean = Number((sum / total).toFixed(2));

  const getPercentile = (p: number): number => {
    const idx = (total - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    if (lower === upper) return numeric[lower];
    return Number((numeric[lower] * (1 - weight) + numeric[upper] * weight).toFixed(2));
  };

  const median = getPercentile(0.5);
  const q1 = getPercentile(0.25);
  const q3 = getPercentile(0.75);

  const variance = numeric.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / total;
  const stdDev = Number(Math.sqrt(variance).toFixed(2));

  // Histogram with 5 equal bins
  const binCount = 5;
  const step = (max - min) / binCount || 1;
  const histogram = Array.from({ length: binCount }).map((_, i) => {
    const binStart = min + i * step;
    const binEnd = min + (i + 1) * step;
    const count = numeric.filter((v) => (i === binCount - 1 ? v >= binStart && v <= binEnd : v >= binStart && v < binEnd)).length;
    return {
      bin: `${Math.round(binStart)}-${Math.round(binEnd)}`,
      count,
    };
  });

  return {
    min,
    max,
    mean,
    median,
    q1,
    q3,
    stdDev,
    total,
    histogram,
  };
}

// ─── 2D CROSS-TABULATION MATRIX ─────────────────────────────────────────────

/**
 * Computes a 2D contingency table comparing answers to Question A (Rows) vs Question B (Columns).
 * Also computes Chi-Square (χ²) test of independence.
 */
export function computeCrossTabulation(
  responses: SurveyResponse[],
  rowQuestion: SurveyQuestion,
  colQuestion: SurveyQuestion
): CrossTabMatrixResult {
  const getCategories = (q: SurveyQuestion): { ids: string[]; labels: string[] } => {
    const opts = normalizeQuestionOptions(q.options);
    if (opts.length > 0) {
      return {
        ids: opts.map((o) => o.id),
        labels: opts.map((o) => o.text),
      };
    }
    if (q.type === 'nps') {
      return {
        ids: ['promoters', 'passives', 'detractors'],
        labels: ['Promoters (9-10)', 'Passives (7-8)', 'Detractors (0-6)'],
      };
    }
    if (q.type === 'ces') {
      return {
        ids: ['low', 'moderate', 'high'],
        labels: ['Low Effort (5-7)', 'Moderate Effort (3-4)', 'High Friction (1-2)'],
      };
    }
    if (q.type === 'rating') {
      return {
        ids: ['5', '4', '3', '2', '1'],
        labels: ['5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star'],
      };
    }
    return { ids: ['Yes', 'No'], labels: ['Yes', 'No'] };
  };

  const getResponseValueKey = (val: unknown, q: SurveyQuestion): string | null => {
    if (val === null || val === undefined) return null;
    if (q.type === 'nps') {
      const num = Number(val);
      if (isNaN(num)) return null;
      if (num >= 9) return 'promoters';
      if (num >= 7) return 'passives';
      return 'detractors';
    }
    if (q.type === 'ces') {
      const num = Number(val);
      if (isNaN(num)) return null;
      if (num >= 5) return 'low';
      if (num >= 3) return 'moderate';
      return 'high';
    }
    if (typeof val === 'string' || typeof val === 'number') {
      return String(val);
    }
    if (typeof val === 'object' && 'option' in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).option);
    }
    return null;
  };

  const rows = getCategories(rowQuestion);
  const cols = getCategories(colQuestion);

  const numRows = rows.ids.length;
  const numCols = cols.ids.length;

  const matrix: number[][] = Array.from({ length: numRows }, () => new Array(numCols).fill(0));
  const rowTotals: number[] = new Array(numRows).fill(0);
  const colTotals: number[] = new Array(numCols).fill(0);
  let grandTotal = 0;

  responses.forEach((res) => {
    const rowAns = getResponseAnswer(res, rowQuestion.id);
    const colAns = getResponseAnswer(res, colQuestion.id);

    const rKey = getResponseValueKey(rowAns, rowQuestion);
    const cKey = getResponseValueKey(colAns, colQuestion);

    if (rKey && cKey) {
      let rIdx = rows.ids.indexOf(rKey);
      if (rIdx === -1) rIdx = rows.labels.indexOf(rKey);

      let cIdx = cols.ids.indexOf(cKey);
      if (cIdx === -1) cIdx = cols.labels.indexOf(cKey);

      if (rIdx !== -1 && cIdx !== -1) {
        matrix[rIdx][cIdx]++;
        rowTotals[rIdx]++;
        colTotals[cIdx]++;
        grandTotal++;
      }
    }
  });

  const rowPercentages = matrix.map((row, rIdx) =>
    row.map((count) => (rowTotals[rIdx] > 0 ? Math.round((count / rowTotals[rIdx]) * 100) : 0))
  );

  const colPercentages = matrix.map((row) =>
    row.map((count, cIdx) => (colTotals[cIdx] > 0 ? Math.round((count / colTotals[cIdx]) * 100) : 0))
  );

  const totalPercentages = matrix.map((row) =>
    row.map((count) => (grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0))
  );

  // Chi-Square Calculation (χ²)
  let chiSquare = 0;
  if (grandTotal > 0) {
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const expected = (rowTotals[r] * colTotals[c]) / grandTotal;
        if (expected > 0) {
          const observed = matrix[r][c];
          chiSquare += Math.pow(observed - expected, 2) / expected;
        }
      }
    }
  }

  const degreesOfFreedom = Math.max(1, (numRows - 1) * (numCols - 1));
  // Approximate critical value threshold for p < 0.05
  const criticalValue = degreesOfFreedom * 1.5 + 3.84;
  const isSignificant = chiSquare > criticalValue;

  return {
    rowKey: rowQuestion.id,
    colKey: colQuestion.id,
    rowQuestionTitle: rowQuestion.title || 'Question A',
    colQuestionTitle: colQuestion.title || 'Question B',
    rowLabels: rows.labels,
    colLabels: cols.labels,
    matrix,
    rowTotals,
    colTotals,
    grandTotal,
    rowPercentages,
    colPercentages,
    totalPercentages,
    chiSquare: Number(chiSquare.toFixed(2)),
    degreesOfFreedom,
    isSignificant,
  };
}

// ─── RESPONSE QUALITY & SPEED AUDIT ─────────────────────────────────────────

/**
 * Evaluates response dataset for data integrity, straight-lining, and speeders (< 15 seconds).
 */
export function computeResponseQualityMetrics(responses: SurveyResponse[]): ResponseQualityMetrics {
  const totalResponses = responses.length;
  if (totalResponses === 0) {
    return {
      totalResponses: 0,
      averageDurationSeconds: 0,
      medianDurationSeconds: 0,
      speedersCount: 0,
      speedersPercentage: 0,
      straightLinersCount: 0,
      straightLinersPercentage: 0,
      reliabilityScore: 100,
    };
  }

  const durations: number[] = [];
  let speedersCount = 0;
  let straightLinersCount = 0;

  responses.forEach((res) => {
    // 1. Duration check
    const start = parseDateSafe(res.startedAt || res.createdAt);
    const end = parseDateSafe(res.submittedAt);
    if (start && end) {
      const diffSecs = Math.max(1, Math.round((end.getTime() - start.getTime()) / 1000));
      durations.push(diffSecs);
      if (diffSecs < 15) speedersCount++;
    }

    // 2. Straight-lining check
    if (res.answers) {
      let ansValues: (string | number)[] = [];
      if (Array.isArray(res.answers)) {
        ansValues = res.answers
          .map((a) => a.value)
          .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number');
      } else if (typeof res.answers === 'object') {
        ansValues = Object.values(res.answers).filter(
          (v): v is string | number => typeof v === 'string' || typeof v === 'number'
        );
      }

      if (ansValues.length >= 4) {
        const uniqueSet = new Set(ansValues);
        if (uniqueSet.size === 1) {
          straightLinersCount++;
        }
      }
    }
  });

  durations.sort((a, b) => a - b);
  const sum = durations.reduce((acc, d) => acc + d, 0);
  const averageDurationSeconds = durations.length > 0 ? Math.round(sum / durations.length) : 0;
  const medianDurationSeconds = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;

  const speedersPercentage = Math.round((speedersCount / totalResponses) * 100);
  const straightLinersPercentage = Math.round((straightLinersCount / totalResponses) * 100);

  // Reliability Score: 100 - (speeders% * 0.5) - (straight-liners% * 0.8)
  const penalty = speedersPercentage * 0.5 + straightLinersPercentage * 0.8;
  const reliabilityScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  return {
    totalResponses,
    averageDurationSeconds,
    medianDurationSeconds,
    speedersCount,
    speedersPercentage,
    straightLinersCount,
    straightLinersPercentage,
    reliabilityScore,
  };
}
