export type Role           = 'admin' | 'owner' | 'member' | 'client';
export type Priority       = 'urgent' | 'high' | 'medium' | 'low';
export type ApprovalStatus = 'pending' | 'pending_client' | 'approved' | 'rejected' | null;
export type TaskStatus     = 'todo' | 'in_progress' | 'in_review' | 'done' | 'requested';
export type PushMode       = 'always' | 'mine_only' | 'project' | 'off';
export type NotifKind      =
  | 'mention' | 'approval_request' | 'approved' | 'rejected'
  | 'assigned' | 'comment' | 'status_changed' | 'done' | 'created';
export type NotifPrefs     = Partial<Record<NotifKind, PushMode>>;

export interface User {
  user_id:                  string;
  email:                    string;
  name?:                    string;
  full_name?:               string;
  role:                     Role;
  picture?:                 string;
  position?:                string;
  member_role?:             string;
  company_name?:            string;
  receives_approval_emails: boolean;
}

export interface Project {
  team_id:      string;
  name:         string;
  description?: string;
  created_by:   string;
  created_at:   string;
  updated_at:   string;
  task_count:   number;
  done_count:   number;
  color?:       string;
  deleted_at?:  string;
}

export interface ProjectColumn {
  column_id:  string;
  team_id:    string;
  name:       string;
  color:      string;
  sort_order: number;
  is_done:    boolean;
}

export interface Subtask {
  subtask_id:       string;
  title:            string;
  is_done:          boolean;
  order:            number;
  assignee_user_id?: string;
}

export interface Attachment {
  name:  string;
  url:   string;
  key?:  string;
}

export interface Task {
  task_id:              string;
  team_id:              string;
  team_name?:           string;
  column_id:            string;
  created_by_user_id:   string;
  created_by_name?:     string;
  assigned_by_user_id?: string;
  title:                string;
  description?:         string;
  status:               TaskStatus;
  priority:             Priority;
  tags:                 string[];
  assignee_user_ids:    string[];
  due_at?:              string;
  attachments:          Attachment[];
  subtasks:             Subtask[];
  order:                number;
  created_at:           string;
  updated_at:           string;
  completed_at?:        string;
  approval_status:      ApprovalStatus;
  approval_notes?:      string;
  approved_by?:         string;
  category_id?:         string;
}

export interface Comment {
  comment_id: string;
  task_id:    string;
  user_id:    string;
  user_name:  string;
  body:       string;
  created_at: string;
}

export interface TeamMember {
  user_id?:      string;
  member_id?:    string;
  email:         string;
  display_name?: string;
  full_name?:    string;
  name?:         string;
  role:          Role;
  member_role?:  string;
  position?:     string;
  company_name?: string;
  status:        string;
  receives_approval_emails?: boolean;
}

export interface Notification {
  notification_id: string;
  user_id:         string;
  team_id?:        string;
  task_id?:        string;
  type:            NotifKind;
  title:           string;
  message:         string;
  url?:            string;
  created_at:      string;
  read_at?:        string;
}

export interface NotifPrefsResponse {
  prefs:       NotifPrefs;
  quiet_start: string;  // "22:00"
  quiet_end:   string;  // "07:00"
}

export interface Channel {
  channel_id:       string;
  type:             'project' | 'general' | 'dm';
  name?:            string;
  project_id?:      string;
  project_name?:    string;
  unread_count:     number;
  last_message?:    string;
  last_message_at?: string;
}

export interface MessageReaction {
  emoji:     string;
  user_id:   string;
  user_name: string;
}

export interface Message {
  message_id:    string;
  channel_id:    string;
  sender_id:     string;
  sender_name:   string;
  sender_avatar?: string;
  body:          string | null;
  deleted:       boolean;
  parent_id?:    string;
  metadata?:     Record<string, unknown>;
  edited_at?:    string;
  created_at:    string;
  reactions:     MessageReaction[];
  reply_count:   number;
}

export interface TaskTemplate {
  template_id: string;
  name:        string;
  icon?:       string;
  is_default:  boolean;
  team_id?:    string;
  config: {
    title?:       string;
    description?: string;
    priority?:    string;
    subtasks?:    { title: string; is_done: boolean }[];
    attachments?: { name: string; url: string; key?: string }[];
  };
}

export interface WhatsAppSettings {
  opted_in:            boolean;
  verified:            boolean;
  opted_out?:          boolean;
  phone?:              string;
  notify_approvals?:   boolean;
  notify_mentions?:    boolean;
  notify_assignments?: boolean;
  notify_dms?:         boolean;
}

export interface MutationQueueItem {
  id:           string;
  method:       'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url:          string;
  body?:        unknown;
  optimistic_id?: string;
  created_at:   string;
  retries:      number;
}
