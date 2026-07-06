import { useState, useRef } from "react";
import { format } from "date-fns";
import { 
  useAdminListLeaveRequests, 
  getAdminListLeaveRequestsQueryKey,
  useAdminApproveLeaveRequest,
  useAdminRejectLeaveRequest,
  RequestStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check, X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminApprovalsPage() {
  const [filter, setFilter] = useState<RequestStatus | "all">("pending");
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useAdminListLeaveRequests(
    filter === "all" ? undefined : { status: filter },
    { query: { queryKey: getAdminListLeaveRequestsQueryKey(filter === "all" ? undefined : { status: filter }) } }
  );

  const approveMutation = useAdminApproveLeaveRequest();
  const rejectMutation = useAdminRejectLeaveRequest();

  const handleAction = () => {
    if (!selectedReqId || !actionType) return;
    
    const mutation = actionType === "approve" ? approveMutation : rejectMutation;
    
    mutation.mutate({
      id: selectedReqId,
      data: { adminNote: adminNote || undefined }
    }, {
      onSuccess: () => {
        toast({ title: `Request ${actionType}d successfully` });
        setSelectedReqId(null);
        setActionType(null);
        setAdminNote("");
        queryClient.invalidateQueries({ queryKey: getAdminListLeaveRequestsQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: `Failed to ${actionType} request`, description: err.message, variant: "destructive" });
      }
    });
  };

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'approved': return "bg-primary/10 text-primary border-primary/20";
      case 'pending': return "bg-secondary text-secondary-foreground border-border";
      case 'rejected': return "bg-destructive/10 text-destructive border-destructive/20";
      case 'cancelled': return "bg-muted text-muted-foreground border-border";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
        <p className="text-muted-foreground mt-1">Review team leave requests and context.</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(["pending", "all", "approved", "rejected", "cancelled"] as const).map(f => (
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
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)
        ) : requests?.length === 0 ? (
          <Card className="bg-secondary/30 border-dashed border-2 shadow-none">
            <CardContent className="p-12 text-center">
              <Check className="w-12 h-12 mx-auto text-primary mb-4 opacity-50" />
              <h3 className="text-lg font-semibold">All caught up</h3>
              <p className="text-muted-foreground mt-1">There are no {filter !== 'all' ? filter : ''} requests to review.</p>
            </CardContent>
          </Card>
        ) : (
          requests?.map((adminReq) => {
            const req = adminReq.request;
            return (
              <Card key={req.id} className="overflow-hidden shadow-sm border-border">
                <div className="flex flex-col md:flex-row">
                  <div className={`w-full md:w-2 h-2 md:h-auto shrink-0 ${req.type === 'annual' ? 'bg-primary' : 'bg-accent'}`} />
                  <CardContent className="flex-1 p-5 md:p-6 flex flex-col md:flex-row gap-6">
                    
                    {/* Left col: user & context */}
                    <div className="flex-1 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{adminReq.userName}</h3>
                          <p className="text-sm text-muted-foreground">{adminReq.userEmail}</p>
                        </div>
                        <Badge variant="outline" className={`capitalize px-2.5 py-0.5 border ${getStatusColor(req.status)}`}>
                          {req.status}
                        </Badge>
                      </div>
                      
                      <div className="bg-secondary/50 rounded-lg p-3 border border-border text-sm grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-0.5">Accrued so far</span>
                          <span className="font-medium">{adminReq.accruedAtDate} days</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-0.5">Annual Used</span>
                          <span className="font-medium">{adminReq.usedAnnual} days</span>
                        </div>
                      </div>
                    </div>

                    {/* Mid col: request details */}
                    <div className="flex-[1.5] space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize text-foreground">{req.type} Leave</span>
                        <span className="text-sm px-2 py-0.5 bg-secondary rounded-md ml-2 font-medium">
                          {req.workingDays} days
                        </span>
                      </div>
                      
                      <div className="text-sm">
                        <span className="text-muted-foreground mr-2">Dates:</span>
                        <span className="font-medium">
                          {format(new Date(req.startDate), "MMM d, yyyy")} → {format(new Date(req.endDate), "MMM d, yyyy")}
                        </span>
                      </div>
                      
                      {req.unpaidDays > 0 && (
                        <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded-md font-medium">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>This request includes {req.unpaidDays} unpaid (salary-deducted) days.</span>
                        </div>
                      )}
                      
                      {adminReq.sickOverAllowance && req.type === 'sick' && (
                        <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded-md font-medium">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>User has exceeded paid sick allowance.</span>
                        </div>
                      )}

                      {req.userNote && (
                        <p className="text-sm text-muted-foreground mt-2 border-l-2 border-border pl-3 italic">
                          "{req.userNote}"
                        </p>
                      )}
                    </div>

                    {/* Right col: Actions */}
                    <div className="shrink-0 flex md:flex-col gap-2 justify-end">
                      {req.status === 'pending' ? (
                        <>
                          <Button 
                            className="w-full"
                            onClick={() => { setSelectedReqId(req.id); setActionType("approve"); }}
                          >
                            <Check className="w-4 h-4 mr-2" /> Approve
                          </Button>
                          <Button 
                            variant="outline" 
                            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                            onClick={() => { setSelectedReqId(req.id); setActionType("reject"); }}
                          >
                            <X className="w-4 h-4 mr-2" /> Reject
                          </Button>
                        </>
                      ) : req.adminNote ? (
                        <div className="w-full bg-secondary p-3 rounded-lg border border-border text-sm">
                          <span className="font-semibold block text-xs uppercase tracking-wider mb-1 text-muted-foreground">Admin Note</span>
                          {req.adminNote}
                        </div>
                      ) : null}
                    </div>

                  </CardContent>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!selectedReqId} onOpenChange={(open) => !open && setSelectedReqId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adminNote">Add a note (Optional)</Label>
              <Textarea 
                id="adminNote" 
                placeholder={actionType === "reject" ? "Reason for rejection..." : "Any comments..."}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="resize-none"
              />
              {actionType === "reject" && <p className="text-xs text-muted-foreground">Adding a reason helps the user understand why the request was rejected.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedReqId(null)}>Cancel</Button>
            <Button 
              variant={actionType === "reject" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              Confirm {actionType === "approve" ? "Approval" : "Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
