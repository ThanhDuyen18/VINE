import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const MyBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchMyBookings = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    try {
      setCancelling(bookingId);
      const { error } = await supabase
        .from('room_bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) throw error;

      toast.success('Booking cancelled successfully');
      await fetchMyBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel booking');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading your bookings...</div>;
  }

  if (bookings.length === 0) {
    return <div className="text-muted-foreground text-center py-8">No bookings yet</div>;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell className="font-medium">{booking.title}</TableCell>
              <TableCell>Room {booking.room_id?.substring(0, 8)}</TableCell>
              <TableCell>{format(new Date(booking.start_time), 'MMM dd, yyyy HH:mm')}</TableCell>
              <TableCell>{format(new Date(booking.end_time), 'MMM dd, yyyy HH:mm')}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    booking.status === 'approved' ? 'default' :
                    booking.status === 'rejected' ? 'destructive' :
                    booking.status === 'cancelled' ? 'outline' : 'secondary'
                  }
                >
                  {booking.status}
                </Badge>
              </TableCell>
              <TableCell>
                {booking.status !== 'cancelled' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelBooking(booking.id)}
                    disabled={cancelling === booking.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {cancelling === booking.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default MyBookings;
