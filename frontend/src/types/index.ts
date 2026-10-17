export type Language = "en" | "ru" | "kk";
export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export const statuses: Status[] = ["TODO", "IN_PROGRESS", "DONE"];
export const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export interface User {
  id: number;
  username: string;
  email: string;
  preferred_language: Language;
  created_at: string;
}
export interface Project {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  role: Role;
  task_count: number;
  completed_tasks: number;
  completion_percentage: number;
  member_count: number;
  created_at: string;
  updated_at: string;
}
export interface Task {
  id: number;
  title: string;
  description: string;
  project_id: number;
  project_name: string;
  creator_id: number;
  assigned_to_id: number | null;
  assignee_username: string | null;
  status: Status;
  priority: Priority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}
export interface Member {
  id: number;
  user_id: number;
  username: string;
  email: string;
  role: Role;
  joined_at: string;
}
export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}
export interface Envelope<T> {
  code: string;
  message: string;
  data: T;
}
export interface Summary {
  total_projects: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  pending_tasks: number;
  recent_projects: Project[];
  upcoming_deadlines: Task[];
  recent_tasks: Task[];
}
export type Params = Record<string, string | number | undefined>;
export type TaskInput = Pick<
  Task,
  | "title"
  | "description"
  | "status"
  | "priority"
  | "due_date"
  | "assigned_to_id"
>;
