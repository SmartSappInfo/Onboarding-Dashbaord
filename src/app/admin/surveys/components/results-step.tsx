'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrainCircuit, Layout, Trophy, ArrowRight, Sparkles } from 'lucide-react';
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

    if (!scoringEnabled) return null;

    const matchedRule = [...rules]
        .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
        .find((r: any) => testScore >= (r.minScore || 0) && testScore <= (r.maxScore || 0));
    
    const matchedPage = pages.find((p: any) => p.id === matchedRule?.pageId);

    return (
        <Card className="bg-primary/5 border-primary/20 mb-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles size={120} />
            </div>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" /> Outcome Simulator
                </CardTitle>
                <CardDescription>Test your scoring logic by entering a simulated score.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full sm:w-32">
                        <Label className="text-[10px] font-bold uppercase mb-1 block text-muted-foreground">Test Score</Label>
                        <Input 
                            type="number" 
                            value={testScore} 
                            onChange={(e) => setTestScore(Number(e.target.value))} 
                            className="bg-background font-black text-xl h-12 text-center"
                        />
                    </div>
                    <div className="shrink-0 pt-4 hidden sm:block">
                        <ArrowRight className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <div className="flex-grow w-full">
                        <Label className="text-[10px] font-bold uppercase mb-1 block text-muted-foreground">Matching Result</Label>
                        <div className={cn(
                            "h-12 flex items-center px-4 rounded-md border transition-all",
                            matchedRule ? "bg-background border-primary shadow-sm" : "bg-muted/50 border-dashed"
                        )}>
                            {matchedRule ? (
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-yellow-500" />
                                        <span className="font-bold text-foreground truncate max-w-[150px]">{matchedRule.label}</span>
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
    const { watch, setValue } = useFormContext();
    const scoringEnabled = watch('scoringEnabled');

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-xl font-black">
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
                    <CardContent>
                        <div className="flex items-center gap-4 p-4 rounded-xl border bg-muted/30">
                            <div className="grid gap-1.5 flex-1">
                                <Label htmlFor="max-score" className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Total Possible Score</Label>
                                <div className="flex items-center gap-2">
                                    <Input 
                                        id="max-score" 
                                        type="number" 
                                        value={watch('maxScore')} 
                                        onChange={(e) => setValue('maxScore', parseInt(e.target.value, 10) || 0, { shouldDirty: true })}
                                        className="max-w-[120px] font-bold text-lg" 
                                    />
                                    <span className="text-sm text-muted-foreground font-medium italic">Total points available across all questions.</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            <LogicSimulator />

            <Tabs defaultValue="logic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="logic" className="gap-2 font-bold py-3">
                        <BrainCircuit className="h-4 w-4" /> Outcome Logic
                    </TabsTrigger>
                    <TabsTrigger value="pages" className="gap-2 font-bold py-3">
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
