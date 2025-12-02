# Vine HRM - Implementation Guide

## Overview
This document provides a complete implementation guide for all features and setup instructions for the Vine HRM system.

## ✅ Completed Features (4 Major Issues)

### 1. **Admin Attendance Management**
- **Component**: `src/components/attendance/AdminAttendanceManager.tsx`
- **Features**:
  - Filter attendance by Day/Month/Year
  - Search employees by name or email
  - CSV export for attendance records
  - Display: Employee name, check-in/out time, location
  - Admin view automatically shows on `/attendance` page
- **Usage**: Admins access via Dashboard → Attendance page

### 2. **Meeting Rooms CRUD & Participant Management**
- **Component**: `src/components/rooms/RoomManagement.tsx`
- **Features**:
  - Create new meeting rooms
  - Edit room details (name, location, capacity, equipment)
  - Delete/deactivate rooms
  - Manage room participants with search functionality
  - Remove status badges from room displays
- **Pages**: `/meeting-rooms` → "Manage Rooms" tab (admin only)
- **Usage**: 
  - Admins create and manage meeting room inventory
  - View and update room capacity and equipment
  - Manage participants per room

### 3. **Leave Management with Custom Types**
- **Components**:
  - `src/components/leave/LeaveTypeManagement.tsx` - Manage custom leave types
  - `src/components/leave/LeaveRequestForm.tsx` - Updated form with custom types
  - `src/components/leave/LeaveHistory.tsx` - Fixed to show proper names
- **Features**:
  - Admins create custom leave types (e.g., Maternity, Bereavement)
  - Standard types: Annual, Sick, Personal, Unpaid
  - Staff request leave using custom or standard types
  - History shows proper first/last names via JOIN
- **Pages**: `/leave` page with admin "Leave Types" tab
- **Usage**: 
  - Admin: Leave → Leave Types tab
  - Staff: Leave → New Request tab

### 4. **User Approval Workflow**
- **Components**:
  - `src/pages/Pending.tsx` - Pending user approval page
  - `src/components/organization/UsersManagement.tsx` - Admin approval panel
- **Features**:
  - New users redirect to `/pending` page
  - Auto-refresh every 5 seconds checking approval status
  - Admin can approve or reject registrations
  - Rejection with custom reason
  - Approved users access dashboard
- **Database**:
  - `is_approved`: Boolean (user approved by admin)
  - `approval_date`: Timestamp of approval/rejection
  - `approval_rejected`: Boolean (registration rejected)
  - `rejection_reason`: Text reason for rejection
- **Usage**:
  - New user signs up → redirected to `/pending`
  - Admin: Organization → Users & Approval → Pending tab
  - Admin click Approve or Reject with reason

---

## 🔐 Role Management (NEW)

### Component: `src/components/organization/RoleManagement.tsx`
- **Purpose**: Allow admins to update user roles (staff ↔ leader)
- **Restrictions**: 
  - Cannot change admin roles (for security)
  - Only staff ↔ leader role changes
  - Changes saved to database
- **Usage**:
  - Admin: Organization → Role Management tab
  - Select new role from dropdown
  - Click "Save Changes" button
- **Roles**:
  - **Staff**: Regular employees, personal access only
  - **Leader**: Team lead, can view team data
  - **Admin**: System administrator, full access

---

## 📊 Database Setup

### Complete SQL Setup
All SQL commands are in `supabase.setup.md` including:

1. **Extensions**
   - UUID generation for primary keys

2. **Enum Types**
   - `app_role`: admin, leader, staff
   - `leave_type`: annual, sick, personal, unpaid, custom
   - `leave_status`: pending, approved, rejected
   - `task_status`: todo, in_progress, review, done
   - `task_priority`: low, medium, high, urgent
   - `booking_status`: pending, approved, rejected, cancelled
   - `attendance_type`: check_in, check_out

3. **Tables Created**
   - `teams` - Team organization
   - `shifts` - Work shift definitions
   - `user_roles` - User role assignments
   - `profiles` - User profile with approval fields
   - `attendance` - Check-in/out records
   - `task_columns` - Custom kanban columns
   - `tasks` - Task management
   - `task_comments` - Task comments
   - `meeting_rooms` - Room inventory
   - `room_bookings` - Room reservations
   - `leave_types` - Custom leave types (NEW)
   - `leave_requests` - Leave requests with custom type support
   - `audit_logs` - System audit trail

4. **Key Functions**
   - `has_role()` - Check user role
   - `get_user_team()` - Get user's team
   - `update_updated_at_column()` - Auto-update timestamps
   - `handle_new_user()` - Initialize new user profiles

5. **Triggers**
   - Auto-create profile and role on user signup
   - Auto-update `updated_at` on all tables

6. **Row Level Security (RLS)**
   - Comprehensive policies for all tables
   - Role-based data access control
   - Team-based visibility for leaders
   - Admin unrestricted access

7. **Storage Policies**
   - Avatar uploads (user profile pictures)
   - Document uploads (CVs, files)

8. **Performance Indexes**
   - Key columns indexed for query optimization

---

## 🚀 Deployment Steps

### 1. **Execute SQL Setup**
```
1. Open Supabase SQL Editor
2. Copy ALL content from supabase.setup.md
3. Run entire script (execute all at once)
4. Verify all tables, functions, and policies created
```

### 2. **Create Storage Buckets**
```
In Supabase dashboard → Storage:
1. Create bucket: "avatars" (public)
2. Create bucket: "documents" (private)
```

### 3. **Create Admin User**
```sql
-- After first user is created via signup, make them admin:
UPDATE user_roles SET role = 'admin' WHERE user_id = 'ADMIN_USER_ID';
UPDATE profiles SET is_approved = true WHERE id = 'ADMIN_USER_ID';
```

### 4. **Verify Functionality**
- [ ] New user can signup
- [ ] New user redirected to `/pending`
- [ ] Admin can approve/reject users
- [ ] Approved user can login and access dashboard
- [ ] Admin can view attendance management
- [ ] Admin can manage meeting rooms
- [ ] Admin can create leave types
- [ ] Admin can update user roles
- [ ] Staff can request leave with custom types
- [ ] History shows proper employee names

---

## 📁 Modified/Created Files

### New Pages
- `src/pages/Pending.tsx` - User approval waiting page

### New Components
- `src/components/attendance/AdminAttendanceManager.tsx`
- `src/components/rooms/RoomManagement.tsx`
- `src/components/leave/LeaveTypeManagement.tsx`
- `src/components/organization/RoleManagement.tsx`

### Updated Pages
- `src/pages/Attendance.tsx` - Added admin view
- `src/pages/Leave.tsx` - Added leave types management
- `src/pages/MeetingRooms.tsx` - Added room management
- `src/pages/Organization.tsx` - Added role management tab
- `src/pages/Dashboard.tsx` - Updated admin stats
- `src/pages/auth/Login.tsx` - Check approval status on login
- `src/App.tsx` - Added `/pending` route

### Updated Components
- `src/components/leave/LeaveRequestForm.tsx` - Custom types support
- `src/components/leave/LeaveHistory.tsx` - Fixed name display
- `src/components/organization/UsersManagement.tsx` - Approval workflow
- `src/components/rooms/RoomList.tsx` - Removed status badges
- `src/components/rooms/BookingDetailsDialog.tsx` - Removed status field

### Configuration
- `supabase.setup.md` - Complete database setup (733 lines)
- `supabase/migrations/add_user_approval_fields.sql` - Migration file

---

## 🔑 Key SQL Commands (for quick admin tasks)

### Approve User
```sql
UPDATE profiles 
SET is_approved = true, approval_date = NOW() 
WHERE id = 'USER_ID';
```

### Reject User
```sql
UPDATE profiles 
SET approval_rejected = true, rejection_reason = 'Reason here', approval_date = NOW() 
WHERE id = 'USER_ID';
```

### Change User Role (staff to leader)
```sql
UPDATE user_roles 
SET role = 'leader' 
WHERE user_id = 'USER_ID';
```

### Get Pending Users
```sql
SELECT id, first_name, last_name, email, created_at
FROM profiles
WHERE is_approved = false AND approval_rejected = false
ORDER BY created_at ASC;
```

### Get All Users with Roles
```sql
SELECT 
  p.id, 
  p.first_name, 
  p.last_name, 
  p.email, 
  ur.role, 
  p.is_approved,
  p.approval_rejected
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
ORDER BY p.created_at DESC;
```

### Get Attendance Report
```sql
SELECT 
  p.first_name, 
  p.last_name, 
  a.type, 
  a.timestamp, 
  a.location
FROM attendance a
JOIN profiles p ON a.user_id = p.id
WHERE DATE(a.timestamp) = '2024-01-15'
ORDER BY a.timestamp DESC;
```

---

## 📋 Test Checklist

- [ ] **User Registration & Approval**
  - [ ] New user can sign up with first/last name
  - [ ] New user redirected to `/pending` page
  - [ ] Pending page shows user details
  - [ ] Auto-refresh checking approval status
  - [ ] Admin can view pending users
  - [ ] Admin can approve pending user
  - [ ] Admin can reject with reason
  - [ ] Approved user can login
  - [ ] Rejected user sees rejection reason

- [ ] **Role Management**
  - [ ] Admin can view all staff/leader users
  - [ ] Admin can change staff → leader
  - [ ] Admin can change leader → staff
  - [ ] Cannot edit admin users
  - [ ] Role changes take effect immediately
  - [ ] Search functionality works

- [ ] **Attendance Management**
  - [ ] Admin can view all attendance records
  - [ ] Can filter by day/month/year
  - [ ] Can search employees
  - [ ] CSV export downloads correctly
  - [ ] Staff can check in/out normally

- [ ] **Meeting Rooms**
  - [ ] Admin can create new room
  - [ ] Admin can edit room details
  - [ ] Admin can manage participants
  - [ ] Staff can view available rooms
  - [ ] Status badges removed from display

- [ ] **Leave Types & Requests**
  - [ ] Admin can create custom leave type
  - [ ] Admin can delete leave type
  - [ ] Staff can request leave with custom type
  - [ ] Leave history shows proper names
  - [ ] Admin can approve/reject leave

---

## 🔒 Security Notes

1. **RLS Policies**: All tables have row-level security enabled
2. **Role-based Access**: Data filtered by user role at database level
3. **Approval Workflow**: New users cannot access dashboard until approved
4. **Admin Protection**: Admin role changes cannot be made via UI
5. **Audit Logging**: All admin actions can be logged via audit_logs table

---

## 📞 Support

For issues with:
- **Database setup**: Check Supabase SQL Editor for errors
- **RLS policies**: Verify role functions exist and policies are created
- **User approval**: Check profiles table for is_approved column
- **Storage**: Ensure avatars and documents buckets exist

---

**Version**: 2.0  
**Last Updated**: 2024  
**Status**: ✅ Complete Implementation
