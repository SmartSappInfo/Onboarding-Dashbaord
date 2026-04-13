'use client';

import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { SmartSappLogo } from '@/components/icons';

interface AuthorizationLoaderProps {
  status: 'checking' | 'success' | 'failed';
}

const statusConfig = {
  checking: {
 icon: <Loader2 className="h-8 w-8 animate-spin text-primary" />,
    message: 'Checking Authorization...',
  },
  success: {
 icon: <CheckCircle className="h-8 w-8 text-green-500" />,
    message: 'Authorization Successful! Loading dashboard...',
  },
  failed: {
 icon: <XCircle className="h-8 w-8 text-destructive" />,
    message: 'Authorization Failed. Redirecting...',
  },
};

export default function AuthorizationLoader({ status }: AuthorizationLoaderProps) {
  const { icon, message } = statusConfig[status];

  return (
 <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background" suppressHydrationWarning>
 <div className="flex flex-col items-center gap-6">
 <SmartSappLogo className="h-12" />
 <div className="flex items-center gap-4">
          {icon}
 <p className="text-lg font-medium text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
