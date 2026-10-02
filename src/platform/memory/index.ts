/**
 * @fileOverview Canonical 5-Tier Memory & Knowledge Plane (Phase 4 Milestone 1)
 *
 * Single Source of Truth for Platform Memory Contracts, Storage Adapters, and Anti-Poisoning Governance.
 */

// Contracts & Schemas
export * from './contracts/memory-types';

// Storage Adapters & Vector Engine
export * from './adapters/vector-store.interface';
export * from './adapters/memory-vector-store';
export * from './adapters/qdrant-vector-store';

// Governance & Poisoning Defense
export * from './governance/anti-poisoning';

// Canonical Strangler Service
export * from './services/canonical-memory-service';

// Context Retrieval, Budgeting & Evidence Pipeline
export * from './retrieval';

// Knowledge Ingestion Pipeline, Chunking & Embeddings
export * from './ingestion';

// Domain Event Memory Subscribers
export * from './subscribers';
