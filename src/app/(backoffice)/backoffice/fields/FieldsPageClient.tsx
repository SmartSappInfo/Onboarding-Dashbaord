'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, FolderKanban, Users, Network } from 'lucide-react';

import NativeFieldRegistry from './components/NativeFieldRegistry';
import FieldPackEditor from './components/FieldPackEditor';
import ContactTypeDefaults from './components/ContactTypeDefaults';
import GroupRegistryInspection from './components/GroupRegistryInspection';

import type { PlatformFieldDefinition, PlatformFieldPack } from '@/lib/backoffice/backoffice-types';
import type { ContactTypeEntry } from '@/lib/types';

interface FieldsPageClientProps {
  initialNativeFields?: PlatformFieldDefinition[];
  initialPacks?: PlatformFieldPack[];
  initialContactTypes?: ContactTypeEntry[];
}

export default function FieldsPageClient({
  initialNativeFields,
  initialPacks,
  initialContactTypes,
}: FieldsPageClientProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Fields & Defaults
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Govern platform-wide native parameters, default templates, and contact typologies.
          </p>
        </div>
      </div>

      <Tabs defaultValue="registry" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border rounded-xl p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger
            value="registry"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Network className="h-3.5 w-3.5 mr-2" /> Group Registry
          </TabsTrigger>
          <TabsTrigger
            value="native"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Database className="h-3.5 w-3.5 mr-2" /> Native Fields
          </TabsTrigger>
          <TabsTrigger
            value="packs"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <FolderKanban className="h-3.5 w-3.5 mr-2" /> Field Packs
          </TabsTrigger>
           <TabsTrigger
            value="contact-types"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Users className="h-3.5 w-3.5 mr-2" /> Contact Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="mt-4">
           <GroupRegistryInspection />
        </TabsContent>

        <TabsContent value="native" className="mt-4">
           <NativeFieldRegistry initialData={initialNativeFields} />
        </TabsContent>

        <TabsContent value="packs" className="mt-4">
           <FieldPackEditor initialData={initialPacks} />
        </TabsContent>
        
        <TabsContent value="contact-types" className="mt-4">
           <ContactTypeDefaults initialData={initialContactTypes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
