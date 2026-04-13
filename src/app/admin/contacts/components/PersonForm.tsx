'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Briefcase, Mail, Phone, Building2 } from 'lucide-react';
import type { Entity } from '@/lib/types';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const personFormSchema = z.object({
  firstName: z.string().min(2, { message: 'First name must be at least 2 characters.' }),
  lastName: z.string().min(2, { message: 'Last name must be at least 2 characters.' }),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().min(10, 'Invalid phone number').optional().or(z.literal('')),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  leadSource: z.string().optional(),
});

type PersonFormValues = z.infer<typeof personFormSchema>;

interface PersonFormProps {
  entity?: Entity;
  onSubmit: (data: PersonFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
}

export function PersonForm({ entity, onSubmit, isSubmitting }: PersonFormProps) {
  const methods = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: {
      firstName: entity?.personData?.firstName || '',
      lastName: entity?.personData?.lastName || '',
      email: entity?.contacts?.[0]?.email || '',
      phone: entity?.contacts?.[0]?.phone || '',
      company: entity?.personData?.company || '',
      jobTitle: entity?.personData?.jobTitle || '',
      leadSource: entity?.personData?.leadSource || '',
    }
  });

  return (
    <FormProvider {...methods}>
 <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8">
        {/* Personal Information Card */}
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <User className="h-5 w-5 text-primary" />
              </div>
              <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Personal Information</CardTitle>
 <CardDescription className="text-xs font-medium">Individual contact details</CardDescription>
              </div>
            </div>
          </CardHeader>
 <CardContent className="p-6 space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                control={methods.control} 
                name="firstName" 
                render={({ field }) => (
                  <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">
                      First Name *
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

              <FormField 
                control={methods.control} 
                name="lastName" 
                render={({ field }) => (
                  <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">
                      Last Name *
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
            </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                control={methods.control} 
                name="email" 
                render={({ field }) => (
                  <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">
 <Mail className="h-3 w-3 inline mr-1" />
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="email"
                        placeholder="email@example.com"
 className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              <FormField 
                control={methods.control} 
                name="phone" 
                render={({ field }) => (
                  <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">
 <Phone className="h-3 w-3 inline mr-1" />
                      Phone Number
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="tel"
                        placeholder="+1 (555) 000-0000"
 className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            </div>
          </CardContent>
        </Card>

        {/* Professional Information Card */}
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Professional Information</CardTitle>
 <CardDescription className="text-xs font-medium">Work and business details</CardDescription>
              </div>
            </div>
          </CardHeader>
 <CardContent className="p-6 space-y-6">
            <FormField 
              control={methods.control} 
              name="company" 
              render={({ field }) => (
                <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">
 <Building2 className="h-3 w-3 inline mr-1" />
                    Company
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Company name"
 className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />

            <FormField 
              control={methods.control} 
              name="jobTitle" 
              render={({ field }) => (
                <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">
                    Job Title
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="e.g., Marketing Director"
 className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />

            <FormField 
              control={methods.control} 
              name="leadSource" 
              render={({ field }) => (
                <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">
                    Lead Source
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="e.g., Referral, Website, Event"
 className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium" 
                    />
                  </FormControl>
 <FormDescription className="text-[9px] font-bold tracking-tighter opacity-60">
                    How did this contact find you?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} 
            />
          </CardContent>
        </Card>

 <div className="flex justify-end gap-4">
 <Button type="submit" disabled={isSubmitting} size="lg" className="rounded-xl">
            {isSubmitting ? 'Saving...' : 'Save Person'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
