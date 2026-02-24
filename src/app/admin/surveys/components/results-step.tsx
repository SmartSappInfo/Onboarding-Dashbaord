
'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrainCircuit, Layout, Trophy } from 'lucide-react';
import ResultRuleManager from './result-rule-manager';
import ResultPageBuilder from './result-page-builder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function ResultsStep() {
    const { watch, setValue } = useFormContext();
    const scoringEnabled = watch('scoringEnabled');

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" /> Scoring Engine
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
                        <div className="flex items-center gap-4">
                            <div className="grid gap-1.5 flex-1">
                                <Label htmlFor="max-score">Total Possible Score</Label>
                                <Input 
                                    id="max-score" 
                                    type="number" 
                                    {...watch('maxScore')} 
                                    onChange={(e) => setValue('maxScore', parseInt(e.target.value, 10) || 0, { shouldDirty: true })}
                                    className="max-w-[200px]" 
                                />
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            <Tabs defaultValue="logic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="logic" className="gap-2">
                        <BrainCircuit className="h-4 w-4" /> Outcome Logic
                    </TabsTrigger>
                    <TabsTrigger value="pages" className="gap-2">
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
