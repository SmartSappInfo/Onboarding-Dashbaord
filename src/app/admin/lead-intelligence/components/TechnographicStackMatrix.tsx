'use client';

/**
 * Categorized Technology Stack Matrix (Lead Intelligence 2.0 - Phase 4)
 * UI Spec Section 30 & 31: Technographic Badges and Matrix
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 5 Structured Dimensions: CMS, Payments, Subdomains/Portals, Communication, Analytics.
 * 2. Gap Alerting: Highlights payment collection and missing portal gaps to arm sales reps.
 * 3. Mobile Responsive: Grid flows from 1 column on mobile to 2 columns on tablet/desktop.
 * 4. Zero `any` or `any[]` typing.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  CreditCard, 
  Layers, 
  MessageSquare, 
  BarChart3, 
  AlertTriangle, 
  Lock,
  ArrowUpRight
} from 'lucide-react';
import type { CategorizedTechStack } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface TechnographicStackMatrixProps {
  techStack: CategorizedTechStack;
  className?: string;
}

export const TechnographicStackMatrix: React.FC<TechnographicStackMatrixProps> = ({
  techStack,
  className
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Payment Gap Alert Banner */}
      {techStack.paymentGapDetected && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-0.5 text-xs">
            <span className="font-bold block">Critical Opportunity: Payment Gap Detected</span>
            <p className="text-muted-foreground leading-relaxed">
              This institution displays e-commerce or admission flows but has <strong className="text-amber-600 dark:text-amber-400">no detected online payment gateway</strong> (Paystack/Flutterwave/Stripe). High pitch potential for SmartSapp Fee Collection!
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category 1: CMS & Frameworks */}
        <Card className="bg-card/70 border border-border/70 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <CardTitle className="text-xs font-bold text-foreground">CMS & Frameworks</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {techStack.cms.length} Found
            </Badge>
          </CardHeader>
          <CardContent className="p-4">
            {techStack.cms.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {techStack.cms.map((item, idx) => (
                  <Badge 
                    key={idx} 
                    className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-1 rounded-xl font-medium"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">No primary CMS framework detected.</span>
            )}
          </CardContent>
        </Card>

        {/* Category 2: Payment Gateways */}
        <Card className="bg-card/70 border border-border/70 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-xs font-bold text-foreground">Payment Gateways</CardTitle>
            </div>
            <Badge 
              className={cn(
                "text-[10px] font-mono",
                techStack.payments.length > 0 
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              {techStack.payments.length > 0 ? 'Integrated' : 'None Detected'}
            </Badge>
          </CardHeader>
          <CardContent className="p-4">
            {techStack.payments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {techStack.payments.map((item, idx) => (
                  <Badge 
                    key={idx} 
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs px-2.5 py-1 rounded-xl font-medium"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Manual cash / bank deposit receipts only.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category 3: Subdomain Portals */}
        <Card className="bg-card/70 border border-border/70 rounded-2xl shadow-xs overflow-hidden md:col-span-2">
          <CardHeader className="p-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-sky-500" />
              <CardTitle className="text-xs font-bold text-foreground">Subdomains & Digital Portals</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {techStack.portals.length} Probed
            </Badge>
          </CardHeader>
          <CardContent className="p-4">
            {techStack.portals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {techStack.portals.map((portal, idx) => (
                  <a
                    key={idx}
                    href={portal.fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors flex items-start justify-between group"
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-foreground truncate">
                          {portal.subdomain}.*
                        </span>
                        {portal.status === 'online' && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] px-1.5 py-0">
                            200 OK
                          </Badge>
                        )}
                        {portal.status === 'auth_required' && (
                          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[9px] px-1.5 py-0 flex items-center gap-0.5">
                            <Lock className="h-2 w-2" /> Auth
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {portal.title || portal.portalType || 'Active Subdomain'}
                      </p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                No active subdomains discovered (e.g. portal., admissions., moodle.).
              </span>
            )}
          </CardContent>
        </Card>

        {/* Category 4: Communication Widgets */}
        <Card className="bg-card/70 border border-border/70 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <CardTitle className="text-xs font-bold text-foreground">Communication Widgets</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {techStack.communication.length} Active
            </Badge>
          </CardHeader>
          <CardContent className="p-4">
            {techStack.communication.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {techStack.communication.map((item, idx) => (
                  <Badge 
                    key={idx} 
                    className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-xs px-2.5 py-1 rounded-xl font-medium"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">No live chat or WhatsApp widget detected.</span>
            )}
          </CardContent>
        </Card>

        {/* Category 5: Analytics & Pixels */}
        <Card className="bg-card/70 border border-border/70 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-500" />
              <CardTitle className="text-xs font-bold text-foreground">Analytics & Tracking</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {techStack.analytics.length} Tagged
            </Badge>
          </CardHeader>
          <CardContent className="p-4">
            {techStack.analytics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {techStack.analytics.map((item, idx) => (
                  <Badge 
                    key={idx} 
                    className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-xs px-2.5 py-1 rounded-xl font-medium"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">No analytics or pixel trackers detected.</span>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
