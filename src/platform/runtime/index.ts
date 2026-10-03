/**
 * @fileOverview Public API Barrel for SmartSapp Agent Runtime (Phase 6)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing.
 * - Rule 10: Complete architectural exports for downstream modules.
 * - Rule 69: Single Source of Truth for Autonomous Agent Runtime.
 */

// Core Contracts, Schemas & Error Taxonomy
export * from './agent-run-types';

// Deterministic Finite State Machine
export * from './agent-state-machine';

// Multi-Tenant Agent Run Store & Adapters
export * from './agent-run-store';

// Lifecycle Domain Events & Subscribers
export * from './subscribers/agent-event-subscribers';

// Tiered Model Router & Circuit Breakers (Rule 58 & Rule 24)
export * from './routing';

// Planning Engine, DAG Validator, Replanner & Shadow Simulation (Rules 23, 27, 42, 47, 59)
export * from './planning';

// Resource Governance, Knapsack Context Compression, Cancellation & Sagas (Rules 9, 19, 20, 23, 25, 26, 27, 28, 30, 40, 42, 56, 60, 63)
export * from './governance';

// Step Verification, Human-in-the-Loop Interception & Execution Loop (Rules 14, 17, 18, 21, 22, 31, 47, 48, 60, 68)
export * from './execution';

// Swarm Workflows, Multi-Agent Handoffs & Dynamic Topology Routing (Rules 8, 9, 13, 16, 17, 21, 22, 23, 26, 27, 40, 41, 42, 47, 48, 60, 69)
export * from './swarm';

