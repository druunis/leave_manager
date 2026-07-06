import { Link } from "wouter";
import { ArrowRight, CheckCircle2, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="py-6 px-6 md:px-12 flex justify-between items-center bg-card shadow-sm border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
            LT
          </div>
          <span className="font-bold text-xl tracking-tight">Leave Tracker</span>
        </div>
        <div className="flex gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="font-medium">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="font-medium">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 md:py-32 px-6 md:px-12 max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground max-w-4xl mx-auto leading-tight mb-6">
            Track your time off, <span className="text-primary">guilt-free.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            A calm, fair, and effortless way for small teams to manage working days, request leave, and keep everything running smoothly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="w-full sm:w-auto font-medium text-lg px-8 py-6 rounded-xl">
                Start Tracking <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-20 bg-card border-y border-border">
          <div className="max-w-6xl mx-auto px-6 md:px-12">
            <div className="grid md:grid-cols-3 gap-10">
              <div className="p-6 rounded-2xl bg-background border border-border">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Effortless Tracking</h3>
                <p className="text-muted-foreground">Log your working days and request time off from your phone in seconds. See your real-time balance instantly.</p>
              </div>
              <div className="p-6 rounded-2xl bg-background border border-border">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Clear & Fair</h3>
                <p className="text-muted-foreground">Everyone plays by the same rules. Transparent tracking of paid vs. unpaid days, sick leave, and annual allowances.</p>
              </div>
              <div className="p-6 rounded-2xl bg-background border border-border">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Admin Made Easy</h3>
                <p className="text-muted-foreground">Approve requests with context, manage team availability, and generate reports without wrestling with spreadsheets.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-10 text-center text-muted-foreground bg-card">
        <p>© {new Date().getFullYear()} Leave Tracker. Built for peace of mind.</p>
      </footer>
    </div>
  );
}
