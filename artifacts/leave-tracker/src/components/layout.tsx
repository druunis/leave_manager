import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { CalendarDays, LayoutDashboard, Send, Bell, User as UserIcon, LogOut, FileText, Settings, ShieldCheck, Users } from "lucide-react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
    }
  });

  const handleSignOut = async () => {
    queryClient.clear();
    await signOut({ redirectUrl: basePath || "/" });
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/team", label: "Team", icon: Users },
    { href: "/requests", label: "Requests", icon: Send },
    { href: "/notifications", label: "Notifications", icon: Bell },
  ];

  const adminItems = [
    { href: "/admin", label: "Overview", icon: ShieldCheck },
    { href: "/admin/approvals", label: "Approvals", icon: FileText },
    { href: "/admin/users", label: "Directory", icon: UserIcon },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border p-6 fixed h-full z-10 overflow-y-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
            LT
          </div>
          <span className="font-bold text-xl tracking-tight">Leave Tracker</span>
        </div>

        <nav className="flex-1 space-y-8">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
              Me
            </h3>
            <div className="space-y-1">
              {navItems.map((item) => {
                const active = location === item.href || location.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href}>
                    <span className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                      active ? "bg-primary/10 text-primary font-medium" : "text-card-foreground hover:bg-muted"
                    }`}>
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {user?.role === "admin" && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
                Admin
              </h3>
              <div className="space-y-1">
                {adminItems.map((item) => {
                  const active = location === item.href || location.startsWith(`${item.href}/`);
                  return (
                    <Link key={item.href} href={item.href}>
                      <span className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                        active ? "bg-primary/10 text-primary font-medium" : "text-card-foreground hover:bg-muted"
                      }`}>
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div className="pt-6 border-t border-border mt-auto space-y-1">
          <Link href="/profile">
            <span className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-card-foreground hover:bg-muted transition-colors cursor-pointer">
              <UserIcon className="w-5 h-5" />
              My Profile
            </span>
          </Link>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around p-2 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const active = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href}>
              <span className={`flex flex-col items-center p-2 rounded-xl min-w-[64px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}>
                <item.icon className={`w-6 h-6 ${active ? "fill-primary/20" : ""}`} />
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              </span>
            </Link>
          );
        })}
        {user?.role === "admin" && (
          <Link href="/admin">
            <span className={`flex flex-col items-center p-2 rounded-xl min-w-[64px] ${
              location.startsWith("/admin") ? "text-primary" : "text-muted-foreground"
            }`}>
              <ShieldCheck className={`w-6 h-6 ${location.startsWith("/admin") ? "fill-primary/20" : ""}`} />
              <span className="text-[10px] mt-1 font-medium">Admin</span>
            </span>
          </Link>
        )}
      </nav>
    </div>
  );
}
