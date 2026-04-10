'use client';

import * as React from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Building, Banknote, Users, MapPin, Calendar } from 'lucide-react';
import type { Entity, InstitutionData, FocalPerson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FocalPersonManager } from '@/app/admin/entities/components/FocalPersonManager';

const institutionFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  nominalRoll: z.coerce.number().int().positive('Nominal roll must be a positive integer').optional(),
  billingAddress: z.string().optional(),
  currency: z.string().default('GHS'),
  subscriptionPackageId: z.string().optional(),
  subscriptionRate: z.coerce.number().default(0),
  implementationDate: z.date().optional().nullable(),
  referee: z.string().optional(),
  focalPersons: z.array(z.object({
    name: z.string().min(2, 'Name required.'),
    email: z.string().email('Invalid email.'),
    phone: z.string().min(10, 'Invalid phone.'),
    type: z.string().min(1, 'Role required.'),
    isSignatory: z.boolean().default(false),
  })).min(1, 'At least one focal person is required.')
    .refine(people => people.some(p => p.isSignatory), { message: 'Exactly one signatory must be selected.' }),
});

type InstitutionFormValues = z.infer<typeof institutionFormSchema>;

interface InstitutionFormProps {
  entity?: Entity;
  onSubmit: (data: InstitutionFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
}

export function InstitutionForm({ entity, onSubmit, isSubmitting }: InstitutionFormProps) {
  const methods = useForm<InstitutionFormValues>({
    resolver: zodResolver(institutionFormSchema),
    defaultValues: {
      name: entity?.name || '',
      nominalRoll: entity?.institutionData?.nominalRoll || 0,
      billingAddress: entity?.institutionData?.billingAddress || '',
      currency: entity?.institutionData?.currency || 'GHS',
      subscriptionPackageId: entity?.institutionData?.subscriptionPackageId || '',
      subscriptionRate: entity?.institutionData?.subscriptionRate || 0,
      implementationDate: entity?.institutionData?.implementationDate 
        ? new Date(entity.institutionData.implementationDate) 
        : null,
      referee: entity?.institutionData?.referee || '',
      focalPersons: entity?.contacts || [],
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8">
        {/* Identity Card */}
        <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Institution Identity</CardTitle>
                <CardDescription className="text-xs font-medium">Core institutional information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <FormField 
              control={methods.control} 
              name="name" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                    Institution Name
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                control={methods.control} 
                name="nominalRoll" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                      <Users className="h-3 w-3 inline mr-1" />
                      Nominal Roll
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" 
                      />
                    </FormControl>
                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60">
                      Total student enrollment
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              <FormField 
                control={methods.control} 
                name="implementationDate" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      Implementation Date
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        value={field.value ? field.value.toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                        className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            </div>

            <FormField 
              control={methods.control} 
              name="referee" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                    Referee
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
          </CardContent>
        </Card>

        {/* Financial Profile Card */}
        <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Banknote className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Financial Profile</CardTitle>
                <CardDescription className="text-xs font-medium">Billing and subscription details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                control={methods.control} 
                name="currency" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                      Billing Currency
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl shadow-2xl border-none">
                        <SelectItem value="GHS" className="font-black">Ghanaian Cedi (GH¢)</SelectItem>
                        <SelectItem value="USD" className="font-black">US Dollar ($)</SelectItem>
                        <SelectItem value="EUR" className="font-black">Euro (€)</SelectItem>
                        <SelectItem value="GBP" className="font-black">British Pound (£)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              <FormField 
                control={methods.control} 
                name="subscriptionRate" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                      Subscription Rate
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" 
                      />
                    </FormControl>
                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60">
                      Rate per student
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            </div>

            <FormField 
              control={methods.control} 
              name="billingAddress" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    Billing Address
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Enter billing address..." 
                      className="min-h-[100px] rounded-xl bg-muted/20 border-none shadow-inner" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
          </CardContent>
        </Card>

        {/* Focal Persons Card */}
        <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Focal Persons</CardTitle>
                <CardDescription className="text-xs font-medium">Key contacts for this institution</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <FocalPersonManager />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSubmitting} size="lg" className="rounded-xl">
            {isSubmitting ? 'Saving...' : 'Save Institution'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
