import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";

import { useEffect, useRef, useState } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useClerk, ClerkLoading, ClerkLoaded } from "@clerk/react";
import { Loader2 } from "lucide-react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import MainLayout from "@/components/layout";
import ProfileCompletionGate from "@/components/profile-completion-gate";

import DashboardPage from "@/pages/dashboard";
import CalendarPage from "@/pages/calendar";
import RequestsPage from "@/pages/requests";
import NewRequestPage from "@/pages/new-request";
import NotificationsPage from "@/pages/notifications";
import ProfilePage from "@/pages/profile";
import TeamPage from "@/pages/team";

import AdminOverviewPage from "@/pages/admin/overview";
import AdminApprovalsPage from "@/pages/admin/approvals";
import AdminTeamPage from "@/pages/admin/team";
import AdminUsersPage from "@/pages/admin/users";
import AdminReportsPage from "@/pages/admin/reports";
import AdminSettingsPage from "@/pages/admin/settings";

const queryClient = new QueryClient();

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod. Do NOT gate.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

function FullPageLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(152 60% 35%)", // Primary Emerald
    colorForeground: "hsl(152 30% 15%)",
    colorMutedForeground: "hsl(152 15% 45%)",
    colorDanger: "hsl(0 70% 50%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(152 30% 15%)",
    colorNeutral: "hsl(152 15% 85%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary font-medium hover:text-primary/80",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-primary",
    alertText: "text-destructive",
    logoBox: "mx-auto mb-4",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "bg-secondary hover:bg-secondary/80 border-border text-foreground",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-medium",
    formFieldInput: "bg-background border-input text-foreground focus:ring-ring focus:border-ring",
    footerAction: "bg-muted/50 py-4",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border-destructive text-destructive",
    otpCodeFieldInput: "bg-background border-input text-foreground",
    formFieldRow: "mb-4",
    main: "p-8",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkApiAuthBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const [registeredAuthKey, setRegisteredAuthKey] = useState<string | undefined>();
  const currentAuthKey = !isLoaded
    ? undefined
    : isSignedIn
      ? `signed-in:${userId ?? ""}`
      : "signed-out";

  useEffect(() => {
    if (!isLoaded) {
      setRegisteredAuthKey(undefined);
      return;
    }

    if (!isSignedIn) {
      setAuthTokenGetter(null);
      setRegisteredAuthKey("signed-out");
      return () => {
        setAuthTokenGetter(null);
      };
    }

    const authKey = `signed-in:${userId ?? ""}`;
    setAuthTokenGetter(() => getToken());
    setRegisteredAuthKey(authKey);

    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken, isLoaded, isSignedIn, userId]);

  if (registeredAuthKey !== currentAuthKey) {
    return <FullPageLoader />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      
      {/* Protected Routes wrapper — pathless Route always matches remaining paths */}
      <Route>
        <Show when="signed-in">
          <ProfileCompletionGate>
            <MainLayout>
              <Switch>
                <Route path="/dashboard" component={DashboardPage} />
                <Route path="/calendar" component={CalendarPage} />
                <Route path="/requests" component={RequestsPage} />
                <Route path="/requests/new" component={NewRequestPage} />
                <Route path="/team" component={TeamPage} />
                <Route path="/notifications" component={NotificationsPage} />
                <Route path="/profile" component={ProfilePage} />
                
                {/* Admin Routes */}
                <Route path="/admin" component={AdminOverviewPage} />
                <Route path="/admin/approvals" component={AdminApprovalsPage} />
                <Route path="/admin/team" component={AdminTeamPage} />
                <Route path="/admin/users" component={AdminUsersPage} />
                <Route path="/admin/reports" component={AdminReportsPage} />
                <Route path="/admin/settings" component={AdminSettingsPage} />
                
                <Route component={NotFound} />
              </Switch>
            </MainLayout>
          </ProfileCompletionGate>
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-in" />
        </Show>
      </Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to track your time",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start tracking your time today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ErrorBoundary>
          <ClerkLoading>
            <FullPageLoader />
          </ClerkLoading>
          <ClerkLoaded>
            <ClerkApiAuthBridge>
              <AppRoutes />
            </ClerkApiAuthBridge>
          </ClerkLoaded>
        </ErrorBoundary>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <TooltipProvider>
        <ClerkProviderWithRoutes />
        <Toaster />
      </TooltipProvider>
    </WouterRouter>
  );
}

export default App;
