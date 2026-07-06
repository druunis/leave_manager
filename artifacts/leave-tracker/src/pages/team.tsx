import {
  useGetTeamAvailability,
  getGetTeamAvailabilityQueryKey,
  useGetTeamMemberCalendar,
  getGetTeamMemberCalendarQueryKey,
} from "@workspace/api-client-react";
import TeamAvailabilityView from "@/components/team-availability-view";

export default function TeamPage() {
  return (
    <TeamAvailabilityView
      useTeamAvailability={(start, end) =>
        useGetTeamAvailability(
          { start, end },
          { query: { queryKey: getGetTeamAvailabilityQueryKey({ start, end }) } },
        )
      }
      useUserCalendar={(userId, start, end) =>
        useGetTeamMemberCalendar(
          { userId, start, end },
          { query: { enabled: !!userId, queryKey: getGetTeamMemberCalendarQueryKey({ userId, start, end }) } },
        )
      }
    />
  );
}
