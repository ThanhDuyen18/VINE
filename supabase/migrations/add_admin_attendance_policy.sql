-- Enable RLS on attendance table if not already enabled
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own attendance records
DROP POLICY IF EXISTS "Users can view their own attendance" ON public.attendance;
CREATE POLICY "Users can view their own attendance"
  ON public.attendance
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own attendance records
DROP POLICY IF EXISTS "Users can insert their own attendance" ON public.attendance;
CREATE POLICY "Users can insert their own attendance"
  ON public.attendance
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for admin to view all attendance records
DROP POLICY IF EXISTS "Admins can view all attendance records" ON public.attendance;
CREATE POLICY "Admins can view all attendance records"
  ON public.attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy for admin to insert attendance records (for manual entries)
DROP POLICY IF EXISTS "Admins can insert attendance records" ON public.attendance;
CREATE POLICY "Admins can insert attendance records"
  ON public.attendance
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
