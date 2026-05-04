'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrainCircuit, Layout, Trophy, ArrowRight, Sparkles, Percent, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import ResultRuleManager from './result-rule-manager';
import ResultPageBuilder from './result-page-builder';
import { MinimalRespondentMessage, MinimalThankYouPage } from './minimal-results-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

function LogicSimulator() {
    const { watch } = useFormContext();
    const [testScore, setTestScore] = React.useState<number>(0);
    
    const rules = watch('resultRules') || [];
    const pages = watch('resultPages') || [];
    const scoringEnabled = watch('scoringEnabled');
    const maxScore = watch('maxScore') || 100;
    const scoreDisplayMode = watch('scoreDisplayMode') || 'points';

    if (!scoringEnabled) return null;

    const matchedRule = [...rules]
        .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
        .find((r: any) => testScore >= (r.minScore || 0) && testScore <= (r.maxScore || 0));
    
    const matchedPage = pages.find((p: any) => p.id === matchedRule?.pageId);

    const formattedValue = scoreDisplayMode === 'percentage' 
        ? `${Math.round((testScore / maxScore) * 100)}%` 
        : `${testScore} PTS`;

    return (
 <Card className="rounded-2xl border border-primary/20 bg-primary/5 mb-8 overflow-hidden relative">
 <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles size={120} />
            </div>
 <CardHeader className="bg-muted/10 border-b py-5 px-6">
 <CardTitle className="text-sm font-semibold flex items-center gap-2">
 <BrainCircuit className="h-4 w-4 text-primary" /> Outcome Simulator
                </CardTitle>
            </CardHeader>
            <CardContent>
 <div className="flex flex-col sm:flex-row items-center gap-4">
 <div className="w-full sm:w-32">
 <Label className="text-sm font-semibold mb-1 block">Test Score (Points)</Label>
 <Input 
                             type="number" 
                             value={testScore} 
                             onChange={(e) => setTestScore(Number(e.target.value))} 
                             className="bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 font-semibold text-xl h-12 text-center rounded-xl"
                        />
                    </div>
 <div className="shrink-0 pt-4 hidden sm:block">
 <ArrowRight className="h-6 w-6 text-muted-foreground/30" />
                    </div>
 <div className="flex-grow w-full">
 <Label className="text-sm font-semibold mb-1 block">Public Perspective ({scoreDisplayMode})</Label>
 <div className={cn(
                            "h-12 flex items-center px-4 rounded-md border transition-all",
                            matchedRule ? "bg-background border-primary shadow-sm" : "bg-background0 border-dashed"
                        )}>
                            {matchedRule ? (
 <div className="flex items-center justify-between w-full">
 <div className="flex items-center gap-2">
 <Trophy className="h-4 w-4 text-yellow-500" />
 <span className="font-bold text-foreground truncate max-w-[150px]">{matchedRule.label}</span>
                                        <Badge className="ml-2 font-semibold tabular-nums bg-emerald-50 text-emerald-600 border-emerald-100">{formattedValue}</Badge>
                                    </div>
                                    <Badge variant="outline" className="ml-2 font-bold bg-primary/10 text-primary border-primary/20">
                                        → {matchedPage?.name || 'Default Result'}
                                    </Badge>
                                </div>
                            ) : (
 <span className="text-muted-foreground text-sm italic">No matching rule found. Falling back to default.</span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ResultsStep() {
    const { watch, setValue, control } = useFormContext();
    const scoringEnabled = watch('scoringEnabled');
    const scoreDisplayMode = watch('scoreDisplayMode') || 'points';

    return (
 <div className="space-y-8">
            <Card className="rounded-2xl border border-border bg-card overflow-hidden">
 <div className="flex items-center justify-between p-6">
 <div className="flex items-center gap-4">
 <div className={cn(
                            "p-3 rounded-2xl transition-all duration-500", 
                            scoringEnabled ? "bg-yellow-500 text-white shadow-lg shadow-yellow-500/20 rotate-3" : "bg-muted text-muted-foreground"
                        )}>
 <Trophy className="h-6 w-6" />
                        </div>
 <div className="space-y-0.5">
 <Label className="text-base font-semibold tracking-tight">Scoring Engine</Label>
 <p className="text-[10px] text-muted-foreground font-semibold tracking-tighter">Enable logic-based survey scoring</p>
                        </div>
                    </div>
                    <Switch 
                        checked={!!scoringEnabled} 
                        onCheckedChange={(val) => setValue('scoringEnabled', val, { shouldDirty: true })} 
                        className="scale-125 data-[state=checked]:bg-yellow-500"
                    />
                </div>
                {scoringEnabled && (
 <CardContent className="space-y-8">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
 <div className="flex items-center gap-4 p-4 rounded-xl border bg-muted/30">
 <div className="grid gap-1.5 flex-1">
 <Label htmlFor="max-score" className="text-sm font-semibold">Total Possible Score</Label>
 <div className="flex items-center gap-2">
                                        <Input 
                                            id="max-score" 
                                            type="number" 
                                            value={watch('maxScore')} 
                                            onChange={(e) => setValue('maxScore', parseInt(e.target.value, 10) || 0, { shouldDirty: true })}
                                            className="max-w-[120px] font-bold text-lg rounded-xl bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30" 
                                        />
 <span className="text-xs text-muted-foreground font-medium italic">Max points available.</span>
                                    </div>
                                </div>
                            </div>

 <div className="flex items-center gap-4 p-4 rounded-xl border bg-muted/30">
 <div className="grid gap-1.5 flex-1">
 <Label className="text-sm font-semibold">Score Presentation</Label>
                                    <Controller
                                        name="scoreDisplayMode"
                                        control={control}
                                        render={({ field }) => (
 <div className="grid grid-cols-2 gap-2 bg-background p-1 rounded-xl border shadow-inner">
                                                <button
                                                    type="button"
                                                    onClick={() => field.onChange('points')}
 className={cn(
                                                        "h-9 rounded-lg font-semibold uppercase text-[10px]  transition-all flex items-center justify-center gap-2",
                                                        field.value === 'points' ? "bg-primary text-white shadow-md" : "text-muted-foreground opacity-60 hover:opacity-100"
                                                    )}
                                                >
 <Hash className="h-3 w-3" /> Points
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => field.onChange('percentage')}
 className={cn(
                                                        "h-9 rounded-lg font-semibold uppercase text-[10px]  transition-all flex items-center justify-center gap-2",
                                                        field.value === 'percentage' ? "bg-primary text-white shadow-md" : "text-muted-foreground opacity-60 hover:opacity-100"
                                                    )}
                                                >
 <Percent className="h-3 w-3" /> Percent
                                                </button>
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {scoringEnabled ? (
                <>
                    <LogicSimulator />

 <Tabs defaultValue="logic" className="w-full">
 <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/30 p-1 border rounded-xl">
 <TabsTrigger value="logic" className="gap-2 font-bold py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
 <BrainCircuit className="h-4 w-4" /> Outcome Logic
                    </TabsTrigger>
 <TabsTrigger value="pages" className="gap-2 font-bold py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
 <Layout className="h-4 w-4" /> Result Pages
                    </TabsTrigger>
                </TabsList>
 <TabsContent value="logic" className="pt-6">
                    <ResultRuleManager />
                </TabsContent>
 <TabsContent value="pages" className="pt-6">
                    <ResultPageBuilder />
                </TabsContent>
                </Tabs>
                </>
            ) : (
                <div className="space-y-8">
                    <MinimalRespondentMessage />
                    <MinimalThankYouPage />
                </div>
            )}
        </div>
    );
}
