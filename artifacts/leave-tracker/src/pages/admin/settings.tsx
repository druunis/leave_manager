import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetSettings, getGetSettingsQueryKey, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";

const settingsSchema = z.object({
  annualEntitlement: z.coerce.number().min(0),
  sickEntitlement: z.coerce.number().min(0),
  leaveYearStartMonth: z.coerce.number().min(1).max(12),
  leaveYearStartDay: z.coerce.number().min(1).max(31),
  accrualDay: z.coerce.number().min(1).max(31),
  maxRolloverDays: z.coerce.number().min(0),
  carryOverDeadlineMonths: z.coerce.number().min(0).max(12),
  allowExceedBalance: z.boolean(),
  excessBecomesUnpaid: z.boolean(),
  autoWeekends: z.boolean(),
  allowHalfDays: z.boolean(),
  emailNotifications: z.boolean(),
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The leave-year end is auto-derived as the day before the configured start.
function deriveLeaveYearEnd(startMonth: number, startDay: number): string {
  if (!startMonth || !startDay) return "—";
  // Use a non-leap reference year; the day before the start (Jan 1 wraps to Dec 31).
  const start = new Date(Date.UTC(2001, startMonth - 1, startDay));
  if (Number.isNaN(start.getTime())) return "—";
  start.setUTCDate(start.getUTCDate() - 1);
  return `${start.getUTCDate()} ${MONTH_NAMES[start.getUTCMonth()]}`;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() }
  });

  const updateMutation = useUpdateSettings();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      annualEntitlement: 20,
      sickEntitlement: 5,
      leaveYearStartMonth: 1,
      leaveYearStartDay: 1,
      accrualDay: 1,
      maxRolloverDays: 4,
      carryOverDeadlineMonths: 3,
      allowExceedBalance: true,
      excessBecomesUnpaid: true,
      autoWeekends: true,
      allowHalfDays: false,
      emailNotifications: true,
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

  const onSubmit = (data: z.infer<typeof settingsSchema>) => {
    updateMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Failed to update settings", description: err.message, variant: "destructive" });
      }
    });
  };

  const startMonth = form.watch("leaveYearStartMonth");
  const startDay = form.watch("leaveYearStartDay");
  const leaveYearEndLabel = deriveLeaveYearEnd(startMonth, startDay);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-48 mb-8" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-muted-foreground mt-1">Configure global policies for leave and accruals.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle>Base Allowances</CardTitle>
                <CardDescription>Default entitlements for new users.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="annualEntitlement" render={({field}) => (
                  <FormItem>
                    <FormLabel>Annual Leave (Days)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sickEntitlement" render={({field}) => (
                  <FormItem>
                    <FormLabel>Sick Leave (Days)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle>Calendar & Accruals</CardTitle>
                <CardDescription>When does the leave year reset?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="leaveYearStartMonth" render={({field}) => (
                    <FormItem>
                      <FormLabel>Reset Month (1-12)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="leaveYearStartDay" render={({field}) => (
                    <FormItem>
                      <FormLabel>Reset Day (1-31)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormItem>
                  <FormLabel>Leave Year End</FormLabel>
                  <FormDescription>Auto-derived: the day before the reset date</FormDescription>
                  <Input value={leaveYearEndLabel} readOnly disabled className="bg-muted/50" />
                </FormItem>
                <FormField control={form.control} name="accrualDay" render={({field}) => (
                  <FormItem>
                    <FormLabel>Monthly Accrual Day</FormLabel>
                    <FormDescription>Day of month when allowance increases</FormDescription>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="maxRolloverDays" render={({field}) => (
                  <FormItem>
                    <FormLabel>Max Carry-Over Days</FormLabel>
                    <FormDescription>Unused annual leave rolled into the next year (excess is forfeited)</FormDescription>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="carryOverDeadlineMonths" render={({field}) => (
                  <FormItem>
                    <FormLabel>Carry-Over Use-By Deadline (Months)</FormLabel>
                    <FormDescription>Months into the new leave year to use carried-over days before they're forfeited (0 = usable all year)</FormDescription>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Policy Flags</CardTitle>
              <CardDescription>Toggle specific behaviors on or off.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <FormField control={form.control} name="allowExceedBalance" render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Allow Exceeding Balance</FormLabel>
                    <FormDescription>Users can request more days than they have.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              
              <FormField control={form.control} name="excessBecomesUnpaid" render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Excess Becomes Unpaid</FormLabel>
                    <FormDescription>Days beyond allowance are marked unpaid.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="autoWeekends" render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Auto Weekends</FormLabel>
                    <FormDescription>Don't deduct balance for weekends.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="allowHalfDays" render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Allow Half Days</FormLabel>
                    <FormDescription>Support 0.5 increments.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="emailNotifications" render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Email Notifications</FormLabel>
                    <FormDescription>Email members on approval/rejection and admins on new requests.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button type="submit" size="lg" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
              Save Configuration
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
