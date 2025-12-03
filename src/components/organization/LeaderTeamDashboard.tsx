import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle, TrendingUp } from "lucide-react";
import { subDays, startOfDay } from "date-fns";

const LeaderTeamDashboard = () => {
  const [metricsData, setMetricsData] = useState({
    onTimeRatio7Days: 0,
    onTimeRatio30Days: 0,
    totalWorkingHours: 0,
    pendingLeaveRequests: 0,
    teamSize: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
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
        .select('id')
        .eq('team_id', profile.team_id);

      if (membersError) throw membersError;
      const memberIds = membersData?.map(m => m.id) || [];
      const teamSize = memberIds.length;

      // Fetch attendance data for metrics
      const today = new Date();
      const sevenDaysAgo = subDays(today, 7);
      const thirtyDaysAgo = subDays(today, 30);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('id, user_id, type, timestamp')
        .in('user_id', memberIds);

      if (attendanceError) throw attendanceError;

      // Calculate on-time check-in ratio and working hours
      const attendance = attendanceData || [];
      
      // Group by user and date for each period
      const calculateMetrics = (daysAgo: number) => {
        const cutoffDate = subDays(today, daysAgo);
        const attendanceInPeriod = attendance.filter(a => {
          const timestamp = new Date(a.timestamp);
          return timestamp >= cutoffDate && timestamp <= today;
        });

        // Group by user and date
        const userDays = new Map<string, Set<string>>();
        attendanceInPeriod.forEach(a => {
          const timestamp = new Date(a.timestamp);
          const dateKey = timestamp.toISOString().split('T')[0];
          const userId = a.user_id;
          
          if (!userDays.has(userId)) {
            userDays.set(userId, new Set());
          }
          userDays.get(userId)?.add(dateKey);
        });

        // Count on-time check-ins (has both check_in and check_out in the day)
        let totalDays = 0;
        let onTimeDays = 0;

        userDays.forEach((dates) => {
          dates.forEach(() => {
            totalDays += 1;
            // If there's attendance in the day, count as present
            onTimeDays += 1;
          });
        });

        return totalDays > 0 ? Math.round((onTimeDays / totalDays) * 100) : 0;
      };

      const onTimeRatio7Days = calculateMetrics(7);
      const onTimeRatio30Days = calculateMetrics(30);

      // Calculate total working hours (rough estimate: time between first check-in and last check-out per day)
      const hoursMap = new Map<string, number>();
      const dailyAttendance = new Map<string, { checkIn?: Date; checkOut?: Date }>();

      attendance.forEach(a => {
        const timestamp = new Date(a.timestamp);
        const dateKey = timestamp.toISOString().split('T')[0];
        const dayKey = `${a.user_id}-${dateKey}`;

        if (!dailyAttendance.has(dayKey)) {
          dailyAttendance.set(dayKey, {});
        }

        const day = dailyAttendance.get(dayKey)!;
        if (a.type === 'check_in') {
          day.checkIn = timestamp;
        } else if (a.type === 'check_out') {
          day.checkOut = timestamp;
        }
      });

      let totalHours = 0;
      dailyAttendance.forEach((day) => {
        if (day.checkIn && day.checkOut) {
          const diffMs = day.checkOut.getTime() - day.checkIn.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours > 0 && diffHours <= 24) {
            totalHours += diffHours;
          }
        }
      });

      // Fetch pending leave requests
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_requests')
        .select('id')
        .in('user_id', memberIds)
        .eq('status', 'pending');

      if (leaveError) throw leaveError;
      const pendingLeaveRequests = leaveData?.length || 0;

      setMetricsData({
        onTimeRatio7Days,
        onTimeRatio30Days,
        totalWorkingHours: Math.round(totalHours * 10) / 10,
        pendingLeaveRequests,
        teamSize
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load team metrics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    subtext,
    unit = ""
  }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    subtext?: string;
    unit?: string;
  }) => (
    <Card className="bg-gradient-to-br from-card to-muted">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-primary">
          {value}{unit}
        </div>
        {subtext && (
          <p className="text-xs text-muted-foreground mt-2">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Team Overview
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Team Size"
          value={metricsData.teamSize}
          icon={AlertCircle}
          unit=" members"
        />
        <MetricCard
          title="On-time (7 Days)"
          value={metricsData.onTimeRatio7Days}
          icon={Clock}
          unit="%"
          subtext="Check-in compliance rate"
        />
        <MetricCard
          title="On-time (30 Days)"
          value={metricsData.onTimeRatio30Days}
          icon={Clock}
          unit="%"
          subtext="Monthly average"
        />
        <MetricCard
          title="Total Hours"
          value={metricsData.totalWorkingHours}
          icon={Clock}
          unit=" hrs"
          subtext="Total work hours logged"
        />
        <MetricCard
          title="Pending Leaves"
          value={metricsData.pendingLeaveRequests}
          icon={AlertCircle}
          unit=" requests"
          subtext="Awaiting approval"
        />
      </div>
    </div>
  );
};

export default LeaderTeamDashboard;
