import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw } from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeleton-table";

interface UserWithRole {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
  current_role: 'admin' | 'leader' | 'staff';
  new_role: 'leader' | 'staff';
  changed: boolean;
}

const RoleManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadUsersWithRoles();
  }, []);

  const loadUsersWithRoles = async () => {
    try {
      setLoading(true);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url')
        .order('first_name');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Map profiles with their roles (exclude admins)
      const usersWithRoles = profiles
        ?.filter(profile => {
          const role = roles?.find(r => r.user_id === profile.id)?.role || 'staff';
          return role !== 'admin'; // Don't show admin users in this list
        })
        .map(profile => ({
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          current_role: (roles?.find(r => r.user_id === profile.id)?.role || 'staff') as 'admin' | 'leader' | 'staff',
          new_role: (roles?.find(r => r.user_id === profile.id)?.role || 'staff') as 'leader' | 'staff',
          changed: false
        })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId: string, newRole: 'leader' | 'staff') => {
    setUsers(users.map(user => 
      user.id === userId 
        ? { ...user, new_role: newRole, changed: newRole !== user.current_role }
        : user
    ));
  };

  const handleReset = (userId: string) => {
    setUsers(users.map(user =>
      user.id === userId
        ? { ...user, new_role: user.current_role, changed: false }
        : user
    ));
  };

  const handleSaveAll = async () => {
    const changedUsers = users.filter(u => u.changed);

    if (changedUsers.length === 0) {
      toast({
        title: "No Changes",
        description: "No role changes to save",
      });
      return;
    }

    setSaving(true);
    try {
      // Update all changed roles
      for (const user of changedUsers) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: user.new_role })
          .eq('user_id', user.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Updated ${changedUsers.length} user role(s) successfully`
      });

      // Reload to sync with database
      await loadUsersWithRoles();
    } catch (error) {
      console.error('Error updating roles:', error);
      toast({
        title: "Error",
        description: "Failed to update roles",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    const email = user.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const changedCount = users.filter(u => u.changed).length;

  if (loading) {
    return <SkeletonTable rows={8} columns={5} />;
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>
            Update user roles (staff ↔ leader). Note: Admin accounts cannot be modified here.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Filters and Action */}
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium text-muted-foreground block mb-2">
            Search Users
          </label>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
          />
        </div>

        {changedCount > 0 && (
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-success hover:bg-success/90 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            Save {changedCount} Change{changedCount !== 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Users Table */}
      <Card className="shadow-medium">
        <CardContent className="p-0">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>New Role</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className={user.changed ? 'bg-warning/5' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {user.first_name} {user.last_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {user.current_role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.new_role}
                          onValueChange={(value: any) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="leader">Leader</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {user.changed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReset(user.id)}
                            className="text-xs"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reset
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="shadow-soft bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm">Role Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            <strong className="text-foreground">Staff:</strong> Regular employees who can manage their own tasks, attendance, and leave.
          </p>
          <p>
            <strong className="text-foreground">Leader:</strong> Team leads who can view and manage their team's tasks, attendance, and leave requests.
          </p>
          <p>
            <strong className="text-foreground">Admin:</strong> System administrators who can manage all aspects of the system (not editable here).
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleManagement;
