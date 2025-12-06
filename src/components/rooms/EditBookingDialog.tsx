import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface EditBookingDialogProps {
  booking: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingUpdated: () => void;
}

const EditBookingDialog = ({ booking, open, onOpenChange, onBookingUpdated }: EditBookingDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && booking) {
      fetchRooms();
      setTitle(booking.title || "");
      setDescription(booking.description || "");
      setRoomId(booking.room_id || "");
      
      if (booking.start_time) {
        setStartTime(format(parseISO(booking.start_time), "yyyy-MM-dd'T'HH:mm"));
      }
      
      if (booking.end_time) {
        setEndTime(format(parseISO(booking.end_time), "yyyy-MM-dd'T'HH:mm"));
      }
    }
  }, [open, booking]);

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('meeting_rooms')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (data) setRooms(data);
  };

  const checkTimeConflict = async (roomId: string, startTime: string, endTime: string, currentBookingId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'approved')
        .neq('id', currentBookingId);

      if (error) throw error;

      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();

      const hasConflict = data?.some(existingBooking => {
        const existingStart = new Date(existingBooking.start_time).getTime();
        const existingEnd = new Date(existingBooking.end_time).getTime();

        return !(end <= existingStart || start >= existingEnd);
      });

      return hasConflict || false;
    } catch (error) {
      console.error('Error checking time conflict:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!title || !roomId || !startTime || !endTime) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const startDate = startTime.split('T')[0];
      const endDate = endTime.split('T')[0];

      if (startDate !== endDate) {
        toast({
          title: "Invalid Date Range",
          description: "Booking must be on the same day. Please select start and end times on the same date.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const startDateTime = new Date(startTime).getTime();
      const endDateTime = new Date(endTime).getTime();

      if (startDateTime >= endDateTime) {
        toast({
          title: "Invalid Time Range",
          description: "End time must be after start time",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const hasConflict = await checkTimeConflict(roomId, startTime, endTime, booking.id);
      if (hasConflict) {
        toast({
          title: "Booking Conflict",
          description: "This room is already booked for the selected time. Please choose a different time or room.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const startTimeUTC = new Date(startTime).toISOString();
      const endTimeUTC = new Date(endTime).toISOString();

      const { error } = await supabase
        .from('room_bookings')
        .update({
          title,
          description: description || null,
          room_id: roomId,
          start_time: startTimeUTC,
          end_time: endTimeUTC
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Booking updated successfully"
      });

      onBookingUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating booking:', error);
      toast({
        title: "Error",
        description: "Failed to update booking",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
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
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditBookingDialog;
