import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";

export const debugAttendanceAccess = async () => {
  try {
    console.log('=== DEBUGGING ATTENDANCE ACCESS ===');

    // 1. Check current user
    const user = await getCurrentUser();
    console.log('Current user:', user?.id);

    // 2. Check user role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user?.id)
      .single();

    console.log('User role:', userRole?.role);
    console.log('Role error:', roleError);

    // 3. Try to fetch any attendance record
    const { data: allData, error: allError, count } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: false })
      .limit(1);

    console.log('Total attendance records (count):', count);
    console.log('Sample attendance record:', allData);
    console.log('Fetch error:', allError);

    // 4. Try with filters
    const today = new Date().toISOString().split('T')[0];
    const { data: todayData, error: todayError } = await supabase
      .from('attendance')
      .select('*')
      .gte('timestamp', `${today}T00:00:00`)
      .lte('timestamp', `${today}T23:59:59`);

    console.log('Today attendance records:', todayData?.length || 0);
    console.log('Today error:', todayError);

    // 5. Try full select with profile join
    const { data: fullData, error: fullError } = await supabase
      .from('attendance')
      .select(`
        id,
        user_id,
        type,
        timestamp,
        profiles:user_id (
          first_name,
          last_name,
          email
        )
      `)
      .limit(5);

    console.log('Full select with profiles:', fullData);
    console.log('Full select error:', fullError);

    console.log('=== END DEBUG ===');
  } catch (error) {
    console.error('Debug error:', error);
  }
};
