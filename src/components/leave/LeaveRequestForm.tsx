import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserRole } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const STANDARD_LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' }
];

const LeaveRequestForm = () => {
  const [type, setType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [reason, setReason] = useState("");
  const [approverId, setApproverId] = useState("");
  const [loading, setLoading] = useState(false);
  const [customLeaveTypes, setCustomLeaveTypes] = useState<any[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [approvers, setApprovers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [leaveBalance, setLeaveBalance] = useState(0);
  const [currentUserId, setCurrentUserId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Load leave types
      const { data: typesData, error: typesError } = await supabase
        .from('leave_types')
        .select('id, name')
        .order('name');

      if (typesError) throw typesError;
      setCustomLeaveTypes(typesData || []);

      // Load approvers (all users with leader role)
      const { data: approverId_data, error: approversError } = await supabase
        .from('user_roles')
        .select('user_id, profiles:user_id(id, first_name, last_name, email)')
        .eq('role', 'leader');

      if (approverId_data) {
        const approversList = approverId_data
          .filter((item: any) => item.profiles)
          .map((item: any) => ({
            id: item.user_id,
            first_name: item.profiles.first_name,
            last_name: item.profiles.last_name,
            email: item.profiles.email
          }));
        setApprovers(approversList);
      }

      // Load shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('id, name, start_time, end_time')
        .order('name');

      if (shiftsError) throw shiftsError;
      setShifts(shiftsData || []);

      // Load leave balance
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('annual_leave_balance, leave_request_count')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (profileData) {
        setLeaveBalance((profileData.annual_leave_balance || 12) - (profileData.leave_request_count || 0));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!startDate || !endDate) {
        toast({
          title: "Error",
          description: "Start date and end date are required",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (!approverId) {
        toast({
          title: "Error",
          description: "Please select an approver",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (startDate > endDate) {
        toast({
          title: "Error",
          description: "Start date must be before or equal to end date",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Check leave balance (max 12 requests per year)
      if (leaveBalance <= 0) {
        toast({
          title: "Error",
          description: "You have reached your maximum leave requests for this year (12 times)",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      // Check for duplicate dates - can't have overlapping leave requests
      const { data: existingRequests, error: checkError } = await supabase
        .from('leave_requests')
        .select('start_date, end_date, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved']);

      if (checkError) throw checkError;

      const newStart = new Date(startDate).getTime();
      const newEnd = new Date(endDate).getTime();

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
        setLoading(false);
        return;
      }

      // Determine if it's a standard or custom type
      const isStandardType = STANDARD_LEAVE_TYPES.some(t => t.value === type);

      const { error } = await supabase.from('leave_requests').insert([{
        user_id: user.id,
        type: isStandardType ? (type as any) : 'custom',
        custom_type_id: !isStandardType ? type : null,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
        status: 'pending',
        approved_by: approverId
      }]);

      if (error) throw error;

      // Create notification for approver
      await supabase.from('notifications').insert([{
        user_id: approverId,
        type: 'leave_request',
        title: 'New Leave Request',
        message: `${currentUserId} has requested leave from ${startDate} to ${endDate}`,
        link: '/leave'
      }]).catch(err => console.log('Notification creation skipped:', err));

      toast({
        title: "Success",
        description: "Leave request submitted successfully"
      });

      resetForm();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast({
        title: "Error",
        description: "Failed to submit leave request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setType("annual");
    setStartDate("");
    setEndDate("");
    setReason("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Leave Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="type">Leave Type *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STANDARD_LEAVE_TYPES.map(lt => (
                  <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                ))}
                {customLeaveTypes.length > 0 && (
                  <>
                    <div className="my-1 h-px bg-border" />
                    {customLeaveTypes.map(lt => (
                      <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Start Date *</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="end">End Date *</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Optional: Provide reason for leave"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default LeaveRequestForm;
