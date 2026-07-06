import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { useGetMe, getGetMeQueryKey, useUpdateMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User as UserIcon, Loader2, Calendar, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Surname is required"),
});

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() }
  });

  const updateMe = useUpdateMe();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: "", lastName: "" },
  });

  useEffect(() => {
    if (user) {
      form.reset({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateMe.mutate({
      data: { firstName: values.firstName, lastName: values.lastName }
    }, {
      onSuccess: () => {
        toast({ title: "Profile updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48 mb-8" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal information.</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-border shadow-sm overflow-hidden">
          <div className="bg-secondary p-8 flex flex-col items-center justify-center border-b border-border">
            <div className="w-24 h-24 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-3xl shadow-sm mb-4">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-bold">{user.name}</h2>
            <p className="text-muted-foreground">{user.email}</p>
            <div className="flex gap-2 mt-4">
              <Badge variant="outline" className="bg-background">
                <Shield className="w-3 h-3 mr-1" />
                <span className="capitalize">{user.role}</span>
              </Badge>
              <Badge variant="outline" className="bg-background">
                <Calendar className="w-3 h-3 mr-1" />
                Start date {format(new Date(user.startDate), "MMM d, yyyy")}
              </Badge>
            </div>
          </div>
          
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="pt-4 border-t border-border flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      updateMe.isPending ||
                      (form.watch("firstName") === user.firstName &&
                        form.watch("lastName") === user.lastName)
                    }
                  >
                    {updateMe.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
