# Database Integration Quick Reference

## Quick Links

| Document | Purpose |
|----------|---------|
| `supabase.setup.md` | Complete SQL setup, storage instructions, verification queries |
| `IMPLEMENTATION_GUIDE.md` | Feature documentation, deployment steps, test checklist |
| `SETUP_VERIFICATION.md` | Verification checklist, component mapping, feature status |

## Database Tables by Feature

### Authentication & User Management
- `auth.users` - Supabase built-in auth
- `profiles` - User profile information + approval fields
- `user_roles` - User role assignments (admin, leader, staff)

### Attendance
- `attendance` - Check-in/check-out records
- Related: `profiles` (user info)

### Organization
- `teams` - Organization teams
- `shifts` - Work shift definitions
- Related: `profiles` (team and shift assignment)

### Leave Management
- `leave_requests` - Leave requests with approval workflow
- `leave_types` - Custom leave type definitions
- Related: `profiles` (user information)

### Tasks
- `tasks` - Task management with status and priority
- `task_columns` - Custom kanban columns
- `task_comments` - Comments on tasks
- Related: `teams` (team assignment)

### Meeting Rooms
- `meeting_rooms` - Room inventory
- `room_bookings` - Room reservations with approval
- Related: `profiles` (booking user)

### Admin Features
- `notifications` - User notifications (table created, no UI yet)
- `audit_logs` - System audit trail (table created, no UI yet)

## API Functions

### Authentication (`src/lib/auth.ts`)
```typescript
getCurrentUser() - Get current logged-in user
getCurrentSession() - Get current session
getUserRole(userId) - Get user's role
getUserProfile(userId) - Get user's profile
signIn(email, password) - Sign in user
signUp(email, password, metadata) - Register new user
signOut() - Sign out user
checkUserApprovalStatus(userId) - Check if user approved
approveUser(userId) - Approve user registration
rejectUser(userId, reason) - Reject user registration
updateUserRole(userId, newRole) - Update user role
```

## RLS (Row Level Security) Overview

### User Access Levels
1. **Unauthenticated**: Can view landing page only
2. **New User (not approved)**: Redirected to pending page
3. **Approved Staff**: Personal data and team (if assigned) data
4. **Leader**: Staff role + team member data access
5. **Admin**: Full system access

### Data Visibility
- Users can see their own data
- Leaders can see their team's data
- Admins can see all data
- Public tables have public select access

## Key Database Features

### Automatic Timestamp Updates
All tables have `updated_at` that auto-updates via trigger.

### Default Values
- `user_roles` role defaults to 'staff'
- `profiles` is_approved defaults to false
- `tasks` status defaults to 'todo'
- `tasks` priority defaults to 'medium'

### Cascading Actions
- Profile deleted → user data cleaned up
- Task creator deleted → task creator_id set to NULL (preserves task history)
- Custom types deleted → related requests/columns deleted

## Storage Setup

### Buckets to Create
```
Dashboard: Supabase → Storage

1. avatars
   - Public
   - 5 MB limit
   - User profile pictures

2. documents
   - Private
   - 20 MB limit
   - User documents, CVs
```

### File Upload Path Format
- Avatars: `avatars/{user_id}-{timestamp}.{ext}`
- Documents: `documents/{user_id}-{timestamp}.{ext}`

### Storage RLS Policies
Already configured for:
- User self-upload/update/delete
- Admin/leader document access
- Public avatar access

## Common Queries

### Check User Approval Status
```sql
SELECT id, email, is_approved, approval_rejected, rejection_reason
FROM profiles
WHERE id = 'USER_ID';
```

### List Pending Users
```sql
SELECT id, first_name, last_name, email, created_at
FROM profiles
WHERE is_approved = false AND approval_rejected = false;
```

### Get User Role
```sql
SELECT role FROM user_roles WHERE user_id = 'USER_ID';
```

### Get Team Members
```sql
SELECT id, first_name, last_name, email
FROM profiles
WHERE team_id = 'TEAM_ID' AND is_approved = true;
```

### Get User Attendance
```sql
SELECT type, timestamp, location
FROM attendance
WHERE user_id = 'USER_ID'
ORDER BY timestamp DESC;
```

### Get Pending Leave Requests
```sql
SELECT id, user_id, type, start_date, end_date, status
FROM leave_requests
WHERE status = 'pending'
ORDER BY created_at DESC;
```

## Environment Variables

The application uses these Supabase environment variables:
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

These are automatically loaded from the configured Supabase project.

## Testing Guide

### Test User Approval Flow
1. Sign up new user
2. Verify redirect to `/pending` page
3. Login as admin
4. Go to Organization → Users & Approval
5. Approve the user
6. Logout and login with new user
7. Should access dashboard

### Test Role Changes
1. Approve user as staff
2. Login as admin
3. Go to Organization → Role Management
4. Change staff to leader
5. Logout and check team visibility
6. Leader should see team data

### Test Attendance
1. Login as staff
2. Check in/out (via AttendanceWidget)
3. Login as admin
4. Go to Attendance page
5. Verify admin can see all attendance records
6. Test CSV export

### Test Leave Requests
1. Approve multiple users
2. One user creates custom leave type
3. Another user requests leave using custom type
4. Admin approves leave
5. Verify history shows correct leave type name

### Test Meeting Rooms
1. Admin creates room with equipment
2. Staff books room
3. Admin approves booking
4. Verify staff can see approved booking in MyBookings

### Test Task Management
1. User creates custom column
2. Create task in that column
3. Assign to another user
4. Verify assigned user can see task
5. Move task between columns

## Common Issues & Solutions

### Issue: User stuck on `/pending` page
**Solution**: Check `is_approved` status in profiles table
```sql
UPDATE profiles SET is_approved = true WHERE id = 'USER_ID';
```

### Issue: User sees empty team data
**Solution**: 
1. Check user has team assigned in profiles.team_id
2. Check other team members are approved (is_approved = true)
3. Verify RLS policies allow leader role access

### Issue: Task not appearing
**Solution**:
1. Check creator_id or assignee_id is correct
2. Verify RLS policies for tasks table
3. Check column_id exists if column is specified

### Issue: Storage upload fails
**Solution**:
1. Verify buckets exist (avatars, documents)
2. Check file size under limits
3. Verify RLS storage policies are created
4. Check bucket names match exactly

## Deployment Checklist

- [ ] Run all SQL from supabase.setup.md
- [ ] Create storage buckets (avatars, documents)
- [ ] Verify with queries from section 17
- [ ] Sign up and approve first admin user
- [ ] Test authentication flow
- [ ] Test user approval workflow
- [ ] Test each feature with appropriate roles
- [ ] Verify RLS policies work correctly
- [ ] (Optional) Deploy delete-user Edge Function
- [ ] Monitor audit logs for setup issues

## Performance Notes

- Database has indexes on commonly queried columns
- RLS policies are optimized for performance
- Attendance can handle high check-in volume
- Task queries are indexed by status and assignee
- No N+1 query issues due to RLS policy structure

## Security Notes

- All user data is protected by RLS
- Passwords stored by Supabase Auth (bcrypt)
- API keys are read-only and rotated
- Admin functions require role verification
- User deletion protected by admin-only Edge Function
- File uploads scoped to user ID paths

---

**Quick Start**: 1) Run SQL setup → 2) Create buckets → 3) Approve first admin → 4) Start using!
