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
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  // Auto-fill month and year based on date filters
  useEffect(() => {
    if (filterStartDate) {
      const date = new Date(filterStartDate);
      const newMonth = (date.getMonth() + 1).toString().padStart(2, '0');
      const newYear = date.getFullYear().toString();
      if (filterMonth !== newMonth) setFilterMonth(newMonth);
      if (filterYear !== newYear) setFilterYear(newYear);
    } else if (filterEndDate) {
      const date = new Date(filterEndDate);
      const newMonth = (date.getMonth() + 1).toString().padStart(2, '0');
      const newYear = date.getFullYear().toString();
      if (filterMonth !== newMonth) setFilterMonth(newMonth);
      if (filterYear !== newYear) setFilterYear(newYear);
    }
  }, [filterStartDate, filterEndDate, filterMonth, filterYear]);

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

      await updateLeaveBalanceForReject()
      
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

  const updateLeaveBalanceForReject = async () => {
    const user = await getCurrentUser();
    // Load leave balance
    const {data: profileData, error: profileError} = await supabase
        .from('profiles')
        .select('annual_leave_balance')
        .eq('id', user.id)
        .single();

    if (profileError) {
      console.error('Error loading profile data:', profileError);
      return;
    }
    let newBalance = profileData.annual_leave_balance + 1;
    if (newBalance >12) newBalance = 12;

    const {error: updateError} = await supabase
        .from('profiles')
        .update({annual_leave_balance: newBalance})
        .eq('id', user.id);

    if (updateError) {
      console.error('Error updating leave balance:', updateError);
      return;
    }
  }

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
      // reason: leave.reason
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
    // Always check status filter
    const matchStatus = filterStatus === 'all' || leave.status === filterStatus;

    // If date range filters are used, prioritize them over month/year
    if (filterStartDate || filterEndDate) {
      const leaveStartTime = new Date(leave.start_date).getTime();
      const leaveEndTime = new Date(leave.end_date).getTime();

      let matchDateRange = true;

      // Normalize filter start to start of day (inclusive)
      if (filterStartDate) {
        const filterStart = new Date(filterStartDate);
        filterStart.setHours(0, 0, 0, 0);
        matchDateRange = matchDateRange && leaveStartTime >= filterStart.getTime();
      }

      // Normalize filter end to end of day (inclusive)
      if (filterEndDate) {
        const filterEnd = new Date(filterEndDate);
        filterEnd.setHours(23, 59, 59, 999);
        matchDateRange = matchDateRange && leaveEndTime <= filterEnd.getTime();
      }
      return matchStatus && matchDateRange;
    }

    // Otherwise use month/year filters (based on leave.start_date)
    const startDate = new Date(leave.start_date);
    const leaveMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
    const leaveYear = startDate.getFullYear().toString();

    const matchMonth = !filterMonth || leaveMonth === filterMonth;
    const matchYear = !filterYear || leaveYear === filterYear;

    return matchStatus && matchMonth && matchYear;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap items-end">
        <div>
          <Label htmlFor="filter-status">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-start-date">Start Date</Label>
          <Input
            id="filter-start-date"
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="filter-end-date">End Date</Label>
          <Input
            id="filter-end-date"
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="filter-month">Month</Label>
          <select
            id="filter-month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            disabled={!!(filterStartDate || filterEndDate)}
            className="mt-1 px-3 py-2 border rounded-md bg-background disabled:opacity-50 disabled:cursor-not-allowed"
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
            disabled={!!(filterStartDate || filterEndDate)}
            className="mt-1 px-3 py-2 border rounded-md bg-background disabled:opacity-50 disabled:cursor-not-allowed"
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
              <TableHead>Actions</TableHead>
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
                <TableCell className="capitalize">
                  {editingId === leave.id ? (
                    <Input
                      type="text"
                      value={leave.type}
                      disabled
                      className="w-full"
                    />
                  ) : (
                    leave.type.replace('_', ' ')
                  )}
                </TableCell>
                <TableCell>
                  {editingId === leave.id ? (
                    <Input
                      type="date"
                      value={editData?.start_date || ''}
                      onChange={(e) => setEditData({ ...editData, start_date: e.target.value })}
                    />
                  ) : (
                    format(new Date(leave.start_date), 'MMM dd, yyyy')
                  )}
                </TableCell>
                <TableCell>
                  {editingId === leave.id ? (
                    <Input
                      type="date"
                      value={editData?.end_date || ''}
                      onChange={(e) => setEditData({ ...editData, end_date: e.target.value })}
                    />
                  ) : (
                    format(new Date(leave.end_date), 'MMM dd, yyyy')
                  )}
                </TableCell>
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
                <TableCell>
                  <div className="flex gap-2 flex-wrap">
                    {role === 'staff' && leave.status === 'pending' && (
                      <>
                        {editingId === leave.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleEditSave(leave.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditStart(leave)}
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(leave.id)}
                              disabled={deleting === leave.id}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {(role === 'leader' || role === 'admin') && leave.status === 'pending' && (
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LeaveHistory;
