/**
 * @fileOverview Capability Feature Flags & Kill Switches Public Exports (Phase 1 / PR-8)
 *
 * Implements Rule 60 (Dead-Man Controls), Rule 62 (Zero Deployments / 60s TTL),
 * Rule 64 (Precedence Hierarchy), and PRD §73.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

export * from './capability-flags-types';
export * from './evaluate-capability-flag';
export * from './flag-service';
