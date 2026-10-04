/**
 * @fileOverview Public API Barrels: Universal CRM Agent & Multi-Domain CRM Subsystems (Phase 9)
 */

export * from './context';
export * from './personas';
export * from './evaluation';
export * from './intelligence';
export * from './actions';

// Explicit re-exports to resolve export collisions (TS2308)
export { CRM_ROLLBACK_MATRIX } from './personas';
export { CRM_ACTION_ROLLBACK_MATRIX } from './actions';

