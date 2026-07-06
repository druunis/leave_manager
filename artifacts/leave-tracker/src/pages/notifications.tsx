import { format } from "date-fns";
import { useListNotifications, getListNotificationsQueryKey, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey() }
  });

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    });
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "All caught up" });
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    });
  };

  const hasUnread = notifications?.some(n => !n.read);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Updates on your leave requests.</p>
        </div>
        {hasUnread && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markAllRead.isPending}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : notifications?.length === 0 ? (
          <Card className="bg-secondary/30 border-dashed border-2 shadow-none">
            <CardContent className="p-12 text-center">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold">All caught up</h3>
              <p className="text-muted-foreground mt-1">You have no notifications.</p>
            </CardContent>
          </Card>
        ) : (
          notifications?.map((notif) => (
            <Card 
              key={notif.id} 
              className={`overflow-hidden transition-all duration-200 ${notif.read ? 'bg-background opacity-75 shadow-none border-border' : 'bg-card shadow-sm border-primary/20'}`}
            >
              <CardContent className="p-5 flex gap-4">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${notif.read ? 'bg-transparent' : 'bg-primary'}`} />
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start gap-4">
                    <h4 className={`font-semibold ${notif.read ? 'text-foreground' : 'text-primary'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                      {format(new Date(notif.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90">
                    {notif.message}
                  </p>
                </div>
                {!notif.read && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="shrink-0 text-muted-foreground hover:text-primary"
                    onClick={() => handleMarkRead(notif.id)}
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
