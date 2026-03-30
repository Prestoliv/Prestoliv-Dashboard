import type { MediaType, QueryStatus, UserRole } from "./types";

export type ProjectStatus = "active" | "completed" | "on_hold" | "cancelled";

export type Project = {
  id: string;
  name: string;
  customer_id: string;
  /** Same as customer_id when DB uses a separate FK column (e.g. projects_client_id_fkey). */
  client_id?: string;
  pm_id: string | null;
  status: ProjectStatus;
};

export type Milestone = {
  id: string;
  project_id: string;
  title: string;
  percentage: number; // 0-100
};

export type Update = {
  id: string;
  project_id: string;
  created_by: string;
  text: string;
  created_at: string;
};

export type Media = {
  id: string;
  project_id: string;
  update_id: string | null;
  url: string; // storage object name/path
  type: MediaType;
};

export type Query = {
  id: string;
  project_id: string;
  created_by: string;
  message: string;
  status: QueryStatus;
  created_at: string;
};

export type QueryReply = {
  id: string;
  query_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

export type UserRow = {
  id: string;
  name: string | null;
  role: UserRole;
};

