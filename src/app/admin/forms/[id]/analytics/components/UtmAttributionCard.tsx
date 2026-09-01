'use client';

/**
 * SmartSapp Forms 2.0: Traffic & UTM Campaign Attribution
 * 
 * Provides tabbed breakdown of traffic and conversions by UTM Source, Medium,
 * Campaign, and Referrer domain.
 */

import React, { useState } from 'react';
import { Target, Globe, Compass, Share2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { UtmAttributionSummary, UtmAttributionItem } from '@/lib/forms/form-analytics-types';

interface UtmAttributionCardProps {
  attribution: UtmAttributionSummary;
}

export default function UtmAttributionCard({ attribution }: UtmAttributionCardProps) {
  const [activeTab, setActiveTab] = useState('sources');

  const renderItemList = (items: UtmAttributionItem[], emptyLabel: string) => {
    if (!items || items.length === 0) {
      return (
        <div className="py-8 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      );
    }

    const maxVisitors = Math.max(...items.map(i => i.visitors), 1);

    return (
      <div className="space-y-3.5 pt-2">
        {items.map((item, idx) => {
          const percentOfMax = Math.round((item.visitors / maxVisitors) * 100);
          return (
            <div key={`${item.name}_${idx}`} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground truncate max-w-[200px]">
                  {item.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-semibold">
                    {item.visitors.toLocaleString()} visits
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    {item.conversionRate}% conv
                  </Badge>
                </div>
              </div>
              <Progress value={percentOfMax} className="h-1.5 rounded-full bg-muted/40 [&>div]:bg-primary" />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              Traffic & Campaign Attribution
            </CardTitle>
            <CardDescription className="text-xs">
              Attribution breakdown by UTM campaign tags and referrer domains.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 h-9 p-1 rounded-2xl bg-muted/30 border border-border/40">
            <TabsTrigger value="sources" className="text-xs rounded-xl font-bold">
              Source
            </TabsTrigger>
            <TabsTrigger value="mediums" className="text-xs rounded-xl font-bold">
              Medium
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="text-xs rounded-xl font-bold">
              Campaign
            </TabsTrigger>
            <TabsTrigger value="referrers" className="text-xs rounded-xl font-bold">
              Referrer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources">
            {renderItemList(attribution?.sources || [], 'No UTM sources recorded in this date range.')}
          </TabsContent>

          <TabsContent value="mediums">
            {renderItemList(attribution?.mediums || [], 'No UTM mediums recorded in this date range.')}
          </TabsContent>

          <TabsContent value="campaigns">
            {renderItemList(attribution?.campaigns || [], 'No UTM campaigns recorded in this date range.')}
          </TabsContent>

          <TabsContent value="referrers">
            {renderItemList(attribution?.referrers || [], 'No external referrers recorded in this date range.')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
