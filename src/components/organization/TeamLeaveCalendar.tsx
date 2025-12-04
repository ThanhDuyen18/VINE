import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, AlertCircle } from "lucide-react";
import { format, eachDayOfInterval, parseISO, isSameMonth, startOfMonth, endOfMonth } from "date-fns";

interface LeaveEvent {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  user_name: string;
}

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const TeamLeaveCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaveEvents, setLeaveEvents] = useState<LeaveEvent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadCalendarData();
  }, [currentMonth]);

  const loadCalendarData = async () => {
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
        .select('id, first_name, last_name')
        .eq('team_id', profile.team_id)
        .order('first_name');

      if (membersError) throw membersError;
      setTeamMembers(membersData || []);

      const memberIds = membersData?.map(m => m.id) || [];

      // Fetch leave requests for current month
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_requests')
        .select('id, user_id, start_date, end_date, status')
        .in('user_id', memberIds);

      if (leaveError) throw leaveError;

      // Map user_id to user_name and filter for current month
      const memberMap = new Map(membersData?.map(m => [m.id, `${m.first_name || ''} ${m.last_name || ''}`.trim()]) || []);

      const leaves = (leaveData || [])
        .filter(leave => {
          const startDate = parseISO(leave.start_date);
          const endDate = parseISO(leave.end_date);
          return (startDate <= monthEnd && endDate >= monthStart);
        })
        .map(leave => ({
          ...leave,
          user_name: memberMap.get(leave.user_id) || 'Unknown'
        }));

      setLeaveEvents(leaves);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      toast({
        title: "Error",
        description: "Failed to load team leave calendar",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getLeavesForDate = (date: Date) => {
    return leaveEvents.filter(leave => {
      const startDate = parseISO(leave.start_date);
      const endDate = parseISO(leave.end_date);
      return date >= startDate && date <= endDate;
    });
  };

  const getDaysInMonth = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return '✓ Approved';
      case 'pending':
        return '⏳ Pending';
      case 'rejected':
        return '✗ Rejected';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Team Leave Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const days = getDaysInMonth();
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Pad the beginning of the month with empty cells
  const startDayOfWeek = firstDay.getDay();
  const paddedDays = Array(startDayOfWeek).fill(null).concat(days);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Team Leave Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="px-3 py-1 text-sm hover:bg-muted rounded"
            >
              ← Prev
            </button>
            <span className="text-sm font-medium min-w-32 text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="px-3 py-1 text-sm hover:bg-muted rounded"
            >
              Next →
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {leaveEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No leave requests for this month</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {daysOfWeek.map(day => (
                <div key={day} className="text-center font-medium text-sm py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 mb-6">
              {paddedDays.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="aspect-square" />;
                }

                const leavesOnDay = getLeavesForDate(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <div
                    key={day.toISOString()}
                    className={`aspect-square p-1 rounded border ${
                      isCurrentMonth ? 'bg-card border-border' : 'bg-muted/50 border-muted'
                    } text-xs`}
                  >
                    <div className="font-semibold text-xs mb-1">{format(day, 'd')}</div>
                    {leavesOnDay.length > 0 && (
                      <div className="space-y-0.5">
                        {leavesOnDay.slice(0, 2).map(leave => (
                          <div key={leave.id} className={`text-xs px-1 py-0.5 rounded ${getStatusColor(leave.status)}`}>
                            {leave.user_name.split(' ')[0]}
                          </div>
                        ))}
                        {leavesOnDay.length > 2 && (
                          <div className="text-xs px-1 text-muted-foreground">
                            +{leavesOnDay.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t pt-4">
              <h4 className="font-semibold text-sm">Leave Requests Detail</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {leaveEvents.map(leave => (
                  <div
                    key={leave.id}
                    className="flex items-start justify-between p-2 bg-muted rounded text-sm"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{leave.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(leave.start_date), 'MMM dd')} - {format(parseISO(leave.end_date), 'MMM dd')}
                      </p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(leave.status)}>
                      {getStatusLabel(leave.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamLeaveCalendar;
