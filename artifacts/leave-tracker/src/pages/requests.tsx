import { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useListMyLeaveRequests, getListMyLeaveRequestsQueryKey, useCancelLeaveRequest, RequestStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, XCircle, FileText, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const getStatusColor = (status: RequestStatus) => {
  switch (status) {
    case 'approved': return "bg-primary/10 text-primary border-primary/20";
    case 'pending': return "bg-secondary text-secondary-foreground border-border";
    case 'rejected': return "bg-destructive/10 text-destructive border-destructive/20";
    case 'cancelled': return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function RequestsPage() {
  const [filter, setFilter] = useState<RequestStatus | "all">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useListMyLeaveRequests(
    filter === "all" ? undefined : { status: filter },
    { query: { queryKey: getListMyLeaveRequestsQueryKey(filter === "all" ? undefined : { status: filter }) } }
  );

  const cancelRequest = useCancelLeaveRequest();

  const handleCancel = (id: number) => {
    if (confirm("Are you sure you want to cancel this request?")) {
      cancelRequest.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Request cancelled" });
          queryClient.invalidateQueries({ queryKey: getListMyLeaveRequestsQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to cancel request", variant: "destructive" });
        }
      });
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Requests</h1>
          <p className="text-muted-foreground mt-1">View and manage your time off requests.</p>
        </div>
        <Link href="/requests/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(["all", "pending", "approved", "rejected", "cancelled"] as const).map(f => (
          <Button 
            key={f} 
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : requests?.length === 0 ? (
          <Card className="bg-secondary/30 border-dashed border-2 shadow-none">
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold">No requests found</h3>
              <p className="text-muted-foreground mt-1 mb-4">You haven't made any leave requests yet.</p>
              <Link href="/requests/new">
                <Button variant="outline">Create your first request</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          requests?.map((req) => (
            <Card key={req.id} className="overflow-hidden shadow-sm">
              <div className="flex flex-col sm:flex-row">
                <div className={`w-full sm:w-2 h-2 sm:h-auto shrink-0 ${req.type === 'annual' ? 'bg-primary' : 'bg-accent'}`} />
                <CardContent className="flex-1 p-5 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg capitalize">{req.type} Leave</h3>
                      <Badge variant="outline" className={`capitalize px-2.5 py-0.5 border ${getStatusColor(req.status)}`}>
                        {req.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {format(new Date(req.startDate), "MMM d, yyyy")}
                      </span>
                      <span>→</span>
                      <span className="font-medium text-foreground">
                        {format(new Date(req.endDate), "MMM d, yyyy")}
                      </span>
                      <span className="text-sm px-2 py-0.5 bg-secondary rounded-md ml-2">
                        {req.workingDays} working days
                      </span>
                    </div>
                    
                    {req.unpaidDays > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-md inline-flex font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Includes {req.unpaidDays} unpaid (salary-deducted) {req.unpaidDays === 1 ? 'day' : 'days'}
                      </div>
                    )}
                    
                    {req.userNote && (
                      <p className="text-sm text-muted-foreground mt-2 border-l-2 pl-3 italic">
                        "{req.userNote}"
                      </p>
                    )}
                    {req.adminNote && (
                      <p className="text-sm text-primary mt-2 border-l-2 border-primary pl-3 bg-primary/5 p-2 rounded-r-md">
                        <span className="font-semibold block text-xs uppercase tracking-wider mb-1">Admin Note:</span>
                        {req.adminNote}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center sm:items-start justify-end shrink-0">
                    {req.status === 'pending' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleCancel(req.id)}
                        disabled={cancelRequest.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
