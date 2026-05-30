'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainerNarrow } from '@/components/ui/page-container';

export default function VariablesPage() {
  const router = useRouter();
  const [countdown, setCountdown] = React.useState(5);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/admin/settings/fields');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <PageContainerNarrow>
      <div className="flex items-center justify-center min-h-[60vh] px-4 py-12">
      <Card className="w-full max-w-lg border border-yellow-500/20 shadow-xl bg-gradient-to-b from-card to-background relative overflow-hidden backdrop-blur-md">
        {/* Top glowing ambient border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />
        
        <CardHeader className="pt-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
              <AlertCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">Registry Has Moved</CardTitle>
              <CardDescription className="text-sm mt-1">Messaging Variables Deprecation</CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 py-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The messaging variables registry has been consolidated into the unified{' '}
            <strong className="text-foreground font-semibold">Fields & Variables Manager</strong> under Settings. 
            Variables should now come from structured native or custom fields, unifying them across forms, messaging, automations, and campaigns.
          </p>
          
          <div className="p-3.5 rounded-lg bg-muted/50 border border-border/60 text-xs text-muted-foreground flex items-start gap-2.5">
            <Settings className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">What changed?</span>
              <p className="mt-1 leading-normal">
                You can now view, create, and manage variables alongside fields, view usage counts, copy standard placeholders (e.g. <code className="px-1 py-0.5 rounded bg-muted-foreground/10 text-foreground font-mono">{"{{contact_name}}"}</code>), and customize validation rules.
              </p>
            </div>
          </div>

          <div className="h-1 w-full bg-muted overflow-hidden rounded-full relative">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-1000 ease-linear rounded-full" 
              style={{ width: `${(countdown / 5) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center animate-pulse">
            Redirecting to settings in {countdown} seconds...
          </p>
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row gap-3 pt-4 pb-8 justify-end border-t border-border/40 bg-muted/20">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/admin/settings/fields')}
          >
            Go immediately
          </Button>
          <Button 
            size="sm" 
            className="w-full sm:w-auto text-xs font-semibold bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black border border-yellow-400/20"
            onClick={() => router.push('/admin/settings/fields')}
          >
            Go to Fields Settings
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </CardFooter>
      </Card>
    </div>
    </PageContainerNarrow>
  );
}
