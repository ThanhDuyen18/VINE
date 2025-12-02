import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Leaf, Clock, AlertCircle, LogOut } from "lucide-react";
import { getCurrentUser, signOut, checkUserApprovalStatus } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const Pending = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [approvalStatus, setApprovalStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkApprovalStatus = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          navigate("/auth/login");
          return;
        }

        setUser(currentUser);

        const status = await checkUserApprovalStatus(currentUser.id);
        setApprovalStatus(status);

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (profile) {
          setUserProfile(profile);

          // If user is approved, redirect to dashboard
          if (profile.is_approved) {
            navigate("/dashboard");
            return;
          }

          // If user registration was rejected, show rejection reason
          if (profile.approval_rejected) {
            setApprovalStatus({
              is_approved: false,
              approval_rejected: true,
              rejection_reason: profile.rejection_reason || "Your account registration was rejected. Please contact the administrator for more information."
            });
          }
        }
      } catch (error) {
        console.error('Error checking approval status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkApprovalStatus();

    // Set up polling to check approval status every 5 seconds
    const interval = setInterval(checkApprovalStatus, 5000);

    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/auth/login");
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-secondary">
        <div className="animate-spin">
          <Leaf className="w-12 h-12 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-medium">
              <Leaf className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-heading font-bold">Vine HRM</h1>
          </div>
          <p className="text-muted-foreground">Account Verification</p>
        </div>

        <Card className="shadow-strong">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Account Pending Approval
            </CardTitle>
            <CardDescription>
              Your registration is under review
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {approvalStatus?.approval_rejected ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="mt-2">
                    <p className="font-semibold mb-2">Registration Rejected</p>
                    <p className="text-sm">{approvalStatus.rejection_reason}</p>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    An administrator is reviewing your account. This usually takes 24-48 hours.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4 bg-muted/50 rounded-lg p-4">
                  {userProfile && (
                    <>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Name</p>
                        <p className="text-lg font-semibold">
                          {userProfile.first_name} {userProfile.last_name}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <Badge variant="secondary" className="mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending Review
                        </Badge>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You will be automatically redirected to the dashboard once your account is approved.
                  </p>

                  <div className="text-xs text-muted-foreground flex items-center gap-2 justify-center">
                    <Clock className="h-3 w-3" />
                    <span>Auto-refreshing every 5 seconds...</span>
                  </div>
                </div>
              </>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Pending;
