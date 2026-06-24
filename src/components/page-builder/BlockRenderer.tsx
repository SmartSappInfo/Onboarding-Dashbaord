'use client';

/**
 * The single recursive renderer for a block tree, shared by the editor canvas
 * (`mode="edit"`) and the published page (`mode="view"`). It looks each block up
 * in the registry, parses its props defensively (never throws — Risk R4), and
 * delegates to the block's own `render`. Unknown block types degrade to a
 * non-breaking fallback instead of crashing the page.
 */
import React from 'react';
import { getBlock, type BlockRenderContext } from '@/lib/page-builder/registry';
import type { PageBlock } from '@/lib/types';

interface BlockRendererProps {
  block: PageBlock;
  ctx: BlockRenderContext;
}

function UnknownBlock({ type, mode }: { type: string; mode: BlockRenderContext['mode'] }) {
  if (mode !== 'edit') return null;
  return (
    <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center">
      <p className="text-xs font-medium text-slate-400">Unknown block: {type}</p>
    </div>
  );
}

export const BlockRenderer = React.memo(function BlockRenderer({ block, ctx }: BlockRendererProps) {
  const def = getBlock(block.type);
  if (!def) {
    return <UnknownBlock type={block.type} mode={ctx.mode} />;
  }

  const parsed = def.schema.safeParse({ ...def.defaults, ...block.props });
  const props = parsed.success ? parsed.data : def.defaults;

  // Layout blocks render their nested children through the same renderer.
  const renderCtx: BlockRenderContext = def.allowsChildren
    ? {
        ...ctx,
        renderChildren: () =>
          (block.blocks ?? []).map((child) => (
            <BlockRenderer key={child.id} block={child} ctx={ctx} />
          )),
      }
    : ctx;

  return def.render(props, block, renderCtx);
});
