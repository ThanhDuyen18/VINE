import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

const ShiftsManagement = () => {
  const { toast } = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    start_time: "",
    end_time: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('start_time');

      if (error) throw error;
      
      const existingShifts = data || [];
      setShifts(existingShifts);
      
      // Initialize default shifts if none exist
      if (existingShifts.length === 0 && !initialized) {
        await initializeDefaultShifts();
        setInitialized(true);
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
      toast({
        title: "Error",
        description: "Failed to load shifts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultShifts = async () => {
    try {
      const defaultShifts = [
        { name: "AM", start_time: "08:00", end_time: "12:00" },
        { name: "PM", start_time: "13:00", end_time: "17:00" },
      ];

      const { error } = await supabase
        .from('shifts')
        .insert(defaultShifts);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Default shifts (AM, PM) created"
      });

      await fetchShifts();
    } catch (error) {
      console.error('Error initializing default shifts:', error);
    }
  };

  const handleOpenCreate = () => {
    setFormData({ name: "", start_time: "", end_time: "" });
    setCreateOpen(true);
  };

  const handleOpenEdit = (shift: Shift) => {
    setSelectedShift(shift);
    setFormData({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
    });
    setEditOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.start_time || !formData.end_time) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive"
      });
      return;
    }

    if (formData.start_time >= formData.end_time) {
      toast({
        title: "Error",
        description: "Start time must be before end time",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('shifts').insert([{
        name: formData.name,
        start_time: formData.start_time,
        end_time: formData.end_time,
      }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Shift created successfully"
      });
      
      setCreateOpen(false);
      fetchShifts();
    } catch (error) {
      console.error('Error creating shift:', error);
      toast({
        title: "Error",
        description: "Failed to create shift",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedShift || !formData.name.trim() || !formData.start_time || !formData.end_time) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive"
      });
      return;
    }

    if (formData.start_time >= formData.end_time) {
      toast({
        title: "Error",
        description: "Start time must be before end time",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('shifts')
        .update({
          name: formData.name,
          start_time: formData.start_time,
          end_time: formData.end_time,
        })
        .eq('id', selectedShift.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Shift updated successfully"
      });
      
      setEditOpen(false);
      fetchShifts();
    } catch (error) {
      console.error('Error updating shift:', error);
      toast({
        title: "Error",
        description: "Failed to update shift",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedShift) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', selectedShift.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Shift deleted successfully"
      });
      
      setDeleteConfirmOpen(false);
      setSelectedShift(null);
      fetchShifts();
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast({
        title: "Error",
        description: "Failed to delete shift",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Shift
        </Button>
      </div>

      {shifts.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No shifts created yet</p>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shift Name</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{shift.name}</TableCell>
                  <TableCell>{shift.start_time}</TableCell>
                  <TableCell>{shift.end_time}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(shift)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedShift(shift);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Shift</DialogTitle>
            <DialogDescription>Add a new shift to your organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="shift-name">Shift Name *</Label>
              <Input
                id="shift-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Morning, Afternoon, Night"
              />
            </div>
            <div>
              <Label htmlFor="start-time">Start Time *</Label>
              <Input
                id="start-time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="end-time">End Time *</Label>
              <Input
                id="end-time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
            <DialogDescription>Update shift information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-shift-name">Shift Name *</Label>
              <Input
                id="edit-shift-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Morning, Afternoon, Night"
              />
            </div>
            <div>
              <Label htmlFor="edit-start-time">Start Time *</Label>
              <Input
                id="edit-start-time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-end-time">End Time *</Label>
              <Input
                id="edit-end-time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{selectedShift?.name}" shift? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ShiftsManagement;
