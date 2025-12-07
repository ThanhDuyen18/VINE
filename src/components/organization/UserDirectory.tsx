import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const UserDirectory = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    fetchDirectory();
  }, []);

  const fetchDirectory = async () => {
    try {
      setLoading(true);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("first_name");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name");

      if (teamsError) throw teamsError;

      const { data: shifts, error: shiftsError } = await supabase
        .from("shifts")
        .select("id, name");

      if (shiftsError) throw shiftsError;

      const usersWithDetails = profiles?.map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.id)?.role || "staff",
        teamName: teams?.find((t: any) => t.id === p.team_id)?.name || null,
        shiftName: shifts?.find((s: any) => s.id === p.shift_id)?.name || null,
      })) || [];

      setUsers(usersWithDetails);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching directory:", error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  if (loading) return <div className="text-muted-foreground">Loading directory...</div>;

  return (
    <div className="space-y-4">
      {users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No users found</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(u.first_name, u.last_name)}</AvatarFallback>
                      </Avatar>
                      <div className="font-medium">
                        {u.first_name} {u.last_name}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.phone || "-"}</TableCell>
                  <TableCell>{u.teamName || "-"}</TableCell>
                  <TableCell>{u.shiftName || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.is_approved ? <Badge className="bg-success">Approved</Badge> : <Badge>Pending</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => setSelected(u)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Read-only profile information</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selected.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(selected.first_name, selected.last_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-lg font-semibold">
                    {selected.first_name} {selected.last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">{selected.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div>{selected.phone || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Date of Birth</div>
                  <div>{selected.date_of_birth || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Team</div>
                  <div>{selected.teamName || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Shift</div>
                  <div>{selected.shiftName || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Role</div>
                  <div>{selected.role}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Annual Leave</div>
                  <div>{selected.annual_leave_balance ?? "-"} days</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div>{new Date(selected.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last Online</div>
                  <div>{selected.last_online ? new Date(selected.last_online).toLocaleString() : "-"}</div>
                </div>
              </div>

              {selected.cv_url && (
                <div>
                  <div className="text-xs text-muted-foreground">CV</div>
                  <a className="text-primary" href={selected.cv_url} target="_blank" rel="noreferrer">
                    View CV
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserDirectory;
