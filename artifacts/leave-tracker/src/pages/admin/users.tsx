import { useState } from "react";
import { 
  useAdminListUsers, getAdminListUsersQueryKey, 
  useAdminDeactivateUser, useAdminActivateUser,
  useAdminDeleteUser, useAdminCreateUser, useAdminUpdateUser, useAdminOverrideBalance
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserX, UserCheck, Trash2, Edit, Save, MoreHorizontal, CalendarClock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";

const userSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Surname required"),
  email: z.string().email(),
  role: z.enum(["user", "admin"]),
  startDate: z.string().min(1, "Start date required"),
  annualEntitlement: z.coerce.number().optional(),
  sickEntitlement: z.coerce.number().optional(),
});

const overrideSchema = z.object({
  adjustment: z.coerce.number(),
  note: z.string().optional(),
});

const editStartDateSchema = z.object({
  startDate: z.string().min(1, "Start date required"),
});

const editNameSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Surname required"),
});

// A member's start date is treated as "unconfirmed" when it still matches the
// day their record was created — the tell-tale sign of the silent today-default
// applied to users auto-provisioned at first sign-in.
function isStartDateUnconfirmed(startDate: string, createdAt: string): boolean {
  return startDate.slice(0, 10) === createdAt.slice(0, 10);
}

export default function AdminUsersPage() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useAdminListUsers(
    { includeInactive },
    { query: { queryKey: getAdminListUsersQueryKey({ includeInactive }) } }
  );

  const activate = useAdminActivateUser();
  const deactivate = useAdminDeactivateUser();
  const remove = useAdminDeleteUser();

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const createMutation = useAdminCreateUser();
  
  const createForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { firstName: "", lastName: "", role: "user", startDate: "" }
  });

  const onSubmitCreate = (data: z.infer<typeof userSchema>) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "User created" });
        setCreateUserOpen(false);
        createForm.reset();
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
    });
  };

  const updateMutation = useAdminUpdateUser();
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const editForm = useForm<z.infer<typeof editStartDateSchema>>({
    resolver: zodResolver(editStartDateSchema),
    defaultValues: { startDate: "" }
  });

  const openEditStartDate = (id: number, startDate: string) => {
    setEditUserId(id);
    editForm.reset({ startDate: startDate.slice(0, 10) });
    setEditOpen(true);
  };

  const onSubmitEdit = (data: z.infer<typeof editStartDateSchema>) => {
    if (!editUserId) return;
    updateMutation.mutate({ id: editUserId, data }, {
      onSuccess: () => {
        toast({ title: "Start date updated", description: "Leave balance recalculated." });
        setEditOpen(false);
        setEditUserId(null);
        editForm.reset();
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
    });
  };

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editNameUserId, setEditNameUserId] = useState<number | null>(null);
  const editNameForm = useForm<z.infer<typeof editNameSchema>>({
    resolver: zodResolver(editNameSchema),
    defaultValues: { firstName: "", lastName: "" }
  });

  const openEditName = (id: number, firstName: string, lastName: string) => {
    setEditNameUserId(id);
    editNameForm.reset({ firstName, lastName });
    setEditNameOpen(true);
  };

  const onSubmitEditName = (data: z.infer<typeof editNameSchema>) => {
    if (!editNameUserId) return;
    updateMutation.mutate({ id: editNameUserId, data }, {
      onSuccess: () => {
        toast({ title: "Name updated" });
        setEditNameOpen(false);
        setEditNameUserId(null);
        editNameForm.reset();
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
    });
  };

  const handleToggleActive = (id: number, active: boolean) => {
    const mutation = active ? deactivate : activate;
    mutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: active ? "User deactivated" : "User activated" });
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to permanently delete this user?")) {
      remove.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "User deleted" });
          queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        }
      });
    }
  };

  // Override Balance Dialog logic
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const overrideMutation = useAdminOverrideBalance();
  const overrideForm = useForm<z.infer<typeof overrideSchema>>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { adjustment: 0, note: "" }
  });

  const onSubmitOverride = (data: z.infer<typeof overrideSchema>) => {
    if (!selectedUserId) return;
    overrideMutation.mutate({ id: selectedUserId, data }, {
      onSuccess: () => {
        toast({ title: "Balance overridden" });
        setOverrideOpen(false);
        setSelectedUserId(null);
        overrideForm.reset();
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
    });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Directory</h1>
          <p className="text-muted-foreground mt-1">Manage team members and leave balances.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIncludeInactive(!includeInactive)}>
            {includeInactive ? "Hide Inactive" : "Show Inactive"}
          </Button>
          <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={createForm.control} name="firstName" render={({field}) => <FormItem><FormLabel>First name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>} />
                    <FormField control={createForm.control} name="lastName" render={({field}) => <FormItem><FormLabel>Surname</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>} />
                  </div>
                  <FormField control={createForm.control} name="email" render={({field}) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field}/></FormControl><FormMessage/></FormItem>} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={createForm.control} name="role" render={({field}) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                        </Select>
                        <FormMessage/>
                      </FormItem>
                    )} />
                    <FormField control={createForm.control} name="startDate" render={({field}) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl><Input type="date" {...field}/></FormControl>
                        <p className="text-xs text-muted-foreground">Drives leave accrual — set the member's actual first working day.</p>
                        <FormMessage/>
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={createForm.control} name="annualEntitlement" render={({field}) => <FormItem><FormLabel>Annual Override (Opt)</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage/></FormItem>} />
                    <FormField control={createForm.control} name="sickEntitlement" render={({field}) => <FormItem><FormLabel>Sick Override (Opt)</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage/></FormItem>} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>Save User</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : (
          users?.map(({ user, balance }) => (
            <Card key={user.id} className={`shadow-sm ${!user.active ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {user.name}
                      {user.role === 'admin' && <Badge variant="secondary" className="text-xs">Admin</Badge>}
                      {!user.active && <Badge variant="outline" className="text-xs border-destructive text-destructive">Inactive</Badge>}
                    </h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        Started {format(new Date(user.startDate), "MMM d, yyyy")}
                      </span>
                      {isStartDateUnconfirmed(user.startDate, user.createdAt) && (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 gap-1">
                          <AlertTriangle className="w-3 h-3" /> Review start date
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-6 w-full md:w-auto overflow-x-auto px-2 md:px-0">
                  <div className="text-center shrink-0">
                    <div className="text-xl font-bold">{balance.available}</div>
                    <div className="text-xs text-muted-foreground">Annual Left</div>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="text-xl font-bold">{balance.sickRemaining}</div>
                    <div className="text-xs text-muted-foreground">Sick Left</div>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="text-xl font-bold text-destructive">{balance.usedUnpaid}</div>
                    <div className="text-xs text-muted-foreground">Unpaid Used</div>
                  </div>
                </div>

                <div className="w-full md:w-auto flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditName(user.id, user.firstName, user.lastName)}>
                        <Edit className="w-4 h-4 mr-2" /> Edit Name
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditStartDate(user.id, user.startDate)}>
                        <CalendarClock className="w-4 h-4 mr-2" /> Edit Start Date
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedUserId(user.id); setOverrideOpen(true); }}>
                        <Edit className="w-4 h-4 mr-2" /> Adjust Balance
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(user.id, user.active)}>
                        {user.active ? <><UserX className="w-4 h-4 mr-2" /> Deactivate</> : <><UserCheck className="w-4 h-4 mr-2" /> Activate</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(user.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={editNameOpen} onOpenChange={(open) => { setEditNameOpen(open); if(!open) setEditNameUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Name</DialogTitle>
          </DialogHeader>
          <Form {...editNameForm}>
            <form onSubmit={editNameForm.handleSubmit(onSubmitEditName)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editNameForm.control} name="firstName" render={({field}) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage/>
                  </FormItem>
                )} />
                <FormField control={editNameForm.control} name="lastName" render={({field}) => (
                  <FormItem>
                    <FormLabel>Surname</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage/>
                  </FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>Save Name</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if(!open) setEditUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Start Date</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4 py-4">
              <FormField control={editForm.control} name="startDate" render={({field}) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <p className="text-xs text-muted-foreground">Drives leave accrual — the member's balance will recalculate after saving.</p>
                  <FormMessage/>
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>Save Start Date</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideOpen} onOpenChange={(open) => { setOverrideOpen(open); if(!open) setSelectedUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Annual Balance</DialogTitle>
          </DialogHeader>
          <Form {...overrideForm}>
            <form onSubmit={overrideForm.handleSubmit(onSubmitOverride)} className="space-y-4 py-4">
              <FormField control={overrideForm.control} name="adjustment" render={({field}) => (
                <FormItem>
                  <FormLabel>Adjustment (days)</FormLabel>
                  <FormControl><Input type="number" step="0.5" {...field} /></FormControl>
                  <FormMessage/>
                </FormItem>
              )} />
              <FormField control={overrideForm.control} name="note" render={({field}) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Carry over from last year" /></FormControl>
                  <FormMessage/>
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={overrideMutation.isPending}>Save Adjustment</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
