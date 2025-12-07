import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import TaskSearchFilter from "./TaskSearchFilter";
import EditTaskDialog from "./EditTaskDialog";

const TaskList = ({ role }: { role: UserRole }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [users, setUsers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .order('first_name');

      if (data) setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        // .or(`assignee_id.eq.${user.id},creator_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setTasks([]);
        return;
      }

      // Fetch creator and assignee info separately
      const userIds = new Set<string>();
      data.forEach(task => {
        if (task.creator_id) userIds.add(task.creator_id);
        if (task.assignee_id) userIds.add(task.assignee_id);
      });

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', Array.from(userIds));

      const profileMap = new Map();
      profileData?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      const tasksWithProfiles = data.map(task => ({
        ...task,
        creator: task.creator_id ? profileMap.get(task.creator_id) : null,
        assignee: task.assignee_id ? profileMap.get(task.assignee_id) : null
      }));

      setTasks(tasksWithProfiles);
    } catch (error: any) {
      const errorMessage = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      console.error('Error fetching tasks:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  if (loading) {
    return <SkeletonTable rows={8} columns={6} />;
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getFilteredTasks = () => {
    return tasks.filter(task => {
      const matchesSearch = !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesAssignee = assigneeFilter === "all" ||
        (assigneeFilter === "unassigned" ? !task.assignee_id : task.assignee_id === assigneeFilter);

      let matchesTaskType = true;
      if (taskTypeFilter === "assigned") {
        matchesTaskType = task.assignee_id === currentUserId;
      } else if (taskTypeFilter === "created") {
        matchesTaskType = task.creator_id === currentUserId;
      }

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesTaskType;
    });
  };

  const filteredTasks = getFilteredTasks();

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex gap-4 flex-wrap items-center">
          <TaskSearchFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            assigneeFilter={assigneeFilter}
            onAssigneeChange={setAssigneeFilter}
            users={users}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setTaskTypeFilter("all")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                taskTypeFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setTaskTypeFilter("assigned")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                taskTypeFilter === "assigned"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Assigned to Me
            </button>
            <button
              onClick={() => setTaskTypeFilter("created")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                taskTypeFilter === "created"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Created by Me
            </button>
          </div>
        </div>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((task) => (
              <TableRow 
                key={task.id} 
                className="cursor-pointer hover:bg-secondary/50"
                onClick={() => {
                  setSelectedTask(task);
                  setEditDialogOpen(true);
                }}
              >
                <TableCell>
                  <div>
                    <p className="font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {task.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{task.status.replace('_', ' ')}</Badge>
                </TableCell>
                <TableCell>
                  <Badge>{task.priority}</Badge>
                </TableCell>
                <TableCell>
                  {task.creator_id ? (
                    (() => {
                      const creator = users.find(u => u.id === task.creator_id);
                      return creator ? `${creator.first_name} ${creator.last_name}` : 'Unknown';
                    })()
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {task.assignee_id ? (
                    (() => {
                      const assignee = users.find(u => u.id === task.assignee_id);
                      return assignee ? `${assignee.first_name} ${assignee.last_name}` : 'Assigned';
                    })()
                  ) : 'Unassigned'}
                </TableCell>
                <TableCell>
                  {task.deadline ? format(new Date(task.deadline), 'MMM dd, yyyy') : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(task.created_at), 'MMM dd, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <EditTaskDialog
        task={selectedTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onTaskUpdated={fetchTasks}
      />
    </div>
  );
};

export default TaskList;
