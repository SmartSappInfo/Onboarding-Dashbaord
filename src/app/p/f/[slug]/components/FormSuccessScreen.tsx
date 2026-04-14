'use client';

import React, { useEffect } from 'react';
import { Form } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface FormSuccessScreenProps {
  form: Form;
}

export default function FormSuccessScreen({ form }: FormSuccessScreenProps) {
  const { type, value } = form.successBehavior;

  useEffect(() => {
    if (type === 'redirect' && value) {
      window.location.href = value;
    }
  }, [type, value]);

  if (type === 'redirect') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-slate-600 font-medium">Redirecting you...</p>
          <p className="text-xs text-slate-400">If you are not redirected automatically, <a href={value} className="underline text-primary">click here</a>.</p>
        </div>
      </div>
    );
  }

  const theme = form.theme;
  const isGlass = theme.backgroundStyle === 'glass';
  const radiusMap: Record<string, string> = { none: 'rounded-none', small: 'rounded-md', medium: 'rounded-xl', large: 'rounded-3xl' };
  const cardRadius = radiusMap[theme.borderRadius || 'medium'];
  const cardWidthClass = theme.cardWidth === 'sm' ? 'max-w-md' : theme.cardWidth === 'lg' ? 'max-w-4xl' : 'max-w-2xl';

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen transition-all duration-500">
      <div className={cn(
        "w-full transition-all duration-700 animate-in fade-in zoom-in-95",
        cardWidthClass,
        isGlass ? "glass shadow-2xl border border-white/20 p-12 sm:p-20" : "bg-white shadow-xl border border-slate-200 p-12 sm:p-20",
        cardRadius,
        "text-center"
      )}>
        
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full scale-150 animate-pulse"></div>
            <div className="relative bg-green-500 text-white rounded-full p-4 shadow-lg">
              <CheckCircle2 className="h-12 w-12" />
            </div>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-6">
          Thank You!
        </h1>
        
        <div className="prose prose-slate max-w-none text-slate-600 text-lg mb-10 leading-relaxed font-medium">
          {value || 'Your response has been successfully recorded. We appreciate your time!'}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="h-12 px-8 font-bold border-2"
             >
                Submit another response
             </Button>
             
             <Button 
                asChild
                className="h-12 px-8 font-bold shadow-md hover:shadow-lg transition-all"
                style={{ backgroundColor: theme.accentColor }}
             >
                <Link href="/">
                    Go Home <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
             </Button>
        </div>

        <div className="mt-16 text-center text-slate-400 text-xs font-medium uppercase tracking-widest">
          Powered by <span className="text-slate-600 font-bold">SmartSapp</span>
        </div>
      </div>
    </div>
  );
}
