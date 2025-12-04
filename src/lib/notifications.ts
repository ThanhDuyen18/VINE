import { supabase } from "@/integrations/supabase/client";

export interface NotificationPayload {
  userId: string;
  type: 'task' | 'booking' | 'leave_request' | 'task_assigned' | 'booking_approved' | 'leave_approved';
  title: string;
  message: string;
  link?: string;
}

export const createNotification = async (payload: NotificationPayload) => {
  try {
    const { error } = await supabase.from('notifications').insert([{
      user_id: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link || null
    }]);

    if (error) {
      console.error('Error creating notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
};

export const createTaskNotification = async (
  assigneeId: string,
  taskTitle: string,
  creatorName: string
) => {
  return createNotification({
    userId: assigneeId,
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: `You have been assigned to task: "${taskTitle}" by ${creatorName}`,
    link: '/tasks'
  });
};

export const createBookingNotification = async (
  userId: string,
  bookingTitle: string,
  roomName: string
) => {
  return createNotification({
    userId,
    type: 'booking',
    title: 'New Room Booking',
    message: `New booking created: "${bookingTitle}" in ${roomName}`,
    link: '/meeting-rooms'
  });
};

export const createLeaveRequestNotification = async (
  approverId: string,
  requesterName: string,
  startDate: string,
  endDate: string
) => {
  return createNotification({
    userId: approverId,
    type: 'leave_request',
    title: 'New Leave Request',
    message: `${requesterName} has requested leave from ${startDate} to ${endDate}`,
    link: '/leave'
  });
};
