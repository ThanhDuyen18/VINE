import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast"; 
import { Save, RotateCcw, FileText, Loader2, Trash2 } from "lucide-react"; 

// Định nghĩa Interface
interface UserWithRole {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    avatar_url: string | null;
    cv_url: string | null;
    team_id: string | null;
    team_name: string | null;
    current_role: 'admin' | 'leader' | 'staff';
    new_role: 'leader' | 'staff';
    changed: boolean;
}

const RoleManagement = () => {
    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    // Sử dụng destructuring cho useToast (giả định useToast trả về { toast, dismiss })
    const { toast, dismiss } = useToast() as unknown as { 
        toast: ({ ...props }: any) => { id: string; dismiss: () => void; update: (props: any) => void; }; 
        dismiss: (id: string) => void;
    }; 
    

// Edge Function URL chính xác
const EDGE_FUNCTION_URL = 'https://tyverlryifverobjwauo.supabase.co/functions/v1/delete-user-admin';

    // --- HELPER FUNCTION (ĐƯỢC DI CHUYỂN VÀO TRONG COMPONENT) ---
    // Fix lỗi ReferenceError: getInitials is not defined
    const getInitials = (firstName?: string, lastName?: string) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    // --- LOADER ---
    const loadUsersWithRoles = useCallback(async () => {
        try {
            setLoading(true);

            // LƯU Ý: Nếu lỗi schema vẫn xuất hiện, hãy chạy Supabase CLI
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email, avatar_url, cv_url, team_id')
                .order('first_name');

            if (profilesError) throw profilesError;

            const { data: roles, error: rolesError } = await supabase
                .from('user_roles')
                .select('user_id, role');

            if (rolesError) throw rolesError;

            const { data: teams, error: teamsError } = await supabase
                .from('teams')
                .select('id, name, leader_id');

            if (teamsError) console.warn('Error loading teams:', teamsError);

            const teamMap = new Map((teams || []).map(t => [t.id, t.name]));

            const usersWithRoles = (profiles || [])
                .filter(profile => {
                    const role = roles?.find(r => r.user_id === profile.id)?.role || 'staff';
                    return role !== 'admin';
                })
                .map(profile => {
                    const role = (roles?.find(r => r.user_id === profile.id)?.role || 'staff') as 'admin' | 'leader' | 'staff';

                    // Đảm bảo new_role không bao giờ là 'admin'
                    const initialRole = (role === 'admin' ? 'staff' : role) as 'leader' | 'staff';

                    // Check if user is a team member (has team_id) or team leader (leader_id)
                    let teamName: string | null = null;
                    if (profile.team_id) {
                        // User is a team member
                        teamName = teamMap.get(profile.team_id) || null;
                    } else {
                        // Check if user is a team leader
                        const leaderTeam = (teams || []).find(t => t.leader_id === profile.id);
                        if (leaderTeam) {
                            teamName = leaderTeam.name || null;
                        }
                    }

                    return ({
                        id: profile.id,
                        first_name: profile.first_name,
                        last_name: profile.last_name,
                        email: profile.email,
                        avatar_url: profile.avatar_url,
                        cv_url: profile.cv_url,
                        team_id: profile.team_id,
                        team_name: teamName,
                        current_role: role,
                        new_role: initialRole,
                        changed: false
                    });
                }) || [];

            setUsers(usersWithRoles);
        } catch (error) {
            console.error('Error loading users:', error);
            toast({
                title: "Error",
                description: "Failed to load users",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        loadUsersWithRoles();
    }, [loadUsersWithRoles]); 

    // --- CHỨC NĂNG XEM CV (SIGNED URL) ---
    const handleViewCV = async (cv_url: string) => {
        if (!cv_url) return;
        
        const { id: toastId } = toast({
            title: "Generating Link",
            description: "Creating secure URL for CV...",
            duration: 99999, 
        });

        try {
            const { data } = await supabase.storage
                .from('documents') 
                .createSignedUrl(cv_url, 60);

            if (data?.signedUrl) {
                dismiss(toastId); 
                toast({
                    title: "Success",
                    description: "Secure link generated. Opening CV...",
                    duration: 2000,
                    variant: "default", 
                });
                window.open(data.signedUrl, '_blank');
            } else {
                throw new Error("Failed to generate URL");
            }
        } catch (error) {
            console.error("Error generating CV link:", error);
            dismiss(toastId); 
            toast({
                title: "Error",
                description: "Failed to generate secure CV link. Check RLS or file path.",
                variant: "destructive",
                duration: 5000,
            });
        }
    };

    // --- CHỨC NĂNG XÓA NGƯỜI DÙNG (ADMIN API CALL) ---
    const handleDeleteUser = async (userId: string, email: string) => {
        if (!confirm(`Are you sure you want to permanently delete user: ${email}? This action cannot be undone.`)) {
            return;
        }

        setSaving(true);
        const { id: deleteToastId } = toast({
            title: "Deleting User...",
            description: `Attempting to delete user ${email} via secure function.`,
            duration: 99999,
        });

        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            
            if (!token) throw new Error("Admin session not found. Please log in again.");

            // GỌI EDGE FUNCTION để xóa người dùng
            const response = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, 
                },
                body: JSON.stringify({ userId }),
            });
            
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Server responded with status ${response.status}`);
            }

            dismiss(deleteToastId); 
            toast({
                title: "Success",
                description: `User ${email} has been permanently deleted.`,
                variant: "default" 
            });

            await loadUsersWithRoles(); 

        } catch (error) {
            console.error('Error deleting user:', error);
            dismiss(deleteToastId); 
            toast({
                title: "Error",
                description: `Failed to delete user: ${error instanceof Error ? error.message : "API Call failed."}`,
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };
    
    // --- CÁC HÀM QUẢN LÝ VAI TRÒ KHÁC ---
    const handleRoleChange = (userId: string, newRole: 'leader' | 'staff') => {
        setUsers(users.map(user =>
            user.id === userId
                ? { ...user, new_role: newRole, changed: newRole !== user.current_role }
                : user
        ));
    };

    const handleReset = (userId: string) => {
        setUsers(users.map(user => {
            // Ép kiểu new_role an toàn
            const resetRole = (user.current_role === 'admin' ? 'staff' : user.current_role) as 'leader' | 'staff';
            
            return user.id === userId
                ? { ...user, new_role: resetRole, changed: false }
                : user;
        }));
    };

    const handleSaveAll = async () => {
        const changedUsers = users.filter(u => u.changed);

        if (changedUsers.length === 0) {
            toast({
                title: "No Changes",
                description: "No role changes to save",
            });
            return;
        }

        setSaving(true);
        try {
            for (const user of changedUsers) {
                const { error } = await supabase
                    .from('user_roles')
                    .update({ role: user.new_role })
                    .eq('user_id', user.id);

                if (error) throw error;
            }

            toast({
                title: "Success",
                description: `Updated ${changedUsers.length} user role(s) successfully`,
                variant: "default" 
            });

            await loadUsersWithRoles();
        } catch (error) {
            console.error('Error updating roles:', error);
            toast({
                title: "Error",
                description: "Failed to update roles. Check RLS policies or admin privileges.",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    // --- JSX RENDER LOGIC ---
    const filteredUsers = users.filter(user => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const email = user.email.toLowerCase();
        const query = searchQuery.toLowerCase();
        return fullName.includes(query) || email.includes(query);
    });

    const changedCount = users.filter(u => u.changed).length;

    if (loading) {
        return (
            <div className="space-y-4">
                <Card className="shadow-soft">
                    <CardHeader>
                        <CardTitle>Loading Users...</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 bg-gray-100 rounded-md animate-pulse"></div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <Card className="shadow-soft">
                <CardHeader>
                    <CardTitle>Role Management</CardTitle>
                    <CardDescription>
                        Update user roles (staff ↔ leader). Note: Admin accounts cannot be modified here.
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* Filters and Action */}
            <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                    <label className="text-sm font-medium text-muted-foreground block mb-2">
                        Search Users
                    </label>
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                    />
                </div>

                {changedCount > 0 && (
                    <Button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Save {changedCount} Change{changedCount !== 1 ? 's' : ''}
                    </Button>
                )}
            </div>

            {/* Users Table */}
            <Card className="shadow-medium">
                <CardContent className="p-0">
                    {filteredUsers.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No users found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Team</TableHead>
                                        <TableHead>Documents</TableHead>
                                        <TableHead>Current Role</TableHead>
                                        <TableHead>New Role</TableHead>
                                        <TableHead>Management</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => (
                                        <TableRow key={user.id} className={user.changed ? 'bg-warning/5' : ''}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={user.avatar_url || undefined} />
                                                        <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">
                                                        {user.first_name} {user.last_name}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {user.email}
                                            </TableCell>

                                            <TableCell>
                                                {user.team_name ? (
                                                    <Badge variant="secondary">{user.team_name}</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>

                                            {/* CELL XEM CV */}
                                            <TableCell>
                                                {user.cv_url ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs"
                                                        onClick={() => handleViewCV(user.cv_url!)} 
                                                    >
                                                        <FileText className="h-3 w-3 mr-1" />
                                                        View CV
                                                    </Button>
                                                ) : (
                                                    <span className="text-muted-foreground/70 text-xs italic">N/A</span>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {user.current_role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={user.new_role}
                                                    onValueChange={(value: any) => handleRoleChange(user.id, value)}
                                                >
                                                    <SelectTrigger className="w-32">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="staff">Staff</SelectItem>
                                                        <SelectItem value="leader">Leader</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            
                                            {/* CELL QUẢN LÝ (RESET + DELETE) */}
                                            <TableCell>
                                                <div className="flex gap-2 items-center">
                                                    {user.changed && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleReset(user.id)}
                                                            className="text-xs h-7"
                                                        >
                                                            <RotateCcw className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleDeleteUser(user.id, user.email)}
                                                        disabled={saving}
                                                        className="h-7 text-xs"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="shadow-soft bg-blue-50 border-blue-200">
                <CardHeader>
                    <CardTitle className="text-sm">Role Information</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2 text-muted-foreground">
                    <p>
                        <strong className="text-foreground">Staff:</strong> Regular employees who can manage their own tasks, attendance, and leave.
                    </p>
                    <p>
                        <strong className="text-foreground">Leader:</strong> Team leads who can view and manage their team's tasks, attendance, and leave requests.
                    </p>
                    <p>
                        <strong className="text-foreground">Admin:</strong> System administrators who can manage all aspects of the system (not editable here).
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default RoleManagement;
