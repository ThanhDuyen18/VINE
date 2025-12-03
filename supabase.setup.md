-- ========================================================
-- VINE HRM - COMPLETE SUPABASE DATABASE SETUP (FINAL)
-- Version: 2.0 (Full migration with crucial fixes)
-- ========================================================
-- This file contains all SQL commands needed to set up the complete
-- Vine HRM database schema with proper RLS policies, triggers, and functions.
--
-- EXECUTION GUIDE:
-- 1. Copy all SQL in Supabase SQL Editor
-- 2. Run in order (execute the entire script)
-- 3. Verify all tables, functions, and policies are created
-- ========================================================

-- ========================================================
-- 1) EXTENSIONS
-- ========================================================
-- Enable UUID generation for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================
-- 2) ENUM TYPES
-- ========================================================
-- Define enumeration types used throughout the application
DO $$
BEGIN
 -- User role enumeration: admin, leader, staff
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
  CREATE TYPE app_role AS ENUM ('admin', 'leader', 'staff');
 END IF;
 
 -- Leave type enumeration: standard types (annual, sick, personal, unpaid)
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type') THEN
  CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'personal', 'unpaid', 'custom');
 END IF;
 
 -- Leave request status: pending (awaiting approval), approved, rejected
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
  CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
 END IF;
 
 -- Task status: workflow stages for task management
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
 END IF;
 
 -- Task priority: urgency levels
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
 END IF;
 
 -- Room booking status: approval workflow
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
  CREATE TYPE booking_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
 END IF;
 
 -- Attendance type: check-in and check-out records
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_type') THEN
  CREATE TYPE attendance_type AS ENUM ('check_in', 'check_out');
 END IF;
END$$;

-- ========================================================
-- 3) CORE TABLES
-- ========================================================

-- TEAMS: Organizational team management
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SHIFTS: Work shift definitions
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- USER_ROLES: User role assignment
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- PROFILES: User profile information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  cv_url TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  phone TEXT,
  date_of_birth DATE,
  annual_leave_balance INTEGER DEFAULT 12,
  last_online TIMESTAMPTZ,
  -- User Approval fields
  is_approved BOOLEAN DEFAULT false,
  approval_date TIMESTAMPTZ,
  approval_rejected BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ATTENDANCE: Check-in/check-out records
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type attendance_type NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TASK_COLUMNS: Custom task column templates
CREATE TABLE IF NOT EXISTS public.task_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, created_by)
);

-- TASKS: Task management - CẬP NHẬT RÀNG BUỘC CHO CREATOR_ID
-- LƯU Ý: Xóa và tạo lại bảng tasks để cập nhật khóa ngoại
DROP TABLE IF EXISTS public.tasks CASCADE;
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, 
  
  -- ĐÃ SỬA: Đổi CASCADE thành SET NULL để giữ lịch sử nhiệm vụ
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, 
  
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  column_id UUID REFERENCES public.task_columns(id) ON DELETE SET NULL,
  deadline TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TASK_COMMENTS: Comments on tasks
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MEETING_ROOMS: Room inventory
CREATE TABLE IF NOT EXISTS public.meeting_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  capacity INTEGER NOT NULL DEFAULT 1,
  equipment TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROOM_BOOKINGS: Meeting room reservations
CREATE TABLE IF NOT EXISTS public.room_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  attendees UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LEAVE_TYPES: Custom leave type definitions
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, created_by)
);

-- LEAVE_REQUESTS: Leave request workflow
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type leave_type NOT NULL,
  custom_type_id UUID REFERENCES public.leave_types(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status leave_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NOTIFICATIONS: User notifications system
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUDIT_LOGS: System audit trail
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================
-- 4) ENABLE ROW LEVEL SECURITY (RLS)
-- ========================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY; -- ĐÃ KÍCH HOẠT LẠI SAU KHI TẠO LẠI
ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- 5) HELPER FUNCTIONS
-- ========================================================

-- Function: Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
 SELECT EXISTS (
  SELECT 1
  FROM public.user_roles
  WHERE user_id = _user_id AND role = _role
 )
$$;

-- Function: Get user's team ID
CREATE OR REPLACE FUNCTION public.get_user_team(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
 SELECT team_id FROM public.profiles WHERE id = _user_id
$$;

-- Function: Automatically update updated_at timestamp on record modification
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Initialize new user profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 -- Insert profile with metadata from auth signup
 INSERT INTO public.profiles (id, email, first_name, last_name, is_approved)
 VALUES (
  NEW.id,
  NEW.email,
  COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
  COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
  false -- New users require admin approval
 )
 ON CONFLICT (id) DO NOTHING;
 
 -- Insert default role 'staff' for new user
 INSERT INTO public.user_roles (user_id, role)
 VALUES (NEW.id, 'staff')
 ON CONFLICT (user_id) DO NOTHING;
 
 RETURN NEW;
END;
$$;

-- ========================================================
-- 6) TRIGGERS (Auto-update timestamps and initialization)
-- ========================================================

-- Trigger: Create profile and role when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
 AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps on all tables
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
-- CẦN TẠO LẠI TRIGGER VÌ BẢNG TASKS ĐÃ BỊ XÓA VÀ TẠO LẠI
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_columns_updated_at ON public.task_columns;
CREATE TRIGGER update_task_columns_updated_at BEFORE UPDATE ON public.task_columns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_rooms_updated_at ON public.meeting_rooms;
CREATE TRIGGER update_meeting_rooms_updated_at BEFORE UPDATE ON public.meeting_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_room_bookings_updated_at ON public.room_bookings;
CREATE TRIGGER update_room_bookings_updated_at BEFORE UPDATE ON public.room_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_types_updated_at ON public.leave_types;
CREATE TRIGGER update_leave_types_updated_at BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================================
-- 7) ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

-- TEAMS: Team visibility and management
DROP POLICY IF EXISTS "Everyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Everyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- SHIFTS: Shift visibility and management
DROP POLICY IF EXISTS "Everyone can view shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins can manage shifts" ON public.shifts;
CREATE POLICY "Everyone can view shifts" ON public.shifts FOR SELECT USING (true);
CREATE POLICY "Admins can manage shifts" ON public.shifts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES: Role assignments
-- Users can view only their own role, admins can manage all roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
-- Fix lỗi Staff/Leader update
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles
  FOR ALL 
  USING (public.has_role(auth.uid(), 'admin')) 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROFILES: User profile visibility and updates
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Leaders can view team profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Leaders can view team profiles" ON public.profiles FOR SELECT USING (
 public.has_role(auth.uid(), 'leader') AND team_id = public.get_user_team(auth.uid())
);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ATTENDANCE: Attendance record visibility
DROP POLICY IF EXISTS "Users can view their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Leaders can view team attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can create their own attendance" ON public.attendance;
CREATE POLICY "Users can view their own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Leaders can view team attendance" ON public.attendance FOR SELECT USING (
 public.has_role(auth.uid(), 'leader') AND 
 EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND team_id = public.get_user_team(auth.uid()))
);
CREATE POLICY "Admins can view all attendance" ON public.attendance FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create their own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);

-- TASKS: Task visibility and management
DROP POLICY IF EXISTS "Users can view assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Leaders can view team tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can delete any tasks" ON public.tasks;
-- CẦN CHẠY LẠI TẤT CẢ CÁC CHÍNH SÁCH DƯỚI ĐÂY VÌ BẢNG TASKS ĐÃ ĐƯỢC TẠO LẠI
CREATE POLICY "Users can view assigned tasks" ON public.tasks FOR SELECT USING (
 auth.uid() = assignee_id OR auth.uid() = creator_id
);
CREATE POLICY "Leaders can view team tasks" ON public.tasks FOR SELECT USING (
 public.has_role(auth.uid(), 'leader') AND team_id = public.get_user_team(auth.uid())
);
CREATE POLICY "Admins can view all tasks" ON public.tasks FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update their tasks" ON public.tasks FOR UPDATE USING (
 auth.uid() = assignee_id OR auth.uid() = creator_id OR 
 public.has_role(auth.uid(), 'leader') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Users can delete their own tasks" ON public.tasks FOR DELETE USING (auth.uid() = creator_id);
CREATE POLICY "Admins can delete any tasks" ON public.tasks FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- TASK_COLUMNS: Column visibility
DROP POLICY IF EXISTS "Users can view their own columns" ON public.task_columns;
DROP POLICY IF EXISTS "Admins can view all columns" ON public.task_columns;
CREATE POLICY "Users can view their own columns" ON public.task_columns FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Admins can view all columns" ON public.task_columns FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create columns" ON public.task_columns FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own columns" ON public.task_columns FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their own columns" ON public.task_columns FOR DELETE USING (auth.uid() = created_by);

-- TASK_COMMENTS: Comment visibility
DROP POLICY IF EXISTS "Users can view comments on their tasks" ON public.task_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.task_comments;
CREATE POLICY "Users can view comments on their tasks" ON public.task_comments FOR SELECT USING (
 EXISTS (
  SELECT 1 FROM public.tasks WHERE id = task_id AND (assignee_id = auth.uid() OR creator_id = auth.uid())
 )
);
CREATE POLICY "Users can create comments" ON public.task_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- MEETING_ROOMS: Room visibility and management
DROP POLICY IF EXISTS "Everyone can view active meeting rooms" ON public.meeting_rooms;
DROP POLICY IF EXISTS "Admins can manage meeting rooms" ON public.meeting_rooms;
CREATE POLICY "Everyone can view active meeting rooms" ON public.meeting_rooms FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage meeting rooms" ON public.meeting_rooms FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ROOM_BOOKINGS: Booking visibility and approval workflow
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.room_bookings;
DROP POLICY IF EXISTS "Leaders can view team bookings" ON public.room_bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.room_bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.room_bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.room_bookings;
DROP POLICY IF EXISTS "Leaders and admins can update bookings" ON public.room_bookings;
CREATE POLICY "Users can view their own bookings" ON public.room_bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Leaders can view team bookings" ON public.room_bookings FOR SELECT USING (
 public.has_role(auth.uid(), 'leader') AND 
 EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND team_id = public.get_user_team(auth.uid()))
);
CREATE POLICY "Admins can view all bookings" ON public.room_bookings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create bookings" ON public.room_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bookings" ON public.room_bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Leaders and admins can update bookings" ON public.room_bookings FOR UPDATE USING (
 public.has_role(auth.uid(), 'leader') OR public.has_role(auth.uid(), 'admin')
);

-- LEAVE_TYPES: Custom leave type visibility
DROP POLICY IF EXISTS "Everyone can view leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can manage leave types" ON public.leave_types;
CREATE POLICY "Everyone can view leave types" ON public.leave_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage leave types" ON public.leave_types FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- LEAVE_REQUESTS: Leave request visibility and approval workflow
DROP POLICY IF EXISTS "Users can view their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Leaders can view team leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can create leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can update their pending requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Leaders and admins can update leave requests" ON public.leave_requests;
CREATE POLICY "Users can view their own leave requests" ON public.leave_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Leaders can view team leave requests" ON public.leave_requests FOR SELECT USING (
 public.has_role(auth.uid(), 'leader') AND 
 EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND team_id = public.get_user_team(auth.uid()))
);
CREATE POLICY "Admins can view all leave requests" ON public.leave_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create leave requests" ON public.leave_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their pending requests" ON public.leave_requests FOR UPDATE USING (
 auth.uid() = user_id AND status = 'pending'
);
CREATE POLICY "Leaders and admins can update leave requests" ON public.leave_requests FOR UPDATE USING (
 public.has_role(auth.uid(), 'leader') OR public.has_role(auth.uid(), 'admin')
);

-- NOTIFICATIONS: Notification visibility and management
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- AUDIT_LOGS: Audit log visibility
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ========================================================
-- 8) PERFORMANCE INDEXES
-- ========================================================
-- Profile indexes
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_shift_id ON public.profiles(shift_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON public.profiles(is_approved);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON public.attendance(timestamp);

-- Task indexes
-- DROP và CREATE INDEXES cho TASKS vì bảng đã được tạo lại
DROP INDEX IF EXISTS idx_tasks_assignee_id;
DROP INDEX IF EXISTS idx_tasks_creator_id;
DROP INDEX IF EXISTS idx_tasks_team_id;
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_column_id;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON public.tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON public.tasks(column_id);

-- Task column indexes
CREATE INDEX IF NOT EXISTS idx_task_columns_created_by ON public.task_columns(created_by);

-- Room booking indexes
CREATE INDEX IF NOT EXISTS idx_room_bookings_room_id ON public.room_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_user_id ON public.room_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_start_time ON public.room_bookings(start_time);

-- Leave request indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ========================================================
-- 9) STORAGE POLICIES (For file uploads)
-- ========================================================

-- AVATARS POLICIES
DROP POLICY IF EXISTS "Allow user to manage their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow user to update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow everyone to view avatars" ON storage.objects;

CREATE POLICY "Allow user to manage their avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
 bucket_id = 'avatars' AND 
 name ILIKE ('avatars/' || auth.uid()::text || '-%')
);

CREATE POLICY "Allow user to update their avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
 bucket_id = 'avatars' AND 
 name ILIKE ('avatars/' || auth.uid()::text || '-%')
);

CREATE POLICY "Allow everyone to view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- DOCUMENTS POLICIES
DROP POLICY IF EXISTS "Allow user to upload their documents only" ON storage.objects;
DROP POLICY IF EXISTS "Allow user to update their documents only" ON storage.objects;
DROP POLICY IF EXISTS "Allow user to view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins/leaders to view all documents" ON storage.objects;

CREATE POLICY "Allow user to upload their documents only"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
 bucket_id = 'documents' AND
 name ILIKE ('documents/' || auth.uid()::text || '-%')
);

CREATE POLICY "Allow user to update their documents only"
ON storage.objects FOR UPDATE
TO authenticated
USING (
 bucket_id = 'documents' AND
 name ILIKE ('documents/' || auth.uid()::text || '-%')
);

CREATE POLICY "Allow user to view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
 bucket_id = 'documents' AND 
 name ILIKE ('documents/' || auth.uid()::text || '-%')
);

CREATE POLICY "Allow admins/leaders to view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
 bucket_id = 'documents' AND
 (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leader'))
);

-- Add approval-related columns to profiles table (Lệnh ALTER đã có)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approval_rejected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create leave_types table (Lệnh CREATE IF NOT EXISTS đã có)
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, created_by)
);

-- Enable RLS on leave_types (Lệnh ALTER đã có)
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for leave_types (Đã có)
DROP POLICY IF EXISTS "Everyone can view leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can manage leave types" ON public.leave_types;
CREATE POLICY "Everyone can view leave types" ON public.leave_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage leave types" ON public.leave_types FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create index for leave_types (Đã có)
CREATE INDEX IF NOT EXISTS idx_leave_types_created_by ON public.leave_types(created_by);

-- Create trigger for leave_types updated_at (Đã có)
DROP TRIGGER IF EXISTS update_leave_types_updated_at ON public.leave_types;
CREATE TRIGGER update_leave_types_updated_at BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add support for custom leave types in leave_requests table (Lệnh ALTER đã có)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS custom_type_id UUID REFERENCES public.leave_types(id) ON DELETE SET NULL;

-- ========================================================
-- 10) USEFUL SQL QUERIES FOR ADMINISTRATION
-- ========================================================

-- (Giữ nguyên phần hướng dẫn Admin Queries)

-- ========================================================
-- 11) SEED DATA & DEFAULT VALUES
-- ========================================================

-- Initialize default shifts (AM/PM)
INSERT INTO public.shifts (name, start_time, end_time)
VALUES
  ('AM', '08:00:00'::TIME, '12:00:00'::TIME),
  ('PM', '13:00:00'::TIME, '17:00:00'::TIME)
ON CONFLICT DO NOTHING;

-- ========================================================
-- 12) SETUP COMPLETE & FINAL CONFIGURATION
-- ========================================================

-- BỔ SUNG: Cấu hình bảo mật cho hàm has_role để hỗ trợ Edge Function
-- (Ngăn chặn việc tìm kiếm đường dẫn nếu không phải là Admin/Service Role)
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path TO public, auth, pg_temp;

-- ========================================================
-- USEFUL SQL QUERIES FOR ADMINISTRATION & DEBUGGING
-- ========================================================

-- Get all tables with row counts
-- SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Verify RLS is enabled on critical tables
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
--   'profiles', 'tasks', 'room_bookings', 'leave_requests', 'attendance'
-- );

-- Check default shifts exist
-- SELECT id, name, start_time, end_time FROM public.shifts ORDER BY start_time;

-- Get admin users
-- SELECT p.id, p.email, p.first_name, p.last_name, ur.role
-- FROM profiles p
-- LEFT JOIN user_roles ur ON p.id = ur.user_id
-- WHERE ur.role = 'admin';

-- Database is now fully configured with:
-- ✓ All tables created with proper relationships
-- ✓ RLS policies finalized and deployed
-- ✓ Tasks table updated to preserve history (ON DELETE SET NULL)
-- ✓ Default shifts (AM/PM) initialized
-- ✓ Storage policies for file uploads
--
-- Next steps:
-- 1. Create storage buckets: "avatars" and "documents"
-- 2. CREATE AND DEPLOY THE EDGE FUNCTION for secure user deletion.
-- 3. Set up storage policies for avatars and documents
-- 4. Test all RLS policies thoroughly
-- 5. Monitor database activity for any suspicious patterns
-- 6. Verify default shifts were created with: SELECT * FROM public.shifts;
