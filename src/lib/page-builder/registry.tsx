/**
 * The block registry — the single source of truth for every block type.
 *
 * Each block is defined ONCE as a `BlockDefinition` (`fields`, `defaults`,
 * `schema`, `render`). The editor canvas, the property panel, and the published
 * page all read from this registry, which is what makes the builder WYSIWYG and
 * eliminates the historical "two divergent renderers" problem.
 *
 * Concrete block definitions are registered in `./blocks/*` (Phase 2+).
 */
import type { ReactElement, ReactNode, ComponentType } from 'react';
import type { ZodType } from 'zod';
import type {
  BuilderResources,
  PageBlock,
  PageBlockType,
  ResolvedTheme,
} from '@/lib/types';
import type { BlockField } from './fields';

export type BlockMode = 'edit' | 'view';

/** Everything a block's `render` needs beyond its own props. */
export interface BlockRenderContext {
  mode: BlockMode;
  theme: ResolvedTheme;
  /** Substitutes `{{key}}` tokens (e.g. UTM params) in author text. */
  interpolate: (text: string) => string;
  /** Read-only resources (forms/surveys/agreements) a block may reference. */
  resources: BuilderResources;
  /** Inline edit callback — present only in `edit` mode. */
  onPropChange?: (patch: Record<string, unknown>) => void;
  /** Fires a page trigger — present only in `view` mode. */
  fireTrigger?: (event: string, blockId?: string) => void;
  /** Renders nested children for layout blocks (`allowsChildren`). */
  renderChildren?: (slot?: string) => ReactNode;
}

export interface BlockDefinition<TProps extends Record<string, unknown>> {
  type: PageBlockType;
  label: string;
  category: 'layout' | 'content' | 'data' | 'embed';
  icon: ComponentType<{ className?: string }>;
  fields: ReadonlyArray<BlockField>;
  defaults: TProps;
  schema: ZodType<TProps>;
  /** Layout blocks that accept nested blocks (columns/container/grid). */
  allowsChildren?: boolean;
  render: (props: TProps, block: PageBlock, ctx: BlockRenderContext) => ReactElement;
}

/**
 * Type-erased definition for heterogeneous storage in the registry map. We use
 * `Record<string, unknown>` (never `any`) so block bodies stay fully typed via
 * their own `TProps`, while the map can hold many block kinds.
 */
export type AnyBlockDefinition = BlockDefinition<Record<string, unknown>>;

export const blockRegistry: Partial<Record<PageBlockType, AnyBlockDefinition>> = {};

/**
 * Register (or replace) a block definition. Call from `./blocks/*`.
 *
 * Generic so each block passes its own precisely-typed `BlockDefinition<TProps>`
 * (keeping block bodies fully typed). The single type-erasure cast lives here —
 * never `any`, and never leaked to callers.
 */
export function registerBlock<TProps extends Record<string, unknown>>(
  def: BlockDefinition<TProps>,
): void {
  blockRegistry[def.type] = def as unknown as AnyBlockDefinition;
}

/** Look up a block definition by type, or `undefined` if unregistered. */
export function getBlock(type: PageBlockType): AnyBlockDefinition | undefined {
  return blockRegistry[type];
}

/** All registered definitions, useful for building the palette. */
export function allBlocks(): AnyBlockDefinition[] {
  return Object.values(blockRegistry).filter(
    (def): def is AnyBlockDefinition => def !== undefined,
  );
}
