/**
 * @fileOverview Agent Runtime Execution Subsystem Barrel (Phase 6 Milestone 4)
 *
 * Exports:
 * - Execution contracts, schemas & error taxonomy (`execution-types`)
 * - Step output validation & untrusted XML containerization (`StepValidator`)
 * - Post-condition verification engine (`StepVerifier`)
 * - Two-phase human approval interceptor & cryptographic hash binding (`ApprovalInterceptor`)
 * - Unified autonomous execution loop orchestrator (`AgentExecutionLoop`)
 */

export * from './execution-types';
export * from './step-validator';
export * from './step-verifier';
export * from './approval-interceptor';
export * from './agent-execution-loop';
