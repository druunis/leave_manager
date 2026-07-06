import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plane, Pill, AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function DashboardPage() {
  const { data: dashboard, isLoading, error } = useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey(),
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-8 text-center bg-destructive/10 rounded-2xl border border-destructive/20 text-destructive">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-80" />
        <h2 className="text-lg font-bold">Failed to load dashboard</h2>
        <p className="text-sm opacity-80 mt-1">Please try refreshing the page.</p>
      </div>
    );
  }

  const { balance, nextApprovedLeave, sickOverAllowance } = dashboard;
  
  // Calculate percentages safely
  const annualTotal = balance.annualEntitlement;
  const annualUsedPct = annualTotal > 0 ? (balance.usedPaid / annualTotal) * 100 : 0;
  
  const sickTotal = dashboard.user.sickEntitlement;
  const sickUsedPct = sickTotal > 0 ? (balance.sickUsed / sickTotal) * 100 : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, {dashboard.user.name.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1">Here's your leave summary for the current year.</p>
        </div>
        <Link href="/requests/new">
          <Button className="w-full md:w-auto shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Request Time Off
          </Button>
        </Link>
      </div>

      {sickOverAllowance && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Sick Leave Over Allowance</h4>
            <p className="text-sm mt-1 opacity-90">You have exceeded your paid sick leave allowance. Further sick days may be unpaid.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Annual Leave Card */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Plane className="w-4 h-4 mr-2 text-primary" />
              Annual Leave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground mb-1">{balance.available} <span className="text-lg font-normal text-muted-foreground">days left</span></div>
            <div className="mt-4 space-y-2">
              <Progress value={annualUsedPct} className="h-2 bg-secondary" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{balance.usedPaid} used</span>
                <span>{annualTotal} total</span>
              </div>
            </div>
            {balance.carriedOver > 0 && (() => {
              const deadline = balance.carryOverDeadline ? new Date(balance.carryOverDeadline) : null;
              const expired = deadline ? deadline.getTime() <= Date.now() : false;
              if (deadline && expired) {
                return (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-3 bg-amber-500/10 px-2 py-1 rounded-md flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {balance.carriedOver} carried-over days expired on {format(deadline, "MMM d")} — unused days were forfeited
                  </p>
                );
              }
              return (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-3 bg-emerald-500/10 px-2 py-1 rounded-md inline-block">
                  Includes {balance.carriedOver} days carried over from last year
                  {deadline && <> — use by {format(deadline, "MMM d")} or lose them</>}
                </p>
              );
            })()}
            {balance.pending > 0 && (
              <p className="text-xs text-primary font-medium mt-3 bg-primary/10 px-2 py-1 rounded-md inline-block">
                {balance.pending} days pending approval
              </p>
            )}
          </CardContent>
        </Card>

        {/* Sick Leave Card */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Pill className="w-4 h-4 mr-2 text-primary" />
              Sick Leave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground mb-1">{balance.sickRemaining} <span className="text-lg font-normal text-muted-foreground">days left</span></div>
            <div className="mt-4 space-y-2">
              <Progress value={sickUsedPct} className="h-2 bg-secondary [&>div]:bg-primary" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{balance.sickUsed} used</span>
                <span>{sickTotal} total</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unpaid Info Card */}
        <Card className="shadow-sm border-border bg-secondary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unpaid Leave Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-2xl font-bold text-foreground">{balance.usedUnpaid} <span className="text-sm font-normal text-muted-foreground">days taken</span></div>
                <p className="text-xs text-muted-foreground mt-1">Salary deducted</p>
              </div>
              {balance.wouldBeUnpaid > 0 && (
                <div className="pt-3 border-t border-border">
                  <div className="text-sm font-semibold text-destructive">{balance.wouldBeUnpaid} pending unpaid days</div>
                  <p className="text-xs text-muted-foreground mt-1">From unapproved requests</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Upcoming Time Off</h3>
            <Link href="/requests">
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {nextApprovedLeave.length === 0 ? (
            <Card className="bg-secondary/30 border-dashed border-2 shadow-none">
              <CardContent className="p-8 text-center">
                <Plane className="w-8 h-8 mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-muted-foreground">No upcoming approved leave.</p>
                <Link href="/requests/new">
                  <Button variant="link" className="mt-2 text-primary">Book some time off</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {nextApprovedLeave.map((leave) => (
                <Card key={leave.id} className="shadow-sm border-border overflow-hidden">
                  <div className="flex items-stretch">
                    <div className={`w-2 shrink-0 ${leave.type === 'annual' ? 'bg-primary' : 'bg-accent'}`} />
                    <CardContent className="p-4 flex-1 flex justify-between items-center">
                      <div>
                        <p className="font-semibold capitalize">{leave.type} Leave</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(leave.startDate), "MMM d")} - {format(new Date(leave.endDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{leave.workingDays}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Days</div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
