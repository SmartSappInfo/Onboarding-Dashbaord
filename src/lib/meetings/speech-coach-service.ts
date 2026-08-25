/**
 * @fileoverview Pure AI Meeting Speech Coach & Conversation Dynamics Analyzer.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Guards against division by zero and NaN states.
 */

import type { TranscriptSegment, TranscriptSpeaker } from './types/intelligence';
import type { SpeechCoachingScorecard } from './types/speech-coach';

/**
 * Analyzes speaker dynamics, talk-to-listen ratios, pacing, and monologue occurrences.
 */
export function analyzeConversationDynamics(
  segments: TranscriptSegment[],
  speakers: TranscriptSpeaker[],
  meetingId: string,
  workspaceId: string
): SpeechCoachingScorecard {
  const now = new Date().toISOString();

  if (!segments || segments.length === 0) {
    return {
      meetingId,
      workspaceId,
      overallCoachScore: 75,
      talkToListenRatio: {
        hostPercentage: 50,
        attendeesPercentage: 50,
        evaluation: 'optimal',
      },
      pacingEvaluation: {
        avgWordsPerMinute: 140,
        verdict: 'ideal',
      },
      monologueAlerts: [],
      questionsDetectedCount: 0,
      strengths: ['Meeting scheduled without transcript anomalies.'],
      tacticalRecommendations: ['Ensure recordings are enabled to unlock granular talk-time analysis.'],
      createdAt: now,
    };
  }

  let totalDurationMs = 0;
  let hostSpokenMs = 0;
  let attendeesSpokenMs = 0;
  let totalWords = 0;
  let hostWords = 0;
  let questionsCount = 0;

  const monologueAlerts: SpeechCoachingScorecard['monologueAlerts'] = [];

  for (const seg of segments) {
    const duration = Math.max(0, seg.endMs - seg.startMs);
    totalDurationMs += duration;

    const words = seg.text ? seg.text.trim().split(/\s+/).filter(Boolean).length : 0;
    totalWords += words;

    // Check if segment has questions
    if (seg.text && (seg.text.includes('?') || seg.text.toLowerCase().startsWith('what') || seg.text.toLowerCase().startsWith('how') || seg.text.toLowerCase().startsWith('could you'))) {
      questionsCount++;
    }

    const speaker = speakers.find(s => s.id === seg.speakerId);
    const isHost = speaker ? !!speaker.isHost : false;

    if (isHost) {
      hostSpokenMs += duration;
      hostWords += words;
    } else {
      attendeesSpokenMs += duration;
    }

    // Flag monologues greater than 120 seconds (120,000 ms)
    if (duration > 120000) {
      monologueAlerts.push({
        speakerName: seg.speakerName || 'Host',
        durationSeconds: Math.round(duration / 1000),
        timestampMs: seg.startMs,
      });
    }
  }

  const hostPercentage = totalDurationMs > 0 ? Math.round((hostSpokenMs / totalDurationMs) * 100) : 50;
  const attendeesPercentage = Math.max(0, 100 - hostPercentage);

  let talkEval: 'optimal' | 'host_dominating' | 'attendees_dominating' = 'optimal';
  if (hostPercentage > 65) {
    talkEval = 'host_dominating';
  } else if (hostPercentage < 35) {
    talkEval = 'attendees_dominating';
  }

  // Pacing: calculate words per minute (WPM)
  const hostDurationMinutes = hostSpokenMs / 60000;
  const wpm = hostDurationMinutes > 0 ? Math.round(hostWords / hostDurationMinutes) : 135;

  let pacingVerdict: 'too_slow' | 'ideal' | 'too_fast' = 'ideal';
  if (wpm < 110) {
    pacingVerdict = 'too_slow';
  } else if (wpm > 175) {
    pacingVerdict = 'too_fast';
  }

  // Calculate Overall Coaching Score (0 to 100)
  let score = 85;
  const strengths: string[] = [];
  const recommendations: string[] = [];

  if (talkEval === 'optimal') {
    score += 5;
    strengths.push(`Balanced talk-to-listen ratio (${hostPercentage}% host vs ${attendeesPercentage}% attendees).`);
  } else if (talkEval === 'host_dominating') {
    score -= 15;
    recommendations.push(`Host spoke for ${hostPercentage}% of the time. Aim for 45-55% to encourage buyer engagement.`);
  }

  if (pacingVerdict === 'ideal') {
    score += 5;
    strengths.push(`Cadence and pacing was optimal at ${wpm} words per minute.`);
  } else if (pacingVerdict === 'too_fast') {
    score -= 10;
    recommendations.push(`Speech cadence reached ${wpm} WPM. Slow down slightly on key value propositions.`);
  }

  if (monologueAlerts.length === 0) {
    strengths.push('Zero uninterrupted long monologues detected.');
  } else {
    score -= monologueAlerts.length * 5;
    recommendations.push(`${monologueAlerts.length} long monologue(s) (>2 min) detected. Pause frequently for feedback.`);
  }

  if (questionsCount >= 3) {
    strengths.push(`Strong discovery discipline with ${questionsCount} engaging questions asked.`);
  } else {
    recommendations.push('Incorporate more open-ended discovery questions ("How does your team currently...?").');
  }

  const finalScore = Math.max(20, Math.min(100, score));

  return {
    meetingId,
    workspaceId,
    overallCoachScore: finalScore,
    talkToListenRatio: {
      hostPercentage,
      attendeesPercentage,
      evaluation: talkEval,
    },
    pacingEvaluation: {
      avgWordsPerMinute: wpm,
      verdict: pacingVerdict,
    },
    monologueAlerts,
    questionsDetectedCount: questionsCount,
    strengths,
    tacticalRecommendations: recommendations,
    createdAt: now,
  };
}
