import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getUserRole, getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UsersManagement from "@/components/organization/UsersManagement";
import RoleManagement from "@/components/organization/RoleManagement";
import AttendanceSettings from "@/components/organization/AttendanceSettings";
import TeamsManagement from "@/components/organization/TeamsManagement";
import ShiftsManagement from "@/components/organization/ShiftsManagement";
import LeaderTeamDashboard from "@/components/organization/LeaderTeamDashboard";
import LeaderTeamMembers from "@/components/organization/LeaderTeamMembers";
import TeamLeaveCalendar from "@/components/organization/TeamLeaveCalendar";

const Organization = () => {
  const [role, setRole] = useState<UserRole>('staff');

  useEffect(() => {
    const loadRole = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      const userRole = await getUserRole(user.id);
      setRole(userRole);
    };
    loadRole();
  }, []);

  if (role === 'staff') {
    return (
      <DashboardLayout role={role}>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground mt-2">Only leaders and admins can access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Leader view
  if (role === 'leader') {
    return (
      <DashboardLayout role={role}>
        <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
          <div className="mb-2">
            <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Team Management
            </h2>
            <p className="text-muted-foreground mt-2">Manage your team, track attendance and manage leave requests</p>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="bg-secondary shadow-soft">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Dashboard</TabsTrigger>
              <TabsTrigger value="members" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Team Members</TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Leave Calendar</TabsTrigger>
            </TabsList>
            <TabsContent value="dashboard" className="mt-6">
              <LeaderTeamDashboard />
            </TabsContent>
            <TabsContent value="members" className="mt-6">
              <LeaderTeamMembers />
            </TabsContent>
            <TabsContent value="calendar" className="mt-6">
              <TeamLeaveCalendar />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    );
  }

  // Admin view
  return (
    <DashboardLayout role={role}>
      <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
        <div className="mb-2">
          <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Organization
          </h2>
          <p className="text-muted-foreground mt-2">Manage teams, users, shifts and settings</p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="bg-secondary shadow-soft">
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Users & Approval</TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Teams</TabsTrigger>
            <TabsTrigger value="shifts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Shifts</TabsTrigger>
            <TabsTrigger value="roles" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Role Management</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Attendance</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6">
            <UsersManagement />
          </TabsContent>
          <TabsContent value="teams" className="mt-6">
            <TeamsManagement />
          </TabsContent>
          <TabsContent value="shifts" className="mt-6">
            <ShiftsManagement />
          </TabsContent>
          <TabsContent value="roles" className="mt-6">
            <RoleManagement />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <AttendanceSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Organization;
