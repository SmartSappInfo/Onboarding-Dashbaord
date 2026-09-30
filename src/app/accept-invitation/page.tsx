import * as React from 'react';
import { Suspense } from 'react';
import { AcceptInvitationClient } from './AcceptInvitationClient';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Accept Invitation | SmartSapp Workforce',
  description: 'Activate your organization membership account',
};

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-b from-background via-muted/20 to-background">
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Loading invitation...</p>
          </div>
        </div>
      }
    >
      <AcceptInvitationClient />
    </Suspense>
  );
}
