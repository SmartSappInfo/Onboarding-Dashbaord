'use client';

import * as React from 'react';
import { useForm, FormProvider, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Users, UserPlus, Baby, Plus, Trash2 } from 'lucide-react';
import type { Entity, Guardian, Child } from '@/lib/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const familyFormSchema = z.object({
  familyName: z.string().min(2, { message: 'Family name must be at least 2 characters.' }),
  guardians: z.array(z.object({
    name: z.string().min(2, 'Name required.'),
    phone: z.string().min(10, 'Invalid phone.'),
    email: z.string().email('Invalid email.'),
    relationship: z.string().min(1, 'Relationship required.'),
    isPrimary: z.boolean().default(false),
  })).min(1, 'At least one guardian is required.')
    .refine(guardians => guardians.filter(g => g.isPrimary).length === 1, { 
      message: 'Exactly one primary guardian must be selected.' 
    }),
  children: z.array(z.object({
    firstName: z.string().min(2, 'First name required.'),
    lastName: z.string().min(2, 'Last name required.'),
    dateOfBirth: z.string().optional(),
    gradeLevel: z.string().optional(),
    enrollmentStatus: z.string().optional(),
  })).optional(),
});

type FamilyFormValues = z.infer<typeof familyFormSchema>;

interface FamilyFormProps {
  entity?: Entity;
  onSubmit: (data: FamilyFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  showChildren?: boolean; // Based on workspace capabilities.children
  showAdmissions?: boolean; // Based on workspace capabilities.admissions
}

export function FamilyForm({ entity, onSubmit, isSubmitting, showChildren = true, showAdmissions = true }: FamilyFormProps) {
  const methods = useForm<FamilyFormValues>({
    resolver: zodResolver(familyFormSchema),
    defaultValues: {
      familyName: entity?.name || '',
      guardians: entity?.familyData?.guardians || [{ name: '', phone: '', email: '', relationship: 'Parent', isPrimary: true }],
      children: entity?.familyData?.children || [],
    }
  });

  const { fields: guardianFields, append: appendGuardian, remove: removeGuardian } = useFieldArray({
    control: methods.control,
    name: 'guardians',
  });

  const { fields: childFields, append: appendChild, remove: removeChild } = useFieldArray({
    control: methods.control,
    name: 'children',
  });

  return (
    <FormProvider {...methods}>
 <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8">
        {/* Family Identity Card */}
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Family Identity</CardTitle>
 <CardDescription className="text-xs font-medium">Core family information</CardDescription>
              </div>
            </div>
          </CardHeader>
 <CardContent className="p-6">
            <FormField 
              control={methods.control} 
              name="familyName" 
              render={({ field }) => (
                <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">
                    Family Name
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="e.g., The Smith Family"
 className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
          </CardContent>
        </Card>

        {/* Guardians Card */}
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Guardians</CardTitle>
 <CardDescription className="text-xs font-medium">Parents and legal guardians</CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendGuardian({ name: '', phone: '', email: '', relationship: 'Parent', isPrimary: false })}
 className="rounded-xl"
              >
 <Plus className="h-4 w-4 mr-2" />
                Add Guardian
              </Button>
            </div>
          </CardHeader>
 <CardContent className="p-6 space-y-6">
            {guardianFields.map((field, index) => (
 <div key={field.id} className="space-y-4 p-4 bg-muted/20 rounded-xl">
 <div className="flex items-center justify-between">
 <h4 className="text-sm font-bold">Guardian {index + 1}</h4>
                  {guardianFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGuardian(index)}
 className="text-destructive hover:text-destructive"
                    >
 <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={methods.control}
                    name={`guardians.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
 <FormLabel className="text-xs">Name</FormLabel>
                        <FormControl>
 <Input {...field} className="rounded-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={methods.control}
                    name={`guardians.${index}.relationship`}
                    render={({ field }) => (
                      <FormItem>
 <FormLabel className="text-xs">Relationship</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
 <SelectTrigger className="rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Mother">Mother</SelectItem>
                            <SelectItem value="Father">Father</SelectItem>
                            <SelectItem value="Parent">Parent</SelectItem>
                            <SelectItem value="Legal Guardian">Legal Guardian</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={methods.control}
                    name={`guardians.${index}.email`}
                    render={({ field }) => (
                      <FormItem>
 <FormLabel className="text-xs">Email</FormLabel>
                        <FormControl>
 <Input {...field} type="email" className="rounded-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={methods.control}
                    name={`guardians.${index}.phone`}
                    render={({ field }) => (
                      <FormItem>
 <FormLabel className="text-xs">Phone</FormLabel>
                        <FormControl>
 <Input {...field} type="tel" className="rounded-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={methods.control}
                  name={`guardians.${index}.isPrimary`}
                  render={({ field }) => (
 <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
 className="h-4 w-4 rounded"
                        />
                      </FormControl>
 <FormLabel className="text-xs font-medium !mt-0">Primary Guardian</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Children Card - Only show if capabilities.children is true */}
        {showChildren && (
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <Baby className="h-5 w-5 text-primary" />
                  </div>
                  <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Children</CardTitle>
 <CardDescription className="text-xs font-medium">Child enrollment information</CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendChild({ firstName: '', lastName: '', dateOfBirth: '', gradeLevel: '', enrollmentStatus: '' })}
 className="rounded-xl"
                >
 <Plus className="h-4 w-4 mr-2" />
                  Add Child
                </Button>
              </div>
            </CardHeader>
 <CardContent className="p-6 space-y-6">
              {childFields.length === 0 ? (
 <p className="text-sm text-muted-foreground italic text-center py-4">
                  No children added yet. Click "Add Child" to begin.
                </p>
              ) : (
                childFields.map((field, index) => (
 <div key={field.id} className="space-y-4 p-4 bg-muted/20 rounded-xl">
 <div className="flex items-center justify-between">
 <h4 className="text-sm font-bold">Child {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChild(index)}
 className="text-destructive hover:text-destructive"
                      >
 <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={methods.control}
                        name={`children.${index}.firstName`}
                        render={({ field }) => (
                          <FormItem>
 <FormLabel className="text-xs">First Name</FormLabel>
                            <FormControl>
 <Input {...field} className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={methods.control}
                        name={`children.${index}.lastName`}
                        render={({ field }) => (
                          <FormItem>
 <FormLabel className="text-xs">Last Name</FormLabel>
                            <FormControl>
 <Input {...field} className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={methods.control}
                        name={`children.${index}.dateOfBirth`}
                        render={({ field }) => (
                          <FormItem>
 <FormLabel className="text-xs">Date of Birth</FormLabel>
                            <FormControl>
 <Input {...field} type="date" className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={methods.control}
                        name={`children.${index}.gradeLevel`}
                        render={({ field }) => (
                          <FormItem>
 <FormLabel className="text-xs">Grade Level</FormLabel>
                            <FormControl>
 <Input {...field} placeholder="e.g., Grade 5" className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={methods.control}
                        name={`children.${index}.enrollmentStatus`}
                        render={({ field }) => (
                          <FormItem>
 <FormLabel className="text-xs">Enrollment Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
 <SelectTrigger className="rounded-lg">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Enrolled">Enrolled</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Waitlist">Waitlist</SelectItem>
                                <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

 <div className="flex justify-end gap-4">
 <Button type="submit" disabled={isSubmitting} size="lg" className="rounded-xl">
            {isSubmitting ? 'Saving...' : 'Save Family'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
