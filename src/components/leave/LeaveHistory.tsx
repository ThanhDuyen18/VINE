import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { Edit2, Trash2 } from "lucide-react";

interface LeaveRequest {
    id: string;
    user_id: string;
    type: string;
    start_date: string;
    end_date: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    approved_by: string | null;
    approved_at: string | null;
    profiles: {
        first_name: string | null;
        last_name: string | null;
    } | null;
}

const LeaveHistory = ({ role }: { role: UserRole }) => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLeaves = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const leaveQuery = supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (role === 'staff') {
        leaveQuery.eq('user_id', user.id);
      }

      const { data: leaveData, error: leaveError } = await leaveQuery;
      if (leaveError) throw leaveError;

      if (!leaveData || leaveData.length === 0) {
        setLeaves([]);
        return;
      }

      const userIds = [...new Set(leaveData.map(l => l.user_id))];
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);

      if (profileError) console.warn('Error loading profile data:', profileError);

      const profileMap = (profileData || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const leavesWithProfiles = leaveData.map(leave => ({
        ...leave,
        profiles: profileMap[leave.user_id] || null
      }));

      setLeaves(leavesWithProfiles as LeaveRequest[]);
    } catch (error) {
      console.error('Error fetching leaves:', error instanceof Error ? error.message : JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchLeaves();

    const channel = supabase
      .channel('leaves-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchLeaves();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaves]);

  const handleApprove = async (leaveId: string) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', leaveId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request approved"
      });

      fetchLeaves();
    } catch (error) {
      console.error('Error approving leave:', error);
      toast({
        title: "Error",
        description: "Failed to approve leave",
        variant: "destructive"
      });
    }
  };

  const handleReject = async (leaveId: string) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', leaveId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request rejected"
      });

      fetchLeaves();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      toast({
        title: "Error",
        description: "Failed to reject leave",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (leaveId: string) => {
    if (!confirm('Are you sure you want to delete this leave request?')) return;

    try {
      setDeleting(leaveId);
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', leaveId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request deleted"
      });

      fetchLeaves();
    } catch (error) {
      console.error('Error deleting leave:', error);
      toast({
        title: "Error",
        description: "Failed to delete leave request",
        variant: "destructive"
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleEditStart = (leave: LeaveRequest) => {
    setEditingId(leave.id);
    setEditData({
      start_date: leave.start_date,
      end_date: leave.end_date,
      reason: leave.reason
    });
  };

  const handleEditSave = async (leaveId: string) => {
    try {
      if (!editData.start_date || !editData.end_date) {
        toast({
          title: "Error",
          description: "Start date and end date are required",
          variant: "destructive"
        });
        return;
      }

      if (editData.start_date > editData.end_date) {
        toast({
          title: "Error",
          description: "Start date must be before or equal to end date",
          variant: "destructive"
        });
        return;
      }

      const user = await getCurrentUser();
      if (!user) return;

      // Check for duplicate dates
      const { data: existingRequests, error: checkError } = await supabase
        .from('leave_requests')
        .select('start_date, end_date, status')
        .eq('user_id', user.id)
        .neq('id', leaveId)
        .in('status', ['pending', 'approved']);

      if (checkError) throw checkError;

      const newStart = new Date(editData.start_date).getTime();
      const newEnd = new Date(editData.end_date).getTime();

      const hasConflict = existingRequests?.some(req => {
        const existingStart = new Date(req.start_date).getTime();
        const existingEnd = new Date(req.end_date).getTime();
        return !(newEnd < existingStart || newStart > existingEnd);
      });

      if (hasConflict) {
        toast({
          title: "Error",
          description: "You already have a leave request for this date range",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('leave_requests')
        .update({
          start_date: editData.start_date,
          end_date: editData.end_date,
          reason: editData.reason
        })
        .eq('id', leaveId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request updated"
      });

      setEditingId(null);
      setEditData(null);
      fetchLeaves();
    } catch (error) {
      console.error('Error updating leave:', error);
      toast({
        title: "Error",
        description: "Failed to update leave request",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <SkeletonTable rows={6} columns={role === 'leader' || role === 'admin' ? 7 : 5} />;
  }

  const filteredLeaves = leaves.filter(leave => {
    const startDate = new Date(leave.start_date);
    const leaveMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
    const leaveYear = startDate.getFullYear().toString();

    const matchMonth = !filterMonth || leaveMonth === filterMonth;
    const matchYear = !filterYear || leaveYear === filterYear;
    const matchStatus = !filterStatus || leave.status === filterStatus;

    let matchDateRange = true;
    if (filterStartDate || filterEndDate) {
      const leaveStartTime = new Date(leave.start_date).getTime();
      const leaveEndTime = new Date(leave.end_date).getTime();

      if (filterStartDate) {
        const filterStart = new Date(filterStartDate).getTime();
        matchDateRange = matchDateRange && leaveEndTime >= filterStart;
      }

      if (filterEndDate) {
        const filterEnd = new Date(filterEndDate).getTime();
        matchDateRange = matchDateRange && leaveStartTime <= filterEnd;
      }
    }

    return matchMonth && matchYear && matchStatus && matchDateRange;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap items-end">
        <div>
          <Label htmlFor="filter-month">Month</Label>
          <select
            id="filter-month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="mt-1 px-3 py-2 border rounded-md bg-background"
          >
            <option value="">All Months</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                {new Date(2000, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filter-year">Year</Label>
          <select
            id="filter-year"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="mt-1 px-3 py-2 border rounded-md bg-background"
          >
            <option value="">All Years</option>
            {Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {(role === 'leader' || role === 'admin') && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              {(role === 'leader' || role === 'admin') && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeaves.map((leave) => (
              <TableRow key={leave.id}>
                {(role === 'leader' || role === 'admin') && (
                  <TableCell>
                    {leave.profiles ? 
                      `${leave.profiles.first_name} ${leave.profiles.last_name}` 
                      : `User ID: ${leave.user_id?.substring(0, 8)}`}
                  </TableCell>
                )}
                <TableCell className="capitalize">{leave.type.replace('_', ' ')}</TableCell>
                <TableCell>{format(new Date(leave.start_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell>{format(new Date(leave.end_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      leave.status === 'approved' ? 'default' :
                      leave.status === 'rejected' ? 'destructive' : 'secondary'
                    }
                  >
                    {leave.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(leave.created_at), 'MMM dd, yyyy')}
                </TableCell>
                {(role === 'leader' || role === 'admin') && (
                  <TableCell>
                    {leave.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(leave.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(leave.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LeaveHistory;
