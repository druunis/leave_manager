import { Redirect } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function RequireProfileComplete({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && !user.profileComplete) {
    return <Redirect to="/onboarding" />;
  }

  return <>{children}</>;
}
