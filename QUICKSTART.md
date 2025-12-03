# Vine HRM - Quick Start Setup 🚀

## 5-Minute Setup (No Experience Needed)

### Step 1: Copy Database Setup (2 minutes)
```
1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Create new query
3. Copy ALL content from: supabase.setup.md
4. Click "Run" to execute
5. Wait for completion (should see ✓ success messages)
```

### Step 2: Create Storage Buckets (2 minutes)
```
1. Go to Supabase Dashboard → Storage
2. Click "New Bucket"
   - Name: avatars
   - Make Public: YES
   - Size limit: 5 MB
   - Create Bucket
3. Click "New Bucket" again
   - Name: documents  
   - Make Public: NO
   - Size limit: 20 MB
   - Create Bucket
```

### Step 3: Setup First Admin User (1 minute)
```
1. Go to app and click "Sign Up"
2. Fill in email, password, first name, last name
3. Go back to Supabase → SQL Editor
4. Paste and run these two commands (replace USER_ID):
   UPDATE user_roles SET role = 'admin' WHERE user_id = 'USER_ID';
   UPDATE profiles SET is_approved = true WHERE id = 'USER_ID';
5. Logout and login
```

## Common Setup Issues

### Q: How do I find the USER_ID?
**A**: Go to Supabase → SQL Editor → Run this:
```sql
SELECT id, email FROM profiles ORDER BY created_at DESC LIMIT 1;
```

### Q: Storage buckets not working?
**A**: Check they exist in Supabase → Storage and match the names exactly:
- `avatars` (Public)
- `documents` (Private)

### Q: Users stuck on /pending page?
**A**: They need approval. Run in SQL Editor:
```sql
SELECT id, email, is_approved FROM profiles WHERE is_approved = false;
UPDATE profiles SET is_approved = true WHERE id = 'THEIR_ID';
```

### Q: Error: "Missing Supabase environment variables"?
**A**: Check that environment variables are set:
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_PROJECT_ID

### Q: Database tables not appearing?
**A**: In SQL Editor, run:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```
Should show 14+ tables

## After Setup: What Works

| Feature | Admin | Leader | Staff |
|---------|-------|--------|-------|
| Dashboard Access | ✅ | ✅ | ✅ |
| Check In/Out | ✅ | ✅ | ✅ |
| View Attendance | All | Team | Own |
| Create Tasks | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ❌ | ❌ |
| Book Rooms | ✅ | ✅ | ✅ |
| Approve Bookings | ✅ | ✅ | ❌ |
| Request Leave | ✅ | ✅ | ✅ |
| Approve Leave | ✅ | ✅ | ❌ |

## Test the Setup (2 minutes)

```
1. Sign up new user (email, password, first/last name)
2. You should see /pending page
3. Login as admin
4. Go to Organization → Users & Approval → Pending
5. Click Approve
6. Logout and login with new user
7. Should see Dashboard
```

## Documentation

Need more details?
- **Full Setup**: See `supabase.setup.md`
- **Database Reference**: See `DATABASE_INTEGRATION_GUIDE.md`
- **Feature Documentation**: See `IMPLEMENTATION_GUIDE.md`
- **Complete Checklist**: See `SETUP_VERIFICATION.md`

## Still Stuck?

The database setup is automated SQL - it either works or there's an error message. Common solutions:

1. **SQL errors** → Check that all environment variables are correct
2. **Table not found** → Re-run the full SQL script from supabase.setup.md
3. **Storage issues** → Verify bucket names are lowercase and exactly match
4. **User approval issues** → Check profiles table for is_approved column

## What's Included

### Fully Implemented (Ready to Use)
✅ User authentication  
✅ User approval workflow  
✅ Attendance tracking  
✅ Task management  
✅ Leave management  
✅ Meeting rooms  
✅ Team management  
✅ Role management  
✅ Shift management  

### Table Created (Features Not Yet Used)
⏳ Notifications (can use notifications table)  
⏳ Audit logs (can query audit_logs table)  

## Next Steps After Setup

1. Create teams (Organization → Teams)
2. Create shifts (Organization → Shifts)
3. Add users and assign to teams
4. Test each feature
5. Deploy to production

---

**That's it!** Your Vine HRM is ready to go.

For advanced setup, see the detailed guides in the documentation folder.
