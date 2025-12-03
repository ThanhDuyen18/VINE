import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// --- INTERFACES ---
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
}

const TeamsManagement = () => {
 const { toast } = useToast();
 const [teams, setTeams] = useState<Team[]>([]);
 const [users, setUsers] = useState<User[]>([]);
 const [loading, setLoading] = useState(true);
 const [createOpen, setCreateOpen] = useState(false);
 const [editOpen, setEditOpen] = useState(false);
 const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
 const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
 const [formData, setFormData] = useState({
  name: "",
  description: "",
  leader_id: "",
 });
 const [submitting, setSubmitting] = useState(false);

 useEffect(() => {
  fetchTeams();
  fetchUsers();
 }, []);

// --- FETCH DATA ---
 const fetchTeams = async () => {
  try {
   const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name');

   if (error) throw error;
   setTeams(data || []);
  } catch (error) {
   console.error('Error fetching teams:', error);
   toast({
    title: "Error",
    description: "Failed to load teams",
    variant: "destructive"
   });
  } finally {
   setLoading(false);
  }
 };

 const fetchUsers = async () => {
  try {
   const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .order('first_name');

   if (error) {
    console.warn('Possible RLS/Permission error when fetching users for Select dropdown:', error);
   }
   
   // Lọc bỏ mọi user có ID là null/undefined hoặc chuỗi rỗng để tránh lỗi Radix UI Select.Item
   const validUsers = (data || []).filter(user => user.id && user.id.trim() !== "");
   setUsers(validUsers);
  } catch (error) {
   console.error('Error fetching users:', error);
  }
 };

// --- HANDLERS ---
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

 const handleCreate = async () => {
  if (!formData.name.trim()) {
   toast({
    title: "Error",
    description: "Team name is required",
    variant: "destructive"
   });
   return;
  }

  setSubmitting(true);
  try {
   const { error } = await supabase.from('teams').insert([{
    name: formData.name,
    description: formData.description || null,
    leader_id: formData.leader_id || null,
   }]);

   if (error) throw error;

   toast({
    title: "Success",
    description: "Team created successfully"
   });
   
   setCreateOpen(false);
   fetchTeams();
  } catch (error) {
   console.error('Error creating team:', error);
   toast({
    title: "Error",
    description: `Failed to create team: ${error.message || 'Check RLS/Permissions'}`,
    variant: "destructive"
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
    variant: "destructive"
   });
   return;
  }

  setSubmitting(true);
  try {
   const { error } = await supabase
    .from('teams')
    .update({
     name: formData.name,
     description: formData.description || null,
     leader_id: formData.leader_id || null,
    })
    .eq('id', selectedTeam.id);

   if (error) throw error;

   toast({
    title: "Success",
    description: "Team updated successfully"
   });
   
   setEditOpen(false);
   fetchTeams();
  } catch (error) {
   console.error('Error updating team:', error);
   toast({
    title: "Error",
    description: `Failed to update team: ${error.message || 'Check RLS/Permissions'}`,
    variant: "destructive"
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
    .from('teams')
    .delete()
    .eq('id', selectedTeam.id);

   if (error) throw error;

   toast({
    title: "Success",
    description: "Team deleted successfully"
   });
   
   setDeleteConfirmOpen(false);
   setSelectedTeam(null);
   fetchTeams();
  } catch (error) {
   console.error('Error deleting team:', error);
   toast({
    title: "Error",
    description: `Failed to delete team: ${error.message || 'Check RLS/Permissions'}`,
    variant: "destructive"
   });
  } finally {
   setSubmitting(false);
  }
 };

 const getLeaderName = (leaderId: string | null) => {
  if (!leaderId) return '-';
  const leader = users.find(u => u.id === leaderId);
  return leader ? `${leader.first_name} ${leader.last_name}` : '-';
 };

 const getMemberCount = async (teamId: string) => {
  const { count } = await supabase
   .from('profiles')
   .select('*', { count: 'exact', head: true })
   .eq('team_id', teamId);
  return count || 0;
 };

// --- RENDER ---
 if (loading) {
  return (
   <div className="flex items-center justify-center py-8">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="ml-2">Loading teams and users...</p>
   </div>
  );
 }

 return (
  <div className="space-y-4">
   <div className="flex justify-end">
    <Button onClick={handleOpenCreate}>
     <Plus className="h-4 w-4 mr-2" />
     Add Team
    </Button>
   </div>

   {teams.length === 0 ? (
    <Card className="p-8 text-center">
     <p className="text-muted-foreground">No teams created yet</p>
    </Card>
   ) : (
    <div className="border rounded-lg overflow-hidden">
     <Table>
      <TableHeader>
       <TableRow>
        <TableHead>Team Name</TableHead>
        <TableHead>Description</TableHead>
        <TableHead>Leader</TableHead>
        <TableHead>Created</TableHead>
        <TableHead className="text-right">Actions</TableHead>
       </TableRow>
      </TableHeader>
      <TableBody>
       {teams.map((team) => (
        <TableRow key={team.id}>
         <TableCell className="font-medium">{team.name}</TableCell>
         <TableCell className="text-muted-foreground">{team.description || '-'}</TableCell>
         <TableCell>{getLeaderName(team.leader_id)}</TableCell>
         <TableCell className="text-muted-foreground">
          {format(new Date(team.created_at), 'MMM dd, yyyy')}
         </TableCell>
         <TableCell className="text-right space-x-2">
          <Button
           variant="ghost"
           size="sm"
           onClick={() => handleOpenEdit(team)}
          >
           <Edit2 className="h-4 w-4" />
          </Button>
          <Button
           variant="ghost"
           size="sm"
           onClick={() => {
            setSelectedTeam(team);
            setDeleteConfirmOpen(true);
           }}
          >
           <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
         </TableCell>
        </TableRow>
       ))}
      </TableBody>
     </Table>
    </div>
   )}

   {/* DIALOG TẠO TEAM (CREATE) - ĐÃ SỬA LỖI JSX VÀ SELECT.ITEM */}
   <Dialog open={createOpen} onOpenChange={setCreateOpen}>
    <DialogContent>
     <DialogHeader>
      <DialogTitle>Create New Team</DialogTitle>
      <DialogDescription>Add a new team to your organization</DialogDescription>
     </DialogHeader>
     <div className="space-y-4">
      <div>
       <Label htmlFor="name">Team Name *</Label>
       <Input
        id="name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Engineering"
       />
      </div>
      <div>
       <Label htmlFor="description">Description</Label>
       <Textarea
        id="description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="Team description (optional)"
        rows={3}
       />
      </div>
      <div>
       <Label htmlFor="leader">Team Leader</Label>
       <Select value={formData.leader_id} onValueChange={(value) => setFormData({ ...formData, leader_id: value })}>
        <SelectTrigger>
         <SelectValue placeholder="Select a team leader" />
        </SelectTrigger>
        <SelectContent>
         {users
          .filter(user => user.id && user.id.trim() !== "")
          .map(user => (
          <SelectItem key={user.id} value={user.id}>
           {user.first_name} {user.last_name} ({user.email})
          </SelectItem>
         ))}
        </SelectContent>
       </Select>
      </div>
     </div>
     <DialogFooter>
      <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
      <Button onClick={handleCreate} disabled={submitting}>
       {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
       Create Team
      </Button>
     </DialogFooter>
    </DialogContent>
   </Dialog>

   {/* DIALOG CHỈNH SỬA TEAM (EDIT) */}
   <Dialog open={editOpen} onOpenChange={setEditOpen}>
    <DialogContent>
     <DialogHeader>
      <DialogTitle>Edit Team</DialogTitle>
      <DialogDescription>Update team information</DialogDescription>
     </DialogHeader>
     <div className="space-y-4">
      <div>
       <Label htmlFor="edit-name">Team Name *</Label>
       <Input
        id="edit-name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Engineering"
       />
      </div>
      <div>
       <Label htmlFor="edit-description">Description</Label>
       <Textarea
        id="edit-description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="Team description (optional)"
        rows={3}
       />
      </div>
      <div>
       <Label htmlFor="edit-leader">Team Leader</Label>
       <Select value={formData.leader_id} onValueChange={(value) => setFormData({ ...formData, leader_id: value })}>
        <SelectTrigger>
         <SelectValue placeholder="Select a team leader" />
        </SelectTrigger>
        <SelectContent>
         {users
          .filter(user => user.id && user.id.trim() !== "")
          .map(user => (
          <SelectItem key={user.id} value={user.id}>
           {user.first_name} {user.last_name} ({user.email})
          </SelectItem>
         ))}
        </SelectContent>
       </Select>
      </div>
     </div>
     <DialogFooter>
      <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
      <Button onClick={handleUpdate} disabled={submitting}>
       {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
       Update Team
      </Button>
     </DialogFooter>
    </DialogContent>
   </Dialog>

   {/* ALERT DIALOG XÓA TEAM */}
   <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
    <AlertDialogContent>
     <AlertDialogHeader>
      <AlertDialogTitle>Delete Team</AlertDialogTitle>
      <AlertDialogDescription>
       Are you sure you want to delete "{selectedTeam?.name}"? This action cannot be undone.
      </AlertDialogDescription>
     </AlertDialogHeader>
     <AlertDialogCancel>Cancel</AlertDialogCancel>
     <AlertDialogAction onClick={handleDelete} disabled={submitting}>
      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Delete
     </AlertDialogAction>
    </AlertDialogContent>
   </AlertDialog>
  </div>
 );
};

export default TeamsManagement;
