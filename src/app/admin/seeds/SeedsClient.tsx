'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarPlus, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { seedEnrichedMeetingTemplatesAction } from '@/app/actions/seed-meeting-invitation-templates-action';

export default function SeedsClient() {
    const { toast } = useToast();
    const [isSeeding, setIsSeeding] = React.useState(false);

    const handleSeedMeetingTemplates = async () => {
        setIsSeeding(true);
        try {
            const result = await seedEnrichedMeetingTemplatesAction();
            if (result.success) {
                toast({
                    title: 'Meeting Templates Enriched',
                    description: `Successfully seeded/verified ${result.seededCount} templates. Enriched ${result.enrichedCount} existing templates and processed ${result.totalProcessed} total template documents.`,
                });
            } else if (result.errors?.length > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Seeding Failed',
                    description: result.errors[0]?.error || 'Failed to enrich meeting templates.',
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Execution Error',
                description: error.message || 'An error occurred during meeting template seeding.',
            });
        }
        setIsSeeding(false);
    };

    return (
        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-12 pb-32 w-full max-w-4xl">
            
                {/* Header */}
                <div className="flex flex-col items-start text-left">
                    <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1 ring-1 ring-primary/20">System Governance</Badge>
                    <h1 className="text-3xl font-bold mb-2 text-foreground">Infrastructure Seeding</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Execute template optimizations and unique link enrichments across all workspaces.
                    </p>
                </div>

                {/* Seeding Section */}
                <div className="grid gap-6">
                    <Card className="border-teal-100 bg-teal-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <CalendarPlus className="h-24 w-24 text-teal-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Meeting Communications</span>
                            </div>
                            <CardTitle className="text-xl text-teal-950">Meeting Templates Enrichment</CardTitle>
                            <CardDescription className="max-w-2xl text-teal-900/70">
                                Run the Fetch-Enrich-Restore protocol on all meeting templates.
                                This imports global templates, searches for raw meeting links, and replaces them with unique registrant registration or joining links to prevent exposure of master URLs.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-teal-200 text-teal-700">Fetch-Enrich-Restore</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-teal-200 text-teal-700">Unique Registration Links</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-teal-200 text-teal-700">Unique Joining Links</Badge>
                                </div>
                                <Button 
                                    onClick={handleSeedMeetingTemplates} 
                                    disabled={isSeeding}
                                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-200 border-none min-w-[180px]"
                                >
                                    {isSeeding ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <CalendarPlus className="h-4 w-4 mr-2" />
                                    )}
                                    {isSeeding ? 'Processing...' : 'Enrich & Seed Meeting Templates'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
