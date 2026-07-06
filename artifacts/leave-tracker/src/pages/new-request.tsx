import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { 
  useCreateLeaveRequest, 
  usePreviewLeaveRequest, 
  LeaveType,
  getGetDashboardQueryKey,
  getListMyLeaveRequestsQueryKey,
  getGetCalendarQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Info, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  type: z.enum(["annual", "sick"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  userNote: z.string().optional(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

type FormValues = z.infer<typeof formSchema>;

export default function NewRequestPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewData, setPreviewData] = useState<any>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "annual",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      userNote: "",
    },
  });

  const previewMutation = usePreviewLeaveRequest();
  const createMutation = useCreateLeaveRequest();

  const onPreview = async (e: React.MouseEvent) => {
    e.preventDefault();
    const isValid = await form.trigger(["type", "startDate", "endDate"]);
    if (!isValid) return;

    const values = form.getValues();
    previewMutation.mutate({
      data: {
        type: values.type as LeaveType,
        startDate: values.startDate,
        endDate: values.endDate,
      }
    }, {
      onSuccess: (data) => {
        setPreviewData(data);
      },
      onError: (err: any) => {
        toast({ title: "Failed to load preview", description: err.message || "An error occurred", variant: "destructive" });
      }
    });
  };

  const onSubmit = (values: FormValues) => {
    createMutation.mutate({
      data: {
        type: values.type as LeaveType,
        startDate: values.startDate,
        endDate: values.endDate,
        userNote: values.userNote || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Request submitted successfully" });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListMyLeaveRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({start: "", end: ""}) }); // approximate invalidation
        setLocation("/requests");
      },
      onError: (err: any) => {
        toast({ title: "Failed to submit request", description: err.message || "Please check your inputs", variant: "destructive" });
      }
    });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground" onClick={() => setLocation("/requests")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Requests
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Request Time Off</h1>
        <p className="text-muted-foreground mt-1">Submit a new leave request for approval.</p>
      </div>

      <Card className="border-border shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select onValueChange={(val) => { field.onChange(val); setPreviewData(null); }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="annual">Annual Leave</SelectItem>
                          <SelectItem value="sick">Sick Leave</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} onChange={(e) => { field.onChange(e); setPreviewData(null); }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} onChange={(e) => { field.onChange(e); setPreviewData(null); }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="userNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any context for your manager..." 
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {previewData ? (
                <div className="p-5 rounded-xl bg-secondary/50 border border-border mt-6 space-y-4">
                  <h3 className="font-semibold flex items-center">
                    <Info className="w-4 h-4 mr-2 text-primary" /> Request Preview
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-background p-3 rounded-lg border border-border">
                      <div className="text-2xl font-bold">{previewData.workingDays}</div>
                      <div className="text-xs text-muted-foreground mt-1">Working Days</div>
                    </div>
                    <div className="bg-background p-3 rounded-lg border border-border">
                      <div className="text-2xl font-bold">{previewData.paidDays}</div>
                      <div className="text-xs text-muted-foreground mt-1">Paid Days</div>
                    </div>
                    <div className="bg-background p-3 rounded-lg border border-border">
                      <div className={`text-2xl font-bold ${previewData.unpaidDays > 0 ? "text-destructive" : ""}`}>
                        {previewData.unpaidDays}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Unpaid Days</div>
                    </div>
                  </div>

                  {previewData.hasUnpaid && (
                    <div className="flex items-start gap-3 p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>
                        <strong>Warning:</strong> This request includes {previewData.unpaidDays} unpaid working {previewData.unpaidDays === 1 ? 'day' : 'days'}. 
                        Your salary will be deducted accordingly if approved.
                      </p>
                    </div>
                  )}

                  {previewData.sickOverAllowance && form.getValues().type === 'sick' && (
                    <div className="flex items-start gap-3 p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>
                        <strong>Warning:</strong> You have exceeded your sick leave allowance. These days will be marked as unpaid.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full mt-2" 
                  onClick={onPreview}
                  disabled={previewMutation.isPending}
                >
                  {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Calculate Days
                </Button>
              )}
            </CardContent>
            
            <CardFooter className="bg-muted/30 px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setLocation("/requests")}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!previewData || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
