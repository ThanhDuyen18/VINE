import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Team {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  team_id: string | null;
}

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  team_id: string | null;
}

const TeamsManagement = () => {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [leaders, setLeaders] = useState<User[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    leader_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, team_id")
        .order("first_name");

      if (profilesError) {
        console.warn("Error fetching users:", profilesError);
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) {
        console.warn("Error fetching user roles:", rolesError);
      }

      const roleMap = new Map((rolesData || []).map(r => [r.user_id, r.role]));
      const validUsers = (profilesData || []).filter((user) => user.id && user.id.trim() !== "");
      const leaderUsers = validUsers.filter((user) => roleMap.get(user.id) === 'leader');

      setUsers(validUsers);
      setLeaders(leaderUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const getFilteredMembersForTeam = () => {
    const roleMap = new Map();

    // Fetch role map from users with roles to filter members
    users.forEach((user) => {
      const role = users.find(u => u.id === user.id) ? 'user' : 'unknown';
      roleMap.set(user.id, role);
    });

    return users.filter((user) => {
      // Only allow staff users without a team
      const isStaffRole = !leaders.find((leader) => leader.id === user.id);
      const hasNoTeam = !user.team_id;
      return isStaffRole && hasNoTeam;
    });
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, team_id")
        .eq("team_id", teamId)
        .order("first_name");

      if (error) throw error;

      setTeamMembers(data || []);
      setSelectedMemberIds(new Set((data || []).map((m) => m.id)));
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    }
  };

  const handleOpenCreate = () => {
    setFormData({ name: "", description: "", leader_id: "" });
    setCreateOpen(true);
  };

  const handleOpenEdit = (team: Team) => {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      description: team.description || "",
      leader_id: team.leader_id || "",
    });
    setEditOpen(true);
  };

  const handleOpenMembers = (team: Team) => {
    setSelectedTeam(team);
    fetchTeamMembers(team.id);
    setMembersDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Team name is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("teams").insert([
        {
          name: formData.name,
          description: formData.description || null,
          leader_id: formData.leader_id || null,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team created successfully",
      });

      setCreateOpen(false);
      fetchTeams();
    } catch (error) {
      console.error("Error creating team:", error);
      toast({
        title: "Error",
        description: `Failed to create team: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTeam || !formData.name.trim()) {
      toast({
        title: "Error",
        description: "Team name is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({
          name: formData.name,
          description: formData.description || null,
          leader_id: formData.leader_id || null,
        })
        .eq("id", selectedTeam.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team updated successfully",
      });

      setEditOpen(false);
      fetchTeams();
    } catch (error) {
      console.error("Error updating team:", error);
      toast({
        title: "Error",
        description: `Failed to update team: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTeam) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", selectedTeam.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team deleted successfully",
      });

      setDeleteConfirmOpen(false);
      setSelectedTeam(null);
      fetchTeams();
    } catch (error) {
      console.error("Error deleting team:", error);
      toast({
        title: "Error",
        description: `Failed to delete team: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveMembers = async () => {
    if (!selectedTeam) return;

    setSubmitting(true);
    try {
      const currentMembers = new Set(teamMembers.map((m) => m.id));
      const membersToAdd = Array.from(selectedMemberIds).filter((id) => !currentMembers.has(id));
      const membersToRemove = Array.from(currentMembers).filter((id) => !selectedMemberIds.has(id));

      for (const userId of membersToAdd) {
        const { error } = await supabase
          .from("profiles")
          .update({ team_id: selectedTeam.id })
          .eq("id", userId);
        if (error) throw error;
      }

      for (const userId of membersToRemove) {
        const { error } = await supabase
          .from("profiles")
          .update({ team_id: null })
          .eq("id", userId);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Team members updated successfully",
      });

      setMembersDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error saving team members:", error);
      toast({
        title: "Error",
        description: `Failed to save team members: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getLeaderName = (leaderId: string | null) => {
    if (!leaderId) return "-";
    const leader = users.find((u) => u.id === leaderId);
    return leader ? `${leader.first_name} ${leader.last_name}` : "-";
  };

  const getMemberCount = (teamId: string) => {
    return users.filter((u) => u.team_id === teamId).length;
  };

  const getFullName = (firstName: string | null, lastName: string | null) => {
    return [firstName, lastName].filter(Boolean).join(" ") || "N/A";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded w-32 animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Teams</h3>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Team
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Leader</TableHead>
              <TableHead className="text-center">Members</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {team.description || "-"}
                </TableCell>
                <TableCell>{getLeaderName(team.leader_id)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{getMemberCount(team.id)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenMembers(team)}
                      className="gap-1"
                    >
                      <Users className="h-3 w-3" />
                      Members
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(team)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedTeam(team);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Team Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter team name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter team description (optional)"
              />
            </div>
            <div>
              <Label>Team Leader</Label>
              <Select value={formData.leader_id || "none"} onValueChange={(value) => setFormData({ ...formData, leader_id: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a leader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Leader</SelectItem>
                  {leaders.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {getFullName(user.first_name, user.last_name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {leaders.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">No leaders available. Promote staff to leader role first.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Team Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter team name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter team description (optional)"
              />
            </div>
            <div>
              <Label>Team Leader</Label>
              <Select value={formData.leader_id || "none"} onValueChange={(value) => setFormData({ ...formData, leader_id: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a leader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Leader</SelectItem>
                  {leaders.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {getFullName(user.first_name, user.last_name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {leaders.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">No leaders available. Promote staff to leader role first.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Management Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-2xl max-h-96">
          <DialogHeader>
            <DialogTitle>Manage Team Members - {selectedTeam?.name}</DialogTitle>
            <DialogDescription>
              Select members to add or remove from this team. Only staff without a team can be added.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {selectedTeam && teamMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded border">
                <Checkbox
                  checked={selectedMemberIds.has(member.id)}
                  onCheckedChange={(checked) => {
                    const newIds = new Set(selectedMemberIds);
                    if (checked) {
                      newIds.add(member.id);
                    } else {
                      newIds.delete(member.id);
                    }
                    setSelectedMemberIds(newIds);
                  }}
                />
                <div className="flex-1">
                  <p className="font-medium">{getFullName(member.first_name, member.last_name)}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>
            ))}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-3">Add Staff Members</p>
              {getFilteredMembersForTeam().map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded border bg-secondary/30">
                  <Checkbox
                    checked={selectedMemberIds.has(user.id)}
                    onCheckedChange={(checked) => {
                      const newIds = new Set(selectedMemberIds);
                      if (checked) {
                        newIds.add(user.id);
                      } else {
                        newIds.delete(user.id);
                      }
                      setSelectedMemberIds(newIds);
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{getFullName(user.first_name, user.last_name)}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Staff</Badge>
                </div>
              ))}
              {getFilteredMembersForTeam().length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No available staff members to add</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMembers} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTeam?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={handleDelete} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamsManagement;
