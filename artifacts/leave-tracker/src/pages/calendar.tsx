import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isBefore, startOfDay, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, Info, type LucideIcon } from "lucide-react";
import { useGetCalendar, getGetCalendarQueryKey, useMarkCalendarDays, DayStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const getStatusColor = (status: DayStatus) => {
  switch (status) {
    case 'working': return "bg-primary/10 text-primary border-primary/20";
    case 'non_working': return "bg-secondary text-secondary-foreground border-border";
    case 'annual_approved': return "bg-primary text-primary-foreground border-primary";
    case 'annual_pending': return "bg-primary/50 text-primary-foreground border-primary/50";
    case 'annual_rejected': return "bg-destructive/10 text-destructive border-destructive/20";
    case 'sick_approved': return "bg-accent text-accent-foreground border-accent";
    case 'sick_pending': return "bg-accent/50 text-accent-foreground border-accent/50";
    case 'sick_rejected': return "bg-destructive/10 text-destructive border-destructive/20";
    default: return "bg-background border-border text-foreground";
  }
};

const getStatusLabel = (status: DayStatus) => {
  switch (status) {
    case 'working': return "Working";
    case 'non_working': return "Off (Weekend/Holiday)";
    case 'annual_approved': return "Annual Leave";
    case 'annual_pending': return "Annual (Pending)";
    case 'annual_rejected': return "Annual (Rejected)";
    case 'sick_approved': return "Sick Leave";
    case 'sick_pending': return "Sick (Pending)";
    case 'sick_rejected': return "Sick (Rejected)";
    default: return "Unknown";
  }
};

type LeaveKind = 'annual' | 'sick';
type DayDisplayState = 'taken' | 'approved_upcoming' | 'pending' | 'other';

const getLeaveKind = (status: DayStatus): LeaveKind | null => {
  if (status === 'annual_approved' || status === 'annual_pending') return 'annual';
  if (status === 'sick_approved' || status === 'sick_pending') return 'sick';
  return null;
};

interface DayDisplay {
  state: DayDisplayState;
  className: string;
  label: string;
  Icon: LucideIcon | null;
}

// Combine leave status with whether the date is on/before today to categorize a
// day into: taken (approved + past/today), approved-upcoming (approved + future),
// or pending (awaiting approval). Non-leave days fall back to the base styling.
const getDayDisplay = (status: DayStatus, date: Date): DayDisplay => {
  const kind = getLeaveKind(status);
  if (!kind) {
    return { state: 'other', className: getStatusColor(status), label: getStatusLabel(status), Icon: null };
  }

  const approved = status === 'annual_approved' || status === 'sick_approved';
  const onOrBeforeToday = isToday(date) || isBefore(date, startOfDay(new Date()));

  if (approved && onOrBeforeToday) {
    return {
      state: 'taken',
      className: kind === 'annual'
        ? "bg-primary/15 text-primary border-primary/25"
        : "bg-accent/60 text-accent-foreground border-accent-foreground/20",
      label: kind === 'annual' ? "Annual · Taken" : "Sick · Taken",
      Icon: CheckCircle2,
    };
  }

  if (approved) {
    return {
      state: 'approved_upcoming',
      className: kind === 'annual'
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-accent text-accent-foreground border-accent",
      label: kind === 'annual' ? "Annual Leave" : "Sick Leave",
      Icon: null,
    };
  }

  // pending — obviously provisional dashed outline, not just a lighter shade
  return {
    state: 'pending',
    className: kind === 'annual'
      ? "bg-transparent text-primary border-2 border-dashed border-primary"
      : "bg-transparent text-accent-foreground border-2 border-dashed border-accent-foreground/50",
    label: kind === 'annual' ? "Annual · Pending" : "Sick · Pending",
    Icon: Clock,
  };
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");

  const { data: days, isLoading } = useGetCalendar(
    { start: startStr, end: endStr },
    { query: { queryKey: getGetCalendarQueryKey({ start: startStr, end: endStr }) } }
  );

  const markDays = useMarkCalendarDays();

  const daysMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof days>[number]>();
    if (days) {
      for (const d of days) {
        map.set(d.date, d);
      }
    }
    return map;
  }, [days]);

  const toggleDay = (date: Date, currentStatus: DayStatus) => {
    // Only toggle between working and non_working
    if (currentStatus !== 'working' && currentStatus !== 'non_working' && currentStatus !== undefined) {
      toast({
        title: "Cannot toggle day",
        description: `This day has a fixed status: ${getStatusLabel(currentStatus)}`,
        variant: "destructive"
      });
      return;
    }

    const dateStr = format(date, "yyyy-MM-dd");
    const newStatus = currentStatus === 'working' ? 'non_working' : 'working';

    markDays.mutate({
      data: { dates: [dateStr], status: newStatus }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({ start: startStr, end: endStr }) });
      },
      onError: () => {
        toast({
          title: "Failed to update day",
          description: "Please try again later.",
          variant: "destructive"
        });
      }
    });
  };

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Manage your working days and see your time off.</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-lg">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-medium w-32 text-center">
            {format(currentDate, "MMMM yyyy")}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <Card className="p-4 md:p-6 mb-8 border-border">
        <div className="grid grid-cols-7 gap-1 md:gap-4 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-medium text-xs text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1 md:gap-4">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square md:aspect-auto md:h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 md:gap-4">
            {calendarDays.map((date, i) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const dayData = daysMap.get(dateStr);
              // default to non_working on weekends, working on weekdays if no data
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const defaultStatus = isWeekend ? 'non_working' : 'working';
              const status = dayData?.status || defaultStatus;
              
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isInteractive = status === 'working' || status === 'non_working';
              const display = getDayDisplay(status, date);
              const { Icon } = display;
              
              return (
                <button
                  key={i}
                  disabled={!isInteractive}
                  onClick={() => isInteractive && toggleDay(date, status)}
                  className={`
                    flex flex-col items-center md:items-start p-1 md:p-3 aspect-square md:aspect-auto md:h-28 rounded-xl border text-sm transition-all
                    ${!isCurrentMonth ? "opacity-30" : "opacity-100"}
                    ${display.className}
                    ${isInteractive ? "hover:brightness-95 cursor-pointer shadow-sm hover:shadow active:scale-95" : "cursor-default opacity-80"}
                  `}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className={`font-semibold ${isToday(date) ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center -m-1 md:m-0" : ""}`}>
                      {format(date, "d")}
                    </span>
                  </div>
                  
                  <div className="hidden md:flex items-center gap-1 mt-auto w-full text-left">
                    {Icon && <Icon className="w-3 h-3 shrink-0" />}
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 truncate">
                      {display.label}
                    </span>
                  </div>
                  
                  {/* Mobile indicator */}
                  <div className="md:hidden mt-auto flex items-center justify-center h-3">
                    {display.state === 'taken' && <CheckCircle2 className="w-3 h-3" />}
                    {display.state === 'pending' && <div className="w-2.5 h-2.5 rounded-full border-2 border-current bg-transparent" />}
                    {display.state === 'approved_upcoming' && <div className="w-2 h-2 rounded-full bg-current" />}
                    {display.state === 'other' && <div className="w-2 h-2 rounded-full bg-current opacity-40" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <div className="bg-secondary/50 rounded-xl p-4 border border-border flex flex-wrap gap-x-4 gap-y-2 items-center text-sm">
        <span className="font-semibold mr-2 flex items-center"><Info className="w-4 h-4 mr-2" /> Legend:</span>
        <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full border ${getStatusColor('working')}`} /> Working</div>
        <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full border ${getStatusColor('non_working')}`} /> Off</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Taken</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary border border-primary" /> Approved (upcoming)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-dashed border-primary bg-transparent" /> <Clock className="w-3.5 h-3.5 text-primary" /> Pending</div>
        <span className="text-xs text-muted-foreground w-full md:w-auto md:ml-auto">Annual (emerald) &amp; sick (light green) leave share these states.</span>
      </div>
    </div>
  );
}
