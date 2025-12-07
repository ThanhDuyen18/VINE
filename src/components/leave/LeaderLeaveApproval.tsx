import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

interface LeaveRequest {
  id: string;
  user_id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

const LeaderLeaveApproval = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

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
      const { data: teamMembers, error: teamError } = await supabase
        .from('profiles')
        .select('id')
        .eq('team_id', profile.team_id);

      if (teamError) throw teamError;

      const memberIds = teamMembers?.map(m => m.id) || [];

      // Fetch pending leave requests for team members
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*')
        .in('user_id', memberIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (leaveError) throw leaveError;

      if (!leaveData || leaveData.length === 0) {
        setLeaveRequests([]);
        return;
      }

      // Fetch user profiles
      const userIds = [...new Set(leaveData.map(l => l.user_id))];
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
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

      setLeaveRequests(leavesWithProfiles as LeaveRequest[]);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast({
        title: "Error",
        description: "Failed to load leave requests",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLeaveRequests();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('team-leave-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchLeaveRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaveRequests]);

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
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
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request approved"
      });

      setApprovalDialogOpen(false);
      setSelectedRequest(null);
      fetchLeaveRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: "Failed to approve leave request",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) {
      console.log('No selected request to reject');
      return;
    }

    setActionLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.log('No current user found');
        return;
      }

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      await updateLeaveBalanceForReject()

      toast({
        title: "Success",
        description: "Leave request rejected"
      });

      setRejectionDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      fetchLeaveRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: "Failed to reject leave request",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const updateLeaveBalanceForReject = async () => {
    const user = await getCurrentUser();
    // Load leave balance
    const leaveBalance = await getLeaveBalance();
    let newBalance = leaveBalance + 1;
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

  const getLeaveBalance = async () => {
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
    return profileData.annual_leave_balance;
  }

  const getFullName = (firstName: string | null, lastName: string | null) => {
    return [firstName, lastName].filter(Boolean).join(" ") || "N/A";
  };

  const getLeaveTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'annual': 'Annual Leave',
      'sick': 'Sick Leave',
      'personal': 'Personal Leave',
      'unpaid': 'Unpaid Leave',
      'custom': 'Custom Leave'
    };
    return labels[type] || type;
  };

  if (loading) {
    return <SkeletonTable rows={5} columns={5} />;
  }

  return (
    <div className="space-y-4">
      {leaveRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No pending leave requests</p>
          <p className="text-sm">All team leave requests have been reviewed</p>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground mb-4">
            {leaveRequests.length} pending request{leaveRequests.length !== 1 ? 's' : ''}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((request) => {
                  const startDate = new Date(request.start_date);
                  const endDate = new Date(request.end_date);
                  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {getFullName(request.profiles?.first_name, request.profiles?.last_name)}
                        <div className="text-xs text-muted-foreground">{request.profiles?.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getLeaveTypeLabel(request.type)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd')}
                      </TableCell>
                      <TableCell>{days}d</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(request.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 hover:bg-green-50"
                            onClick={() => {
                              setSelectedRequest(request);
                              setApprovalDialogOpen(true);
                            }}
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 hover:bg-red-50"
                            onClick={() => {
                              setSelectedRequest(request);
                              setRejectionDialogOpen(true);
                            }}
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Approval Confirmation Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Leave Request?</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this leave request?
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium">Employee</Label>
                <p className="text-sm">
                  {getFullName(selectedRequest.profiles?.first_name, selectedRequest.profiles?.last_name)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Leave Type</Label>
                <p className="text-sm">{getLeaveTypeLabel(selectedRequest.type)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Date Range</Label>
                <p className="text-sm">
                  {format(new Date(selectedRequest.start_date), 'MMM dd, yyyy')} -{" "}
                  {format(new Date(selectedRequest.end_date), 'MMM dd, yyyy')}
                </p>
              </div>
              {selectedRequest.reason && (
                <div>
                  <Label className="text-sm font-medium">Reason</Label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.reason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApprovalDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this leave request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium">Employee</Label>
                <p className="text-sm">
                  {getFullName(selectedRequest.profiles?.first_name, selectedRequest.profiles?.last_name)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Rejection Reason</Label>
                <Textarea
                  placeholder="Explain why you're rejecting this request..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectionDialogOpen(false);
                setRejectionReason("");
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaderLeaveApproval;
