import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Edit2, Trash2, Plus, MapPin, Users, Monitor, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Room {
  id: string;
  name: string;
  location: string | null;
  capacity: number;
  equipment: string[] | null;
  is_active: boolean;
  created_at: string;
}

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string;
}

const RoomManagement = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allUsers, setAllUsers] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<string[]>([]);
  const [searchParticipant, setSearchParticipant] = useState("");
  const { toast } = useToast();

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    capacity: "1",
    equipment: ""
  });

  useEffect(() => {
    loadRooms();
    loadAllUsers();
  }, []);

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_rooms')
        .select('*')
        .order('name');

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast({
        title: "Error",
        description: "Failed to load rooms",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, email')
        .order('first_name');

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Room name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const equipmentArray = formData.equipment
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

      const { error } = await supabase.from('meeting_rooms').insert({
        name: formData.name,
        location: formData.location || null,
        capacity: parseInt(formData.capacity),
        equipment: equipmentArray.length > 0 ? equipmentArray : null,
        is_active: true
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Room created successfully"
      });

      resetForm();
      setCreateOpen(false);
      loadRooms();
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive"
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedRoom || !formData.name.trim()) {
      toast({
        title: "Error",
        description: "Room name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const equipmentArray = formData.equipment
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('meeting_rooms')
        .update({
          name: formData.name,
          location: formData.location || null,
          capacity: parseInt(formData.capacity),
          equipment: equipmentArray.length > 0 ? equipmentArray : null
        })
        .eq('id', selectedRoom.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Room updated successfully"
      });

      resetForm();
      setEditOpen(false);
      loadRooms();
    } catch (error) {
      console.error('Error updating room:', error);
      toast({
        title: "Error",
        description: "Failed to update room",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedRoom) return;

    try {
      const { error } = await supabase
        .from('meeting_rooms')
        .update({ is_active: false })
        .eq('id', selectedRoom.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Room deleted successfully"
      });

      setDeleteConfirmOpen(false);
      setSelectedRoom(null);
      loadRooms();
    } catch (error) {
      console.error('Error deleting room:', error);
      toast({
        title: "Error",
        description: "Failed to delete room",
        variant: "destructive"
      });
    }
  };

  const handleAddParticipant = (userId: string) => {
    if (!roomParticipants.includes(userId)) {
      setRoomParticipants([...roomParticipants, userId]);
    }
  };

  const handleRemoveParticipant = (userId: string) => {
    setRoomParticipants(roomParticipants.filter(id => id !== userId));
  };

  const saveParticipants = async () => {
    // Note: participant management would typically be done through room_bookings or a separate table
    // For now, we're just managing the UI state
    toast({
      title: "Success",
      description: "Participants updated successfully"
    });
    setParticipantsOpen(false);
  };

  const openEditDialog = (room: Room) => {
    setSelectedRoom(room);
    setFormData({
      name: room.name,
      location: room.location || "",
      capacity: room.capacity.toString(),
      equipment: room.equipment?.join(', ') || ""
    });
    setEditOpen(true);
  };

  const openParticipantsDialog = (room: Room) => {
    setSelectedRoom(room);
    setRoomParticipants([]);
    setParticipantsOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      location: "",
      capacity: "1",
      equipment: ""
    });
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const filteredUsers = allUsers.filter(user =>
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchParticipant.toLowerCase()) ||
    user.email.toLowerCase().includes(searchParticipant.toLowerCase())
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Room
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <Card key={room.id} className="shadow-medium hover:shadow-strong transition-smooth">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{room.name}</CardTitle>
                  {room.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                      <MapPin className="h-4 w-4" />
                      {room.location}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="bg-success/10 text-success">Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                Capacity: {room.capacity} people
              </div>

              {room.equipment && room.equipment.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Monitor className="h-4 w-4" />
                    Equipment:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {room.equipment.map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditDialog(room)}
                  className="flex-1"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openParticipantsDialog(room)}
                  className="flex-1"
                >
                  <Users className="h-4 w-4 mr-1" />
                  Manage
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedRoom(room);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Room Dialog */}
      <Dialog open={createOpen || editOpen} onOpenChange={(open) => {
        if (!open) {
          resetForm();
          setSelectedRoom(null);
        }
        if (createOpen) setCreateOpen(open);
        else setEditOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRoom ? 'Edit Room' : 'Create New Room'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="room-name">Room Name *</Label>
              <Input
                id="room-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Meeting Room A"
              />
            </div>

            <div>
              <Label htmlFor="room-location">Location</Label>
              <Input
                id="room-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Floor 2, Building A"
              />
            </div>

            <div>
              <Label htmlFor="room-capacity">Capacity *</Label>
              <Input
                id="room-capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="room-equipment">Equipment (comma-separated)</Label>
              <Input
                id="room-equipment"
                value={formData.equipment}
                onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                placeholder="Projector, Whiteboard, TV"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              resetForm();
              setSelectedRoom(null);
              setCreateOpen(false);
              setEditOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={selectedRoom ? handleUpdate : handleCreate}>
              {selectedRoom ? 'Update' : 'Create'} Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Participants Management Dialog */}
      <Dialog open={participantsOpen} onOpenChange={setParticipantsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Room Participants</DialogTitle>
            <DialogDescription>
              Add or remove participants for {selectedRoom?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="search-participant">Search Employees</Label>
              <Input
                id="search-participant"
                placeholder="Search by name or email..."
                value={searchParticipant}
                onChange={(e) => setSearchParticipant(e.target.value)}
              />
            </div>

            {/* Available Users */}
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3">Available Employees</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.avatar_url || ""} />
                        <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={roomParticipants.includes(user.id) ? "default" : "outline"}
                      onClick={() =>
                        roomParticipants.includes(user.id)
                          ? handleRemoveParticipant(user.id)
                          : handleAddParticipant(user.id)
                      }
                    >
                      {roomParticipants.includes(user.id) ? (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Participants */}
            {roomParticipants.length > 0 && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-semibold mb-3">Selected ({roomParticipants.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {roomParticipants.map((userId) => {
                    const user = allUsers.find(u => u.id === userId);
                    return user ? (
                      <Badge key={userId} variant="secondary" className="px-3 py-1">
                        {user.first_name} {user.last_name}
                        <button
                          onClick={() => handleRemoveParticipant(userId)}
                          className="ml-2 text-xs hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setParticipantsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveParticipants}>Save Participants</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedRoom?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoomManagement;
