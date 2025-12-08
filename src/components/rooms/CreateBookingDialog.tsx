import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { createNotification } from "@/lib/notifications";

interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingCreated: () => void;
}

const CreateBookingDialog = ({ open, onOpenChange, onBookingCreated }: CreateBookingDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchRooms();
      const today = new Date().toISOString().split('T')[0];
      setStartTime(`${today}T09:00`);
      setEndTime(`${today}T10:00`);
    }
  }, [open]);

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('meeting_rooms')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (data) setRooms(data);
  };

  async function checkTimeConflict(roomId: string, startISO: string, endISO: string) {
    // startISO/endISO are full ISO strings from input (local -> toISOString later)
    const startDate = startISO.split('T')[0]; // yyyy-mm-dd
    const dayStart = new Date(`${startDate}T00:00:00`).toISOString();
    const dayEnd = new Date(`${startDate}T23:59:59.999`).toISOString();

    // Fetch all bookings for that room on that date (excluding cancelled/canceled if you have that status)
    const { data: bookings, error } = await supabase
        .from('room_bookings')
        .select('id, start_time, end_time, status')
        .eq('room_id', roomId)
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd);

    if (error) {
      console.error('Error fetching existing bookings for conflict check:', error);
      // Be conservative: if we can't fetch, assume conflict to avoid double-booking
      return true;
    }

    const startMs = new Date(startISO).getTime();
    const endMs = new Date(endISO).getTime();

    // Overlap condition: start < existing.end && end > existing.start
    for (const b of bookings || []) {
      // Optional: ignore cancelled/rejected bookings if you treat them as non-conflicting
      if (b.status === 'cancelled' || b.status === 'rejected') continue;

      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();

      if (startMs < bEnd && endMs > bStart) {
        // overlapping time range in same room -> conflict
        return true;
      }
    }

    return false;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      if (!title || !roomId || !startTime || !endTime) {
        toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
        setLoading(false);
        return;
      }

      const startDate = startTime.split('T')[0];
      const endDate = endTime.split('T')[0];

      if (startDate !== endDate) {
        toast({ title: "Invalid Date Range", description: "Booking must be on the same day.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const startDateTime = new Date(startTime).getTime();
      const endDateTime = new Date(endTime).getTime();

      if (startDateTime >= endDateTime) {
        toast({ title: "Invalid Time Range", description: "End time must be after start time", variant: "destructive" });
        setLoading(false);
        return;
      }

      // convert to ISO for storage & checking (consistent tz)
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(endTime).toISOString();

      // Check conflict for the same room & same date
      const hasConflict = await checkTimeConflict(roomId, startISO, endISO);
      if (hasConflict) {
        toast({ title: "Booking Conflict", description: "This room is already booked for the selected time.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Insert booking
      const { data: bookingData, error } = await supabase
          .from('room_bookings')
          .insert([{
            title,
            description: description || null,
            room_id: roomId,
            user_id: user.id,
            start_time: startISO,
            end_time: endISO,
            status: 'pending'
          }])
          .select();

      if (error) throw error;

      // notify admins/leaders (unchanged)
      const { data: adminUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'leader'])
          .neq('user_id', user.id);

      if (adminUsers && adminUsers.length > 0) {
        const roomData = rooms.find(r => r.id === roomId);
        const roomName = roomData?.name || 'Unknown Room';
        for (const admin of adminUsers) {
          await createNotification({
            userId: admin.user_id,
            type: 'booking',
            title: 'New Room Booking',
            message: `New booking created: "${title}" in ${roomName}`,
            link: '/meeting-rooms'
          });
        }
      }

      toast({ title: "Success", description: "Booking created successfully" });
      onBookingCreated();
      onOpenChange(false);
      resetForm();

    } catch (error) {
      console.error('Error creating booking:', error);
      toast({ title: "Error", description: "Failed to create booking", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRoomId("");
    setStartTime("");
    setEndTime("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Booking</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Meeting Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="room">Room *</Label>
            <Select value={roomId} onValueChange={setRoomId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Start Time *</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="end">End Time *</Label>
              <Input
                id="end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Booking"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBookingDialog;
