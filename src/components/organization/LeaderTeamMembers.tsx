import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { useToast } from "@/hooks/use-toast";
import { Users, Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  team_id: string | null;
  shift_id: string | null;
}

interface Shift {
  id: string;
  name: string;
}

const LeaderTeamMembers = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Unable to identify user",
          variant: "destructive"
        });
        return;
      }

      // Find team where user is the leader
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('leader_id', user.id);

      if (teamsError) throw teamsError;

      if (!teamsData || teamsData.length === 0) {
        toast({
          title: "Error",
          description: "You are not assigned as a team leader",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const teamId = teamsData[0].id;

      // Fetch team members (staff assigned to this team)
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, team_id, shift_id')
        .eq('team_id', teamId)
        .order('first_name');

      if (membersError) throw membersError;

      setMembers(membersData || []);

      // Fetch shifts for reference
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('id, name');

      if (shiftsError) console.warn('Error loading shifts:', shiftsError);
      setShifts(shiftsData || []);
    } catch (error) {
      console.error('Error loading team data:', error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getShiftName = (shiftId: string | null) => {
    if (!shiftId) return "-";
    const shift = shifts.find(s => s.id === shiftId);
    return shift?.name || "-";
  };

  const getFullName = (firstName: string | null, lastName: string | null) => {
    return [firstName, lastName].filter(Boolean).join(" ") || "N/A";
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    setRemoving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('id', selectedMember.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${getFullName(selectedMember.first_name, selectedMember.last_name)} has been removed from the team`
      });

      setMembers(members.filter(m => m.id !== selectedMember.id));
      setRemoveDialogOpen(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive"
      });
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonTable rows={5} columns={4} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Team Members ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No team members found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{getFullName(member.first_name, member.last_name)}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.phone || "-"}</TableCell>
                    <TableCell>{getShiftName(member.shift_id)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedMember(member);
                          setRemoveDialogOpen(true);
                        }}
                        className="gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Remove Member Alert Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedMember && getFullName(selectedMember.first_name, selectedMember.last_name)} from your team? They can be added back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemoveMember}
            disabled={removing}
            className="bg-destructive hover:bg-destructive/90"
          >
            {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Remove
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default LeaderTeamMembers;
