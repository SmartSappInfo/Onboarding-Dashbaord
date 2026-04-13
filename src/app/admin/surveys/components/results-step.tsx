'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrainCircuit, Layout, Trophy, ArrowRight, Sparkles, Percent, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import ResultRuleManager from './result-rule-manager';
import ResultPageBuilder from './result-page-builder';
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
 <Card className="bg-primary/5 border-primary/20 mb-8 overflow-hidden relative">
 <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles size={120} />
            </div>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-semibold flex items-center gap-2">
 <BrainCircuit className="h-4 w-4 text-primary" /> Outcome Simulator
                </CardTitle>
                <CardDescription>Test your scoring logic by entering a simulated score.</CardDescription>
            </CardHeader>
            <CardContent>
 <div className="flex flex-col sm:flex-row items-center gap-4">
 <div className="w-full sm:w-32">
 <Label className="text-[10px] font-bold mb-1 block text-muted-foreground">Test Score (Points)</Label>
                        <Input 
                            type="number" 
                            value={testScore} 
                            onChange={(e) => setTestScore(Number(e.target.value))} 
 className="bg-background font-semibold text-xl h-12 text-center"
                        />
                    </div>
 <div className="shrink-0 pt-4 hidden sm:block">
 <ArrowRight className="h-6 w-6 text-muted-foreground/30" />
                    </div>
 <div className="flex-grow w-full">
 <Label className="text-[10px] font-bold mb-1 block text-muted-foreground">Public Perspective ({scoreDisplayMode})</Label>
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
            <Card>
                <CardHeader>
 <div className="flex items-center justify-between">
 <div className="space-y-1">
 <CardTitle className="flex items-center gap-2 text-xl font-semibold">
 <Trophy className="h-6 w-6 text-yellow-500" /> Scoring Engine
                            </CardTitle>
                            <CardDescription>Enable scoring to provide tailored results based on survey answers.</CardDescription>
                        </div>
                        <Switch 
                            checked={!!scoringEnabled} 
                            onCheckedChange={(val) => setValue('scoringEnabled', val, { shouldDirty: true })} 
                        />
                    </div>
                </CardHeader>
                {scoringEnabled && (
 <CardContent className="space-y-8">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
 <div className="flex items-center gap-4 p-4 rounded-xl border bg-muted/30">
 <div className="grid gap-1.5 flex-1">
 <Label htmlFor="max-score" className="text-xs font-bold text-muted-foreground ">Total Possible Score</Label>
 <div className="flex items-center gap-2">
                                        <Input 
                                            id="max-score" 
                                            type="number" 
                                            value={watch('maxScore')} 
                                            onChange={(e) => setValue('maxScore', parseInt(e.target.value, 10) || 0, { shouldDirty: true })}
 className="max-w-[120px] font-bold text-lg rounded-xl" 
                                        />
 <span className="text-xs text-muted-foreground font-medium italic">Max points available.</span>
                                    </div>
                                </div>
                            </div>

 <div className="flex items-center gap-4 p-4 rounded-xl border bg-muted/30">
 <div className="grid gap-1.5 flex-1">
 <Label className="text-xs font-bold text-muted-foreground ">Score Presentation</Label>
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

            <LogicSimulator />

 <Tabs defaultValue="logic" className="w-full">
 <TabsList className="grid w-full grid-cols-2 h-12 bg-background0 p-1 border">
 <TabsTrigger value="logic" className="gap-2 font-bold py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
 <BrainCircuit className="h-4 w-4" /> Outcome Logic
                    </TabsTrigger>
 <TabsTrigger value="pages" className="gap-2 font-bold py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
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
        </div>
    );
}
