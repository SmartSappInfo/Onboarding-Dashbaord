import os

with open('src/app/admin/seeds/SeedsClient.tsx', 'r') as f:
    content = f.read()

# 1. Add Imports
imports = """import {
  fetchEntitiesForSchemaRestructure,
  enrichEntitiesWithNewSchema,
  restoreEntitySchemaRestructure,
  rollbackEntitySchemaRestructure,
  type MigrationResult as EntitySchemaMigrationResult
} from '@/app/actions/entity-schema-restructure-actions';
"""

content = content.replace("import {\n  fetchSchoolsForSaaSMigration,", imports + "import {\n  fetchSchoolsForSaaSMigration,")

# 2. Add State
state = """  // Entity Schema Restructure States
  const [schemaFetchStatus, setSchemaFetchStatus] = useState<SeedingState>('idle');
  const [schemaEnrichStatus, setSchemaEnrichStatus] = useState<SeedingState>('idle');
  const [schemaRestoreStatus, setSchemaRestoreStatus] = useState<SeedingState>('idle');
  const [schemaRollbackStatus, setSchemaRollbackStatus] = useState<SeedingState>('idle');
  const [schemaMigrationStats, setSchemaMigrationStats] = useState<any | null>(null);

"""

content = content.replace("  // SaaS Industry Migration States", state + "  // SaaS Industry Migration States")

# 3. Add Handlers
handlers = """
  // Entity Schema Restructure Handlers
  const orgIdToUse = 'smartsapp-hq'; // Hardcoded for global admin seeding ops, adjust if needed

  const handleSchemaFetch = async () => {
    setSchemaFetchStatus('seeding');
    try {
      const result = await fetchEntitiesForSchemaRestructure(orgIdToUse);
      if (result.success) {
        setSchemaMigrationStats(result.data);
        toast({ title: 'Fetch Complete', description: `Found ${result.data.needingMigration} entities needing migration out of ${result.data.total} total.` });
        setSchemaFetchStatus('success');
      } else throw new Error(result.error);
    } catch (error: any) {
      setSchemaFetchStatus('error');
      toast({ variant: 'destructive', title: 'Fetch Failed', description: error.message });
    } finally {
      setTimeout(() => setSchemaFetchStatus('idle'), 2500);
    }
  };

  const handleSchemaEnrich = async () => {
    setSchemaEnrichStatus('seeding');
    try {
      const result = await enrichEntitiesWithNewSchema(orgIdToUse);
      if (result.success) {
        setSchemaMigrationStats(result.data);
        if (result.data.failed > 0) {
          toast({ variant: 'destructive', title: 'Enrichment Partially Failed', description: `Succeeded: ${result.data.succeeded}, Failed: ${result.data.failed}` });
          setSchemaEnrichStatus('error');
        } else {
          toast({ title: 'Enrichment Complete', description: `Successfully restructured ${result.data.succeeded} entities.` });
          setSchemaEnrichStatus('success');
        }
      } else throw new Error(result.error);
    } catch (error: any) {
      setSchemaEnrichStatus('error');
      toast({ variant: 'destructive', title: 'Enrichment Failed', description: error.message });
    } finally {
      setTimeout(() => setSchemaEnrichStatus('idle'), 2500);
    }
  };

  const handleSchemaRestore = async () => {
    setSchemaRestoreStatus('seeding');
    try {
      const result = await restoreEntitySchemaRestructure(orgIdToUse);
      if (result.success) {
        setSchemaMigrationStats(result.data);
        if (result.data.invalid > 0) {
          toast({ variant: 'destructive', title: 'Restore Failed Validation', description: `${result.data.invalid} entities have schema issues.` });
          setSchemaRestoreStatus('error');
        } else {
          toast({ title: 'Restore Complete', description: `All ${result.data.valid} entities validated successfully.` });
          setSchemaRestoreStatus('success');
        }
      } else throw new Error(result.error);
    } catch (error: any) {
      setSchemaRestoreStatus('error');
      toast({ variant: 'destructive', title: 'Restore Failed', description: error.message });
    } finally {
      setTimeout(() => setSchemaRestoreStatus('idle'), 2500);
    }
  };

  const handleSchemaRollback = async () => {
    setSchemaRollbackStatus('seeding');
    try {
      const result = await rollbackEntitySchemaRestructure(orgIdToUse);
      if (result.success) {
        setSchemaMigrationStats(result.data);
        toast({ title: 'Rollback Complete', description: `Reverted ${result.data.succeeded} entities to legacy schema.` });
        setSchemaRollbackStatus('success');
      } else throw new Error(result.error);
    } catch (error: any) {
      setSchemaRollbackStatus('error');
      toast({ variant: 'destructive', title: 'Rollback Failed', description: error.message });
    } finally {
      setTimeout(() => setSchemaRollbackStatus('idle'), 2500);
    }
  };

"""

content = content.replace("  // SaaS Industry Migration Handlers", handlers + "  // SaaS Industry Migration Handlers")

# 4. Add JSX Section
jsx = """
            {/* Entity Schema Restructure Section */}
            <section className="space-y-8">
                <div className="flex flex-col gap-1 items-start">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">Entity Schema Restructure</h3>
                    <p className="text-muted-foreground font-medium">Consolidate institutionData into Entity root and standard FinanceData.</p>
                </div>

                <Card className="border-2 border-purple-200 bg-purple-50/50 shadow-lg rounded-2xl overflow-hidden">
                    <CardContent className="p-8 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-4 bg-purple-100 rounded-2xl w-fit text-purple-700 ring-2 ring-purple-300">
                                <Database className="h-7 w-7" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xl font-bold tracking-tight text-foreground mb-2">InstitutionData Phase-Out</h4>
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Transforms entities by removing <code className="px-1.5 py-0.5 bg-muted rounded text-xs">institutionData</code>, 
                                    creating standard <code className="px-1.5 py-0.5 bg-muted rounded text-xs">financeData</code>, and moving 
                                    core properties like <code className="px-1.5 py-0.5 bg-muted rounded text-xs">initials</code>, <code className="px-1.5 py-0.5 bg-muted rounded text-xs">logoUrl</code> to the root. Cleans up <code className="px-1.5 py-0.5 bg-muted rounded text-xs">industryData</code>.
                                </p>
                                
                                {schemaMigrationStats && (
                                    <div className="mt-4 p-4 bg-background rounded-xl border border-border">
                                        <div className="grid grid-cols-4 gap-4 text-center">
                                            <div>
                                                <div className="text-2xl font-bold text-foreground">{schemaMigrationStats.total !== undefined ? schemaMigrationStats.total : '-'}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Total</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-green-600">{schemaMigrationStats.succeeded ?? schemaMigrationStats.valid ?? schemaMigrationStats.needingMigration ?? '-'}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Succeeded/Valid/Needed</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-amber-600">{schemaMigrationStats.skipped ?? '-'}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Skipped</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-red-600">{schemaMigrationStats.failed ?? schemaMigrationStats.invalid ?? '-'}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Failed/Invalid</div>
                                            </div>
                                        </div>
                                        {schemaMigrationStats.errors && schemaMigrationStats.errors.length > 0 && (
                                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="flex items-center gap-2 text-red-800 font-semibold text-sm mb-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Errors ({schemaMigrationStats.errors.length})
                                                </div>
                                                <div className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                                                    {schemaMigrationStats.errors.slice(0, 5).map((error: string, idx: number) => (
                                                        <div key={idx} className="font-mono">{error}</div>
                                                    ))}
                                                    {schemaMigrationStats.errors.length > 5 && (
                                                        <div className="text-red-600 font-semibold">
                                                            ... and {schemaMigrationStats.errors.length - 5} more errors
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 mt-4 border-t border-border/50">
                            <Button 
                                onClick={handleSchemaFetch} 
                                disabled={schemaFetchStatus === 'seeding'}
                                variant="outline"
                                className="rounded-xl font-bold h-12 px-6 border-2 hover:bg-purple-50 hover:border-purple-300 transition-all"
                            >
                                {schemaFetchStatus === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Database className="h-5 w-5 mr-2" />}
                                Fetch
                            </Button>

                            <Button 
                                onClick={handleSchemaEnrich} 
                                disabled={schemaEnrichStatus === 'seeding'}
                                className="rounded-xl font-bold h-12 px-6 bg-purple-600 hover:bg-purple-700 text-white shadow-lg transform active:scale-95 transition-all"
                            >
                                {schemaEnrichStatus === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />}
                                Enrich
                            </Button>

                            <Button 
                                onClick={handleSchemaRestore} 
                                disabled={schemaRestoreStatus === 'seeding'}
                                variant="outline"
                                className="rounded-xl font-bold h-12 px-6 border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 transition-all"
                            >
                                {schemaRestoreStatus === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                                Restore
                            </Button>
                        </div>

                        <div className="pt-2">
                            <Button 
                                onClick={handleSchemaRollback} 
                                disabled={schemaRollbackStatus === 'seeding'}
                                variant="ghost" 
                                className="w-full rounded-xl font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 h-12 px-6 shadow-sm active:scale-95 transition-all ring-1 ring-rose-200/50"
                            >
                                {schemaRollbackStatus === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <TriangleAlert className="h-5 w-5 mr-2" />}
                                Rollback Schema Migration
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </section>
"""

content = content.replace("{/* Workspace Industry Migration Section */}", jsx + "\n            {/* Workspace Industry Migration Section */}")

with open('src/app/admin/seeds/SeedsClient.tsx', 'w') as f:
    f.write(content)

