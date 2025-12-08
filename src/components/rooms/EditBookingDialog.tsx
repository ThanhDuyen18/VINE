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
  const [bookingDate, setBookingDate] = useState(""); // YYYY-MM-DD 
  const [startTime, setStartTime] = useState(""); // HH:mm  
  const [endTime, setEndTime] = useState(""); // HH:mm
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRooms = async () => {
    const { data } = await supabase
        .from('meeting_rooms')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

    if (data) setRooms(data);
    return data || [];
  };

  useEffect(() => {
    if (open && booking) {
      (async () => {
        // 1) ensure rooms are loaded first so SelectItem exists when we set roomId
        const fetched = await fetchRooms();

        // 2) set form fields from booking
        setTitle(booking.title || "");
        setDescription(booking.description || "");

        // parse start_time/end_time to date + time parts
        if (booking.start_time) {
          const parsedStart = parseISO(booking.start_time);
          setBookingDate(format(parsedStart, "yyyy-MM-dd"));
          setStartTime(format(parsedStart, "HH:mm"));
        } else {
          const today = new Date().toISOString().split('T')[0];
          setBookingDate(today); 
          setStartTime("09:00"); 
        }

        if (booking.end_time) {
          const parsedEnd = parseISO(booking.end_time);
          setEndTime(format(parsedEnd, "HH:mm")); 
        } else {
          setEndTime("10:00"); 
        }

        // 3) set roomId AFTER rooms loaded so Select can display selected item
        //    (only set if fetched rooms include the id; fallback to empty)
        const desiredRoomId = booking.room_id || "";
        if (desiredRoomId && fetched.some(r => r.id === desiredRoomId)) {
          setRoomId(desiredRoomId);
        } else {
          setRoomId(desiredRoomId); // still set, Select will show placeholder if not found
        }
      })();
    }
  }, [open, booking]);

  const checkTimeConflict = async (roomId: string, startISO: string, endISO: string, currentBookingId?: string): Promise<boolean> => {
    try {
      const startDate = startISO.split('T')[0];
      const dayStart = new Date(`${startDate}T00:00:00`).toISOString();
      const dayEnd = new Date(`${startDate}T23:59:59.999`).toISOString();

      const { data: bookings, error } = await supabase
          .from('room_bookings')
          .select('id, start_time, end_time, status')
          .eq('room_id', roomId)
          .gte('start_time', dayStart)
          .lte('start_time', dayEnd);

      if (error) {
        console.error('Error fetching existing bookings for conflict check:', error);
        // conservative: assume conflict if we can't fetch
        return true;
      }

      const sMs = new Date(startISO).getTime();
      const eMs = new Date(endISO).getTime();

      for (const b of bookings || []) {
        if (currentBookingId && b.id === currentBookingId) continue; // exclude self
        if (b.status === 'cancelled' || b.status === 'rejected') continue;

        const bStart = new Date(b.start_time).getTime();
        const bEnd = new Date(b.end_time).getTime();

        if (sMs < bEnd && eMs > bStart) {
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error('Error checking time conflict:', err);
      return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!title || !roomId || !bookingDate || !startTime || !endTime) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Build start/end from date + time parts (local)
      const startDateTimeStr = `${bookingDate}T${startTime}`; 
      const endDateTimeStr = `${bookingDate}T${endTime}`;

      const startMs = new Date(startDateTimeStr).getTime();
      const endMs = new Date(endDateTimeStr).getTime();

      if (isNaN(startMs) || isNaN(endMs)) {
        toast({ title: "Invalid Date/Time", description: "Please provide valid date and time", variant: "destructive" });
        setLoading(false);
        return;
      }

      if (startMs >= endMs) {
        toast({
          title: "Invalid Time Range",
          description: "End time must be after start time",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const startISO = new Date(startDateTimeStr).toISOString();
      const endISO = new Date(endDateTimeStr).toISOString(); 

      const hasConflict = await checkTimeConflict(roomId, startISO, endISO, booking.id);
      if (hasConflict) {
        toast({
          title: "Booking Conflict",
          description: "This room is already booked for the selected time. Please choose a different time or room.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
          .from('room_bookings')
          .update({
            title,
            description: description || null,
            room_id: roomId,
            start_time: startISO,
            end_time: endISO
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

  if (!booking || !roomId) return null;

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

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                    id="date"
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                />
              </div>

              <div>
                <Label htmlFor="start">Start Time *</Label>
                <Input
                    id="start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                />
              </div>

              <div>
                <Label htmlFor="end">End Time *</Label>
                <Input
                    id="end"
                    type="time"
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
