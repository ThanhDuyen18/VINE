import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getUserRole, getCurrentUser, getUserProfile } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LeaveRequestForm from "@/components/leave/LeaveRequestForm";
import LeaveHistory from "@/components/leave/LeaveHistory";
import LeaveTypeManagement from "@/components/leave/LeaveTypeManagement";
import LeaderLeaveApproval from "@/components/leave/LeaderLeaveApproval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

const Leave = () => {
  const [role, setRole] = useState<UserRole>('staff');
  const [leaveBalance, setLeaveBalance] = useState(0);

  useEffect(() => {
    const loadUserData = async () => {
      const user = await getCurrentUser();
      if (!user) return;

      const userRole = await getUserRole(user.id);
      setRole(userRole);

      const profile = await getUserProfile(user.id);
      if (profile) {
        setLeaveBalance(profile.annual_leave_balance);
      }
    };
    loadUserData();
  }, []);

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Leave Management
            </h2>
            <p className="text-muted-foreground mt-2">
              {role === 'leader' ? 'Manage team leave requests and approvals' : 'Request and manage your leave'}
            </p>
          </div>


        </div>

        <Tabs defaultValue={role === 'admin' ? "types" : role === 'leader' ? "approval" : "request"} className="w-full">
          <TabsList className="bg-secondary shadow-soft">
            {role === 'admin' && (
              <TabsTrigger value="types" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Leave Types</TabsTrigger>
            )}
            {role === 'leader' && (
              <TabsTrigger value="approval" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Team Approval</TabsTrigger>
            )}
            {role !== 'admin' && (
              <TabsTrigger value="request" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Requests</TabsTrigger>
            )}
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">History</TabsTrigger>
          </TabsList>
          {role === 'admin' && (
            <TabsContent value="types" className="mt-6">
              <LeaveTypeManagement />
            </TabsContent>
          )}
          {role === 'leader' && (
            <TabsContent value="approval" className="mt-6">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Team Leave Approvals:</strong> Review and manage leave requests from your team members below.
                  </p>
                </div>
                <LeaderLeaveApproval />
              </div>
            </TabsContent>
          )}
          {role !== 'admin' && (
            <TabsContent value="request" className="mt-6">
              {role === 'staff' ? (
                <LeaveRequestForm />
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      As a leader, you can submit your own leave requests here.
                    </p>
                  </div>
                  <LeaveRequestForm />
                </div>
              )}
            </TabsContent>
          )}
          <TabsContent value="history" className="mt-6">
            <LeaveHistory role={role} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Leave;
