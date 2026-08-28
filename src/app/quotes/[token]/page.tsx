import type { Metadata } from 'next';
import PublicQuoteClient from './PublicQuoteClient';
import { getPublicQuoteByTokenAction } from '@/app/actions/deal-line-item-actions';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PublicQuotePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PublicQuotePageProps): Promise<Metadata> {
  const { token } = await params;
  const res = await getPublicQuoteByTokenAction(token);

  if (!res.success || !res.quote) {
    return {
      title: 'Commercial Proposal Not Found',
      robots: { index: false, follow: false },
    };
  }

  const { quote } = res;
  return {
    title: `Commercial Proposal ${quote.quoteNumber} | ${quote.entityName || 'SmartSapp'}`,
    description: `Formal commercial proposal and pricing schedule for ${quote.entityName || 'our client'}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicQuotePage({ params }: PublicQuotePageProps) {
  const { token } = await params;
  const res = await getPublicQuoteByTokenAction(token);

  if (!res.success || !res.quote) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-3xl bg-background border border-border/80 shadow-xl space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <FileText className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-black text-foreground tracking-tight">Proposal Not Found</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This commercial proposal link is invalid, has expired, or was removed by the sender.
            </p>
          </div>
          <div className="pt-2">
            <Button asChild variant="outline" className="rounded-xl text-xs font-bold gap-2">
              <Link href="/">
                <ArrowLeft className="h-3.5 w-3.5" /> Return Home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <PublicQuoteClient initialQuote={res.quote} token={token} />;
}
