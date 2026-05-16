'use client';

import * as React from 'react';
import { Network, Search, Layers, Briefcase } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { INDUSTRY_FIELD_REGISTRY, PLATFORM_FIELD_GROUPS, INDUSTRY_METADATA } from '@/lib/industry-field-registry';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function GroupRegistryInspection() {
  const [search, setSearch] = React.useState('');
  const [scopeFilter, setScopeFilter] = React.useState<string>('all');
  const [industryFilter, setIndustryFilter] = React.useState<string>('all');

  const allGroups = React.useMemo(() => {
    const list: any[] = [];
    
    // Add Platform Groups
    PLATFORM_FIELD_GROUPS.forEach(g => {
      list.push({ ...g, scope: 'system', industries: ['All'] });
    });

    // Add Industry Groups
    Object.entries(INDUSTRY_FIELD_REGISTRY).forEach(([industry, groups]) => {
      groups.forEach(g => {
        // If the same group slug exists in another industry, merge the industries
        const existing = list.find(item => item.slug === g.slug && item.scope === 'industry');
        if (existing) {
          if (!existing.industries.includes(industry)) existing.industries.push(industry);
        } else {
          list.push({ ...g, scope: 'industry', industries: [industry] });
        }
      });
    });
    return list;
  }, []);

  const filtered = React.useMemo(() => {
    return allGroups.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) || g.slug.toLowerCase().includes(search.toLowerCase());
      const matchScope = scopeFilter === 'all' || g.scope === scopeFilter;
      const matchIndustry = industryFilter === 'all' || g.industries.includes('All') || g.industries.includes(industryFilter);
      return matchSearch && matchScope && matchIndustry;
    });
  }, [allGroups, search, scopeFilter, industryFilter]);

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-6">
       <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
               <Network className="h-4 w-4 text-emerald-400" />
               Group Registry Inspection
            </h3>
            <p className="text-xs text-muted-foreground mt-1">View statically defined field groups seeded across workspaces.</p>
          </div>
       </div>
       
       <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-border text-foreground text-sm rounded-lg"
            />
          </div>
          
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="h-9 w-[180px] bg-muted/50 border-border">
              <Layers className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scopes</SelectItem>
              <SelectItem value="system">System (Platform)</SelectItem>
              <SelectItem value="industry">Industry Specific</SelectItem>
            </SelectContent>
          </Select>

          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="h-9 w-[200px] bg-muted/50 border-border">
              <Briefcase className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {Object.keys(INDUSTRY_METADATA).map(ind => (
                <SelectItem key={ind} value={ind}>{INDUSTRY_METADATA[ind as keyof typeof INDUSTRY_METADATA].name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
       </div>
       
       <div className="rounded-xl border border-border bg-background overflow-hidden">
          <Table>
             <TableHeader>
               <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">Slug</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">Name</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">Scope</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">Industries</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">Fields</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
                {filtered.length === 0 ? (
                   <TableRow className="border-border">
                      <TableCell colSpan={5} className="text-center py-6">
                         <p className="text-sm text-muted-foreground">No groups match your filters.</p>
                      </TableCell>
                   </TableRow>
                ) : (
                   filtered.map(g => (
                      <TableRow key={`${g.scope}-${g.slug}`} className="border-border hover:bg-accent/20">
                         <TableCell className="font-mono text-xs text-foreground/80">{g.slug}</TableCell>
                         <TableCell>
                           <div className="font-medium text-sm text-foreground">{g.name}</div>
                           <div className="text-xs text-muted-foreground truncate max-w-[200px]">{g.description}</div>
                         </TableCell>
                         <TableCell>
                            {g.scope === 'system' ? (
                               <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] uppercase px-1.5">System</Badge>
                            ) : (
                               <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[9px] uppercase px-1.5">Industry</Badge>
                            )}
                         </TableCell>
                         <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {g.industries.join(', ')}
                         </TableCell>
                         <TableCell className="text-center text-sm font-medium">
                            {g.fields?.length || 0}
                         </TableCell>
                      </TableRow>
                   ))
                )}
             </TableBody>
          </Table>
       </div>
    </div>
  );
}
