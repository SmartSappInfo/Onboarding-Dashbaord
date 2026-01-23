"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";

const formSchema = z.object({
  contactPerson: z.string().min(2, { message: "Contact person must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  organization: z.string().min(2, { message: "Organization must be at least 2 characters." }),
  location: z.string().min(5, { message: "Location must be at least 5 characters." }),
  nominalRoll: z.coerce.number().min(1, { message: "Nominal roll must be at least 1." }),
  modules: z.string().min(10, { message: "Modules description must be at least 10 characters." }),
  includeDroneFootage: z.boolean().default(false),
  implementationDate: z.date({
    required_error: "An implementation date is required.",
  }),
  referee: z.string().optional(),
  notifySchool: z.boolean().default(true),
  notifySchoolEmails: z.array(z.string().email()).default([]),
  notifySmartSapp: z.boolean().default(true),
  notifyOnboarding: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

export default function NewSchoolSignupForm() {
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contactPerson: "",
      email: "",
      phone: "",
      organization: "",
      location: "",
      nominalRoll: 0,
      modules: "",
      includeDroneFootage: false,
      referee: "",
      notifySchool: true,
      notifySchoolEmails: [],
      notifySmartSapp: true,
      notifyOnboarding: true,
    },
  });

  const [emailInputValue, setEmailInputValue] = React.useState("");
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  const watchNotifySchool = form.watch("notifySchool");
  const watchMainEmail = form.watch("email");
  const isMainEmailValid = z.string().email().safeParse(watchMainEmail).success;

  const onSubmit = async (data: FormData) => {
    try {
      const schoolEmails = [];
      if (data.notifySchool) {
        if (data.email) schoolEmails.push(data.email);
        if (data.notifySchoolEmails) schoolEmails.push(...data.notifySchoolEmails);
      }

      const finalData: Record<string, any> = { ...data };
      
      finalData.includeDroneFootage = data.includeDroneFootage ? "Yes" : "No";
      finalData.notifySchoolEmails = [...new Set(schoolEmails)].join(', ');
      finalData.notifySmartSappEmails = data.notifySmartSapp ? "team@minex360.com" : "";
      finalData.notifyOnboardingEmails = data.notifyOnboarding ? "joseph.aidoo@smartsapp.com, onboarding@minex360.com, sitso.aglago@smartsapp.com, finance@smartsapp.com" : "";

      delete finalData.notifySchool;
      delete finalData.notifySmartSapp;
      delete finalData.notifyOnboarding;

      const response = await fetch("https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalData),
      });

      if (response.ok) {
        toast({
          title: "Registration Successful!",
          description: "Your new school signup has been submitted.",
        });
        form.reset();
      } else {
        throw new Error("Webhook submission failed");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request. Please try again.",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 text-left">
        <FormField
          control={form.control}
          name="contactPerson"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Person</FormLabel>
              <FormControl>
                <Input placeholder="Yaw Mensah" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="yaw.mensah@school.edu.gh" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="+233 24 123 4567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="organization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization</FormLabel>
              <FormControl>
                <Input placeholder="Ghana International School" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Textarea placeholder="123 High Street, Airport Residential Area, Accra" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nominalRoll"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nominal Roll (Number of Students)</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="modules"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modules (Needs Discovery)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Student Billing, Attendance, Reports" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="includeDroneFootage"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Include Drone Footage</FormLabel>
                <FormDescription>
                  Select if drone footage is required for the school.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="implementationDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Implementation Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date(new Date().setDate(new Date().getDate() - 1))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="referee"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Referee</FormLabel>
              <FormControl>
                <Input placeholder="Ama Serwaa" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Separator className="my-8" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Email Notifications</h3>
          <FormField
            control={form.control}
            name="notifySchool"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Notify School</FormLabel>
                  <FormDescription>
                    Send signup confirmation to the school's primary email.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {watchNotifySchool && (
             <FormField
              control={form.control}
              name="notifySchoolEmails"
              render={({ field, fieldState }) => {
                const addEmail = (email: string) => {
                  const newEmail = email.trim();
                  if (newEmail) {
                    const validation = z.string().email().safeParse(newEmail);
                    if (validation.success) {
                      if (!field.value.includes(newEmail) && newEmail !== watchMainEmail) {
                        field.onChange([...field.value, newEmail]);
                        setEmailInputValue('');
                        form.clearErrors('notifySchoolEmails');
                      }
                    } else {
                      form.setError('notifySchoolEmails', { type: 'manual', message: 'Invalid email address.' });
                    }
                  }
                };

                const removeEmail = (emailToRemove: string) => {
                    field.onChange(field.value.filter((email) => email !== emailToRemove));
                };

                const editEmail = (emailToEdit: string) => {
                    removeEmail(emailToEdit);
                    setEmailInputValue(emailToEdit);
                    emailInputRef.current?.focus();
                };

                const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addEmail(emailInputValue);
                    if (z.string().email().safeParse(emailInputValue).success) {
                      setEmailInputValue('');
                    }
                  }
                };
                
                return (
                  <FormItem>
                    <FormLabel>Additional Notification Emails</FormLabel>
                    <FormControl>
                      <div
                        className={cn(
                          "flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background",
                          fieldState.error && "border-destructive"
                        )}
                        onClick={() => emailInputRef.current?.focus()}
                      >
                        {isMainEmailValid && (
                          <Badge variant="outline">{watchMainEmail}</Badge>
                        )}
                        {field.value.map((email, index) => (
                          <Badge 
                            key={index} 
                            variant="secondary" 
                            className="group/badge flex cursor-pointer items-center gap-1"
                            onDoubleClick={() => editEmail(email)}
                          >
                            {email}
                            <button
                              type="button"
                              aria-label={`Remove ${email}`}
                              className="rounded-full opacity-50 outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 group-hover/badge:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeEmail(email);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                        <Input
                          ref={emailInputRef}
                          type="text"
                          placeholder="Add email and press Enter or comma..."
                          value={emailInputValue}
                          onChange={(e) => {
                            setEmailInputValue(e.target.value);
                            if (fieldState.error) form.clearErrors('notifySchoolEmails');
                          }}
                          onKeyDown={handleKeyDown}
                          className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}

          <FormField
            control={form.control}
            name="notifySmartSapp"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Notify SmartSapp</FormLabel>
                  <FormDescription>
                    Internal notification to team@minex360.com
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notifyOnboarding"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Notify Onboarding Team</FormLabel>
                  <FormDescription>
                    Notifies the onboarding and finance teams.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Clear Fields
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Registering..." : "Register New Sign Up"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
