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

      const profile = await getUserProfile(user.id);
      if (!profile?.team_id) {
        toast({
          title: "Error",
          description: "You are not assigned to a team",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, team_id, shift_id')
        .eq('team_id', profile.team_id)
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{getFullName(member.first_name, member.last_name)}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.phone || "-"}</TableCell>
                    <TableCell>{getShiftName(member.shift_id)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeaderTeamMembers;
