import { useClerk } from "@clerk/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMeQueryKey,
  useGetMe,
  useUpdateMe,
} from "@workspace/api-client-react";
import { Loader2, LogOut, User as UserIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Surname is required"),
});

function hasCompleteName(user: { firstName: string; lastName: string }): boolean {
  return Boolean(user.firstName.trim() && user.lastName.trim());
}

export default function ProfileCompletionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signOut } = useClerk();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: user, isLoading, error, refetch } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  });
  const updateMe = useUpdateMe();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: "", lastName: "" },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName.trim(),
        lastName: user.lastName.trim(),
      });
    }
  }, [user, form]);

  const handleSignOut = async () => {
    queryClient.clear();
    await signOut({ redirectUrl: basePath || "/" });
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateMe.mutate(
      {
        data: {
          firstName: values.firstName,
          lastName: values.lastName,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Profile completed" });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: (err: any) => {
          toast({
            title: "Failed to update profile",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-[100dvh] bg-background px-4 py-10 flex items-center justify-center">
        <Card className="w-full max-w-md border-border shadow-sm">
          <CardHeader>
            <CardTitle>Failed to load profile</CardTitle>
            <CardDescription>Please try again or sign out.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={() => refetch()}>Try again</Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasCompleteName(user)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh] bg-background px-4 py-10 flex items-center justify-center">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <UserIcon className="w-6 h-6" />
          </div>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            Enter your name before continuing to Leave Tracker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" autoFocus {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Surname</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSignOut}
                  disabled={updateMe.isPending}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </Button>
                <Button type="submit" disabled={updateMe.isPending}>
                  {updateMe.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Continue
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
