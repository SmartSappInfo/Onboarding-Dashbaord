/**
 * @fileOverview Shared read of a meeting's analysis + run progress (Phase 11 M2 · T3.5).
 *
 * One read path for the UI Server Action (people, authorised by `requireMeetingAccess`
 * 'meetings_view') and the `meeting.get_intelligence` capability (agents/MCP via the gateway).
 * UI reads deliberately do NOT go through the gateway: legacy roles have no meetings view scope
 * (M1 · T1 decision), so routing them there would lock view-only members out.
 *
 * Tests: covered by intelligence-store / meetings-intelligence / meeting-actions-security tests.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { findLatestTranscriptId } from '../transcript-store';
import { loadRun, readIntelligenceV2, runIdFor, type IntelligenceRun, type IntelligenceV2 } from './intelligence-store';
import { EXTRACT_PROMPT_VERSION } from './prompts';

export interface RunProgress {
  runId: string;
  transcriptId: string;
  status: IntelligenceRun['status'];
  step: IntelligenceRun['step'];
  chunksDone: number;
  chunkCount: number;
  error?: { code: string; message: string };
}

export interface MeetingAnalysis {
  stored: IntelligenceV2 | null;
  /** The run for the latest completed transcript, when one exists. */
  run: RunProgress | null;
  latestTranscriptId: string | null;
}

export async function readMeetingAnalysis(db: Firestore, workspaceId: string, meetingId: string): Promise<MeetingAnalysis> {
  const [stored, latestTranscriptId] = await Promise.all([
    readIntelligenceV2(db, meetingId, workspaceId),
    findLatestTranscriptId(db, meetingId, workspaceId),
  ]);
  let run: RunProgress | null = null;
  if (latestTranscriptId) {
    const runId = runIdFor(workspaceId, latestTranscriptId, EXTRACT_PROMPT_VERSION);
    const r = await loadRun(db, runId);
    if (r && r.workspaceId === workspaceId && r.meetingId === meetingId) {
      run = {
        runId, transcriptId: r.transcriptId, status: r.status, step: r.step, chunksDone: r.chunksDone, chunkCount: r.chunkCount,
        ...(r.error ? { error: r.error } : {}),
      };
    }
  }
  return { stored, run, latestTranscriptId };
}
