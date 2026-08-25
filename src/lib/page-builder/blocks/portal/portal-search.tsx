import React from 'react';
import { z } from 'zod';
import { Search, Sparkles } from 'lucide-react';
import { registerBlock } from '../../registry';

const schema = z.object({
  placeholder: z.string().default('Search lessons, articles, documentation, or downloads...'),
  popularKeywords: z.array(z.string()).default([]),
}).catchall(z.unknown());

type PortalSearchProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_search',
  label: 'Portal: Search Bar',
  category: 'portal',
  icon: Search,
  fields: [
    { kind: 'text', key: 'placeholder', label: 'Placeholder Text' },
    {
      kind: 'list',
      key: 'popularKeywords',
      label: 'Popular Keywords',
      itemFields: [{ kind: 'text', key: 'keyword', label: 'Keyword' }],
    },
  ],
  defaults: schema.parse({
    placeholder: 'Search courses, guides, articles, policies, or templates...',
    popularKeywords: ['Invoicing', 'Fee Collection', 'Mobile Money', 'Admissions', 'WhatsApp Automation'],
  }),
  schema,
  render: (props: PortalSearchProps, _block, ctx) => {
    return (
      <div className="py-6 space-y-3 max-w-2xl mx-auto w-full">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder={props.placeholder}
            className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-border bg-card shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {props.popularKeywords.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <span className="font-semibold text-[11px]">Popular:</span>
            {props.popularKeywords.map((kw, idx) => {
              const text = typeof kw === 'string' ? kw : (kw as any).keyword;
              return (
                <button
                  key={idx}
                  type="button"
                  className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-medium text-foreground transition-colors"
                >
                  {text}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
});
