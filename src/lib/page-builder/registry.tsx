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
import type { ZodType, ZodTypeDef } from 'zod';
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
  viewport?: 'desktop' | 'tablet' | 'mobile';
  themeMode?: 'light' | 'dark';
  /** Substitutes `{{key}}` tokens (e.g. UTM params) in author text. */
  interpolate: (text: string) => string;
  /** Read-only resources (forms/surveys/agreements) a block may reference. */
  resources: BuilderResources;
  /** Inline edit callback — present only in `edit` mode. */
  onPropChange?: (patch: Record<string, unknown>) => void;
  /** Fires a page trigger — present only in `view` mode. */
  fireTrigger?: (event: string, blockId?: string) => void;
  /** Identity of the host page, required by embed blocks (form submission). */
  page?: { id: string; organizationId: string; workspaceId: string };
  /** Whether custom-code (`html`) blocks may render — gated by page settings. */
  allowScripts?: boolean;
  /** Whether page is being rendered inside listview/thumbnail mode */
  isThumbnail?: boolean;
  /** Rendered nested children, one node per child block (layout blocks). */
  renderChildren?: () => ReactNode[];
}

export interface BlockVariant {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly thumbnail: React.ReactElement;
  readonly defaults: Record<string, unknown>;
}

export interface BlockDefinition<TProps extends Record<string, unknown>> {
  type: PageBlockType;
  label: string;
  category: 'layout' | 'content' | 'data' | 'embed' | 'portal';
  icon: ComponentType<{ className?: string }>;
  fields: ReadonlyArray<BlockField>;
  defaults: TProps;
  /**
   * Validates stored props → `TProps`. Input is `unknown` because props are
   * parsed from arbitrary persisted data, and because zod `.default()` makes a
   * field's input optional (so the schema's input type is never exactly TProps).
   */
  schema: ZodType<TProps, ZodTypeDef, unknown>;
  /** Layout blocks that accept nested blocks (columns/container/grid). */
  allowsChildren?: boolean;
  variants?: ReadonlyArray<BlockVariant>;
  
  // Phase 1 Extensions for AI Experience Platform & Analytics Normalization
  aiInstructions?: string;
  analyticsEvents?: ReadonlyArray<string>;
  accessibilityRules?: ReadonlyArray<string>;
  responsiveConfig?: Record<string, unknown>;

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

/**
 * Maps raw, PascalCase, hyphenated, or semantic block type aliases to canonical PageBlockType.
 * Eliminates "Unknown block: HeroSection" failures when AI or external templates use legacy naming.
 *
 * CAUTION FOR MAINTAINERS:
 * When adding new blocks to PageBlockType, ensure any relevant shorthand or PascalCase
 * aliases are mapped here to preserve backward compatibility and resilient AI generation.
 */
export function normalizeBlockType(rawType: string): PageBlockType {
  if (!rawType) return 'text';
  const clean = rawType.trim();

  // Exact match fast-path against registered types
  if (clean in blockRegistry) {
    return clean as PageBlockType;
  }

  const normalized = clean.toLowerCase().replace(/[-_\s]+/g, '');

  switch (normalized) {
    case 'herosection':
    case 'hero':
    case 'banner':
    case 'mainhero':
    case 'heroheader':
      return 'hero';

    case 'videoherosection':
    case 'videohero':
      return 'video_hero';

    case 'textcontentsection':
    case 'textsection':
    case 'text':
    case 'content':
    case 'paragraph':
    case 'prose':
    case 'richtext':
      return 'text';

    case 'featuresgridsection':
    case 'featuresgrid':
    case 'featurecards':
    case 'features':
    case 'choicecards':
    case 'choicecard':
    case 'gridfeatures':
    case 'cardgrid':
      return 'choice_cards';

    case 'testimonialsection':
    case 'testimonialgrid':
    case 'testimonialsgrid':
    case 'reviews':
    case 'feedback':
      return 'testimonial_grid';

    case 'singletestimonial':
    case 'testimonial':
    case 'quote':
      return 'testimonial';

    case 'faqsection':
    case 'faq':
    case 'accordion':
    case 'questions':
    case 'faqs':
      return 'faq';

    case 'stepsection':
    case 'steps':
    case 'step':
    case 'process':
      return 'step_section';

    case 'proceduresection':
    case 'procedurelist':
    case 'procedure':
    case 'numberedlist':
      return 'procedure_list';

    case 'ctasection':
    case 'cta':
    case 'calltoaction':
    case 'actionbanner':
      return 'cta';

    case 'statssection':
    case 'stats':
    case 'metrics':
    case 'kpi':
    case 'stat':
      return 'stats';

    case 'titlesection':
    case 'title':
    case 'heading':
    case 'sectionheading':
    case 'headline':
      return 'title';

    case 'logogrid':
    case 'logos':
    case 'partners':
    case 'clients':
      return 'logo_grid';

    case 'columns':
    case 'row':
    case 'grid':
    case 'twocolumns':
    case 'threecolumns':
      return 'columns';

    case 'container':
    case 'box':
    case 'wrapper':
    case 'sectioncontainer':
      return 'container';

    case 'appdownload':
    case 'downloadapp':
      return 'app_download';

    case 'countdown':
    case 'countdowntimer':
    case 'timer':
      return 'countdown';

    case 'image':
    case 'picture':
    case 'photo':
      return 'image';

    case 'video':
    case 'videoembed':
      return 'video';

    case 'divider':
    case 'separator':
    case 'line':
      return 'divider';

    case 'spacer':
    case 'whitespace':
    case 'gap':
      return 'spacer';

    case 'form':
    case 'contactform':
    case 'leadform':
      return 'form';

    case 'survey':
    case 'quiz':
      return 'survey';

    case 'agreement':
    case 'terms':
    case 'contract':
      return 'agreement';

    case 'meeting':
    case 'booking':
    case 'calendly':
      return 'meeting';

    case 'qr':
    case 'qrcode':
      return 'qr';

    case 'paymentmethods':
    case 'paymentmethod':
    case 'payments':
      return 'payment_methods';

    default:
      // Return raw normalized string to allow UnknownBlock degradation on unregistered blocks
      return clean as PageBlockType;
  }
}

/** Look up a block definition by type, or `undefined` if unregistered. Normalizes aliases defensively. */
export function getBlock(type: PageBlockType | string): AnyBlockDefinition | undefined {
  const canonical = normalizeBlockType(type);
  return blockRegistry[canonical];
}

/** Returns an array of all currently registered block definitions. */
export function getAllRegisteredBlocks(): AnyBlockDefinition[] {
  return Object.values(blockRegistry).filter((b): b is AnyBlockDefinition => Boolean(b));
}

/** Returns registered block definitions matching the specified category. */
export function getBlocksByCategory(category: 'layout' | 'content' | 'data' | 'embed'): AnyBlockDefinition[] {
  return getAllRegisteredBlocks().filter((b) => b.category === category);
}

/**
 * Validates arbitrary block props against the block definition's Zod schema O(1).
 * Returns safe parsed props or fallback defaults on error without throwing.
 */
export function validateBlockProps(block: PageBlock): Record<string, unknown> {
  const canonical = normalizeBlockType(block.type);
  const def = getBlock(canonical);
  if (!def) {
    return block.props || {};
  }
  const result = def.schema.safeParse(block.props);
  return result.success ? (result.data as Record<string, unknown>) : def.defaults;
}

/** All registered definitions, useful for building the palette. */
export function allBlocks(): AnyBlockDefinition[] {
  return Object.values(blockRegistry).filter(
    (def): def is AnyBlockDefinition => def !== undefined,
  );
}

