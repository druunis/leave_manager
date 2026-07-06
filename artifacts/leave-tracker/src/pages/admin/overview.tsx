import { useAdminGetOverview, getAdminGetOverviewQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, AlertCircle, CalendarClock, Ban, Activity } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function AdminOverviewPage() {
  const { data: overview, isLoading } = useAdminGetOverview({
    query: { queryKey: getAdminGetOverviewQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="text-muted-foreground mt-1">High-level metrics for your organization's time off.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
            <AlertCircle className={`w-4 h-4 ${overview.pendingRequests > 0 ? "text-primary" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.pendingRequests}</div>
            {overview.pendingRequests > 0 && (
              <p className="text-xs text-primary font-medium mt-1">Needs attention</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On Leave Today</CardTitle>
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.onLeaveToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Active team members away</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Unpaid Days</CardTitle>
            <Ban className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{overview.totalUnpaidDays}</div>
            <p className="text-xs text-muted-foreground mt-1">Require payroll deductions</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Staff</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.activeUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Out of {overview.totalUsers} total users</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/admin/approvals">
              <Button variant="outline" className="w-full justify-start h-auto py-3 px-4 text-left font-normal">
                <AlertCircle className="w-5 h-5 mr-3 text-primary" />
                <div>
                  <div className="font-semibold text-foreground">Review Approvals</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Approve or reject pending leave requests</div>
                </div>
              </Button>
            </Link>
            <Link href="/admin/reports">
              <Button variant="outline" className="w-full justify-start h-auto py-3 px-4 text-left font-normal">
                <Ban className="w-5 h-5 mr-3 text-destructive" />
                <div>
                  <div className="font-semibold text-foreground">Process Payroll Deductions</div>
                  <div className="text-xs text-muted-foreground mt-0.5">View and export unpaid leave days</div>
                </div>
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="outline" className="w-full justify-start h-auto py-3 px-4 text-left font-normal">
                <Users className="w-5 h-5 mr-3 text-foreground" />
                <div>
                  <div className="font-semibold text-foreground">Manage Directory</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Add users and override balances</div>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
