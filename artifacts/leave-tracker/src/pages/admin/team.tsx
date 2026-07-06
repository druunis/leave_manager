import {
  useAdminGetTeamAvailability,
  getAdminGetTeamAvailabilityQueryKey,
  useAdminGetUserCalendar,
  getAdminGetUserCalendarQueryKey,
} from "@workspace/api-client-react";
import TeamAvailabilityView from "@/components/team-availability-view";

export default function AdminTeamPage() {
  return (
    <TeamAvailabilityView
      useTeamAvailability={(start, end) =>
        useAdminGetTeamAvailability(
          { start, end },
          { query: { queryKey: getAdminGetTeamAvailabilityQueryKey({ start, end }) } },
        )
      }
      useUserCalendar={(userId, start, end) =>
        useAdminGetUserCalendar(
          { userId, start, end },
          { query: { enabled: !!userId, queryKey: getAdminGetUserCalendarQueryKey({ userId, start, end }) } },
        )
      }
    />
  );
}
