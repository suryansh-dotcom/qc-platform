export type AppRole = "super_admin" | "admin" | "associate";

export type UserProfile = {
  id: string;
  team_id: string | null;
  full_name: string;
  email: string;
  role: AppRole;
  is_leave_approver: boolean;
  is_backup_leave_approver: boolean;
  has_associate_history: boolean;
  districts_count: number;
  phone: string | null;
  avatar_url: string | null;
  join_date: string;
  leave_balance: number;
  is_active: boolean;
  version: number;
};

export type DailyEntry = {
  id: string;
  user_id: string;
  team_id: string | null;
  entry_date: string;
  unique_reviewed: number;
  rework_reviews: number;
  items_passed: number;
  items_failed: number;
  hours_worked: number;
  defect_category_tags: string[];
  plan_for_today: string | null;
  plan_for_tomorrow: string | null;
  is_locked: boolean;
  verification_status: "unverified" | "verified" | "mismatch" | "admin_override";
  version: number;
};

export type LeaveRequest = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  day_type: "full" | "half_first" | "half_second";
  days_count: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_at: string | null;
  rejection_reason: string | null;
  version: number;
};

export type ProfileUpdateRequest = {
  id: string;
  user_id: string;
  requested_changes: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  version: number;
};
