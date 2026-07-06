import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import type { DayStatus, TeamMemberAvailability, CalendarDay } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";

export interface TeamAvailabilityResult {
  data: TeamMemberAvailability[] | undefined;
  isLoading: boolean;
}

export interface UserCalendarResult {
  data: CalendarDay[] | undefined;
  isLoading: boolean;
}

export type UseTeamAvailability = (start: string, end: string) => TeamAvailabilityResult;
export type UseUserCalendar = (userId: number, start: string, end: string) => UserCalendarResult;

const getStatusColor = (status: DayStatus) => {
  switch (status) {
    case 'working': return "bg-primary/20 text-foreground";
    case 'non_working': return "bg-secondary text-secondary-foreground";
    case 'annual_approved': return "bg-primary text-primary-foreground";
    case 'annual_pending': return "bg-primary/50 text-primary-foreground";
    case 'sick_approved': return "bg-accent text-accent-foreground";
    case 'sick_pending': return "bg-accent/50 text-accent-foreground";
    default: return "bg-background border border-border";
  }
};

const getStatusLabel = (status: DayStatus) => {
  switch (status) {
    case 'working': return "Working";
    case 'non_working': return "Off";
    case 'annual_approved': return "Annual Leave";
    case 'annual_pending': return "Annual (Pending)";
    case 'sick_approved': return "Sick Leave";
    case 'sick_pending': return "Sick (Pending)";
    default: return "Unknown";
  }
};

interface TeamAvailabilityViewProps {
  title?: string;
  description?: string;
  useTeamAvailability: UseTeamAvailability;
  useUserCalendar: UseUserCalendar;
}

export default function TeamAvailabilityView({
  title = "Team Availability",
  description = "See who is working and who is off across the team.",
  useTeamAvailability,
  useUserCalendar,
}: TeamAvailabilityViewProps) {
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");

  const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const end = format(endOfMonth(currentDate), "yyyy-MM-dd");

  const { data: teamData, isLoading } = useTeamAvailability(start, end);

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
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

      <Card className="border-border shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : teamData?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No team data available.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card p-3 border-b border-r border-border font-medium min-w-[150px]">
                    Team Member
                  </th>
                  {daysInMonth.map((day) => (
                    <th key={day.toISOString()} className="p-2 border-b border-border font-medium text-center min-w-[32px]">
                      <div className="text-xs text-muted-foreground">{format(day, "eee")}</div>
                      <div>{format(day, "d")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamData?.map((member) => (
                  <tr key={member.userId} className="hover:bg-muted/50 transition-colors border-b border-border last:border-0">
                    <td
                      className="sticky left-0 z-10 bg-card p-3 border-r border-border font-medium whitespace-nowrap cursor-pointer hover:text-primary hover:underline"
                      onClick={() => { setSelectedUserId(member.userId); setSelectedUserName(member.userName); }}
                    >
                      {member.userName}
                    </td>
                    {daysInMonth.map((day) => {
                      const dayStr = format(day, "yyyy-MM-dd");
                      const record = member.days.find(d => d.date === dayStr);
                      // Fallback: weekend non-working
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const status = record?.status || (isWeekend ? 'non_working' : 'working');

                      return (
                        <td key={day.toISOString()} className="p-1 border-border border-r last:border-r-0">
                          <div
                            className={`w-full h-8 rounded flex items-center justify-center text-xs font-medium cursor-default ${getStatusColor(status)}`}
                            title={`${member.userName} - ${format(day, "MMM d")}: ${getStatusLabel(status)}`}
                          >
                            {status === 'annual_approved' ? 'A' : status === 'sick_approved' ? 'S' : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <div className="bg-secondary/50 rounded-xl p-4 border border-border flex flex-wrap gap-4 items-center text-sm">
        <span className="font-semibold mr-2 flex items-center"><Info className="w-4 h-4 mr-2" /> Legend:</span>
        <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${getStatusColor('working')}`} /> Working</div>
        <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${getStatusColor('non_working')}`} /> Off</div>
        <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${getStatusColor('annual_approved')}`} /> Annual Leave</div>
        <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${getStatusColor('sick_approved')}`} /> Sick Leave</div>
      </div>

      {selectedUserId && (
        <UserCalendarDialog
          userId={selectedUserId}
          userName={selectedUserName}
          useUserCalendar={useUserCalendar}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}

function UserCalendarDialog({
  userId,
  userName,
  useUserCalendar,
  onClose,
}: {
  userId: number;
  userName: string;
  useUserCalendar: UseUserCalendar;
  onClose: () => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");

  const { data: days, isLoading } = useUserCalendar(userId, startStr, endStr);

  const daysMap = new Map<string, CalendarDay>();
  if (days) {
    for (const d of days) daysMap.set(d.date, d);
  }

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDialogStatusColor = (status: DayStatus) => {
    switch (status) {
      case 'working': return "bg-primary/20 text-foreground";
      case 'non_working': return "bg-secondary text-secondary-foreground border-border";
      case 'annual_approved': return "bg-primary text-primary-foreground border-primary";
      case 'annual_pending': return "bg-primary/50 text-primary-foreground border-primary/50";
      case 'sick_approved': return "bg-accent text-accent-foreground border-accent";
      case 'sick_pending': return "bg-accent/50 text-accent-foreground border-accent/50";
      default: return "bg-background border border-border";
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{userName}'s Calendar</DialogTitle>
          <DialogDescription>Detailed view of working days and leave.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4 mt-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium">{format(currentDate, "MMMM yyyy")}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center font-medium text-xs text-muted-foreground">{day}</div>
            ))}

            {calendarDays.map((date, i) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const dayData = daysMap.get(dateStr);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const status = dayData?.status || (isWeekend ? 'non_working' : 'working');
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();

              return (
                <div
                  key={i}
                  className={`
                    flex flex-col p-1.5 aspect-square rounded-md border text-xs
                    ${!isCurrentMonth ? "opacity-30" : "opacity-100"}
                    ${getDialogStatusColor(status)}
                  `}
                  title={`${format(date, "MMM d")}: ${getStatusLabel(status)}`}
                >
                  <span className={`font-medium ${isToday(date) ? "underline underline-offset-2" : ""}`}>
                    {format(date, "d")}
                  </span>
                  <span className="mt-auto text-[8px] uppercase tracking-tighter truncate opacity-80 leading-none">
                    {status === 'annual_approved' ? 'Ann' : status === 'sick_approved' ? 'Sick' : status === 'non_working' ? 'Off' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
