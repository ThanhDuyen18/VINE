import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const LeaveTypeManagement = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<LeaveType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadLeaveTypes();
  }, []);

  const loadLeaveTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error loading leave types:', error);
      toast({
        title: "Error",
        description: "Failed to load leave types",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Leave type name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('leave_types').insert({
        name: formData.name,
        description: formData.description || null,
        created_by: user.id
      });

      if (error) {
        // Check if it's a duplicate error
        if (error.code === '23505') {
          toast({
            title: "Error",
            description: "This leave type already exists",
            variant: "destructive"
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Leave type created successfully"
      });

      resetForm();
      setCreateOpen(false);
      loadLeaveTypes();
    } catch (error) {
      console.error('Error creating leave type:', error);
      toast({
        title: "Error",
        description: "Failed to create leave type",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;

    try {
      const { error } = await supabase
        .from('leave_types')
        .delete()
        .eq('id', selectedType.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave type deleted successfully"
      });

      setDeleteConfirmOpen(false);
      setSelectedType(null);
      loadLeaveTypes();
    } catch (error) {
      console.error('Error deleting leave type:', error);
      toast({
        title: "Error",
        description: "Failed to delete leave type",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: ""
    });
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading leave types...</div>;
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-medium">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom Leave Types</CardTitle>
              <CardDescription>Create and manage organization-specific leave types</CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Leave Type
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {leaveTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No custom leave types yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaveTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-start justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{type.name}</div>
                    {type.description && (
                      <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Created on {new Date(type.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setSelectedType(type);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Leave Type Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Leave Type</DialogTitle>
            <DialogDescription>
              Add a new leave type to your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="type-name">Leave Type Name *</Label>
              <Input
                id="type-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Maternity Leave, Bereavement Leave"
              />
            </div>

            <div>
              <Label htmlFor="type-description">Description</Label>
              <Textarea
                id="type-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of this leave type..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setCreateOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Leave Type</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedType?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeaveTypeManagement;
