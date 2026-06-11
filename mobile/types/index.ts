export type UserType = 'internal' | 'external' | 'demo';
export type CompanyRole = 'super_admin' | 'admin' | 'member';
export type UserRole = 'user' | 'contractor' | 'admin';
export type ProjectPermission = 'write' | 'read_only';

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  organizations: Organization[];
}

export interface Organization {
  org_id: string;
  name: string;
  role: string;
  billing: { stripe_customer_id: string | null; subscription_status: string | null } | null;
  projects: ProjectEntry[];
}

export interface ProjectEntry {
  project_id: string;
  name: string;
  status: string;
  evaluated_permission: ProjectPermission;
}

export interface AuthSession {
  id: string;
  email: string;
  username: string;
  role: string;
  company_id: string | null;
  company_role: string | null;
  user_type: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  county: string | null;
  value: number;
  status: string;
  company_id: string;
  project_number: string | null;
  sector: string | null;
  start_date: string | null;
  actual_start_date: string | null;
  completion_date: string | null;
  projected_finish_date: string | null;
  created_at: string;
}

export type RFIStatus = 'draft' | 'open' | 'closed';

export interface RFI {
  id: string;
  project_id: string;
  rfi_number: number;
  subject: string;
  question: string;
  due_date: string | null;
  status: RFIStatus;
  rfi_manager_id: string | null;
  responsible_contractor_id: string | null;
  assignees: string[];
  distribution_list: string[];
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
  responses?: RFIResponse[];
}

export interface RFIResponse {
  id: string;
  rfi_id: string;
  response: string;
  attachments: Attachment[];
  created_by: string;
  created_at: string;
}

export type SubmittalStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'approved_as_noted' | 'revise_resubmit' | 'rejected';

export interface Submittal {
  id: string;
  project_id: string;
  submittal_number: number;
  revision: string;
  title: string;
  status: SubmittalStatus;
  type: string | null;
  spec_id: string | null;
  submit_by: string | null;
  received_date: string | null;
  issue_date: string | null;
  final_due_date: string | null;
  ball_in_court_id: string | null;
  description: string | null;
  created_at: string;
}

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export interface Task {
  id: string;
  project_id: string;
  task_number: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  category: string | null;
  due_date: string | null;
  assignees: string[];
  distribution_list: string[];
  created_at: string;
  updated_at: string;
}

export interface DailyLog {
  id: string;
  project_id: string;
  log_date: string;
  weather_conditions: string | null;
  weather_temp: string | null;
  weather_wind: string | null;
  inspections: string | null;
  deliveries: string | null;
  visitors: string | null;
  safety_violations: string | null;
  accidents: string | null;
  delays: string | null;
  manpower: ManpowerEntry[];
  notes: string | null;
  photos: string[];
  created_by: string | null;
  created_at: string;
}

export interface ManpowerEntry {
  company: string;
  workers: number;
  hours: number;
}

export interface BudgetLineItem {
  id: string;
  project_id: string;
  cost_code: string;
  description: string;
  original_budget_amount: number;
  budget_modifications: number;
  approved_cos: number;
  pending_budget_changes: number;
  committed_costs: number;
  job_to_date_costs: number;
  commitments_invoiced: number;
  pending_cost_changes: number;
}

export interface Attachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface DirectoryContact {
  id: string;
  project_id: string;
  type: 'user' | 'company' | 'distribution_group';
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  role: string | null;
}

export interface ProjectPhoto {
  id: string;
  project_id: string;
  storage_path: string;
  url: string;
  caption: string | null;
  album_id: string | null;
  created_at: string;
  uploader_name: string | null;
}

export interface PhotoAlbum {
  id: string;
  project_id: string;
  name: string;
  cover_url: string | null;
  photo_count: number;
  created_at: string;
}

// ─── Punch List ──────────────────────────────────────────────────────────────

export type PunchListStatus = 'initiated' | 'ready_for_review' | 'not_accepted' | 'complete';
export type PunchListPriority = 'low' | 'medium' | 'high';

export interface PunchListItem {
  id: string;
  project_id: string;
  item_number: number;
  title: string;
  status: PunchListStatus;
  type: string | null;
  assignees: string[];
  due_date: string | null;
  priority: PunchListPriority | null;
  punch_item_manager_id: string | null;
  final_approver_id: string | null;
  location: string | null;
  trade: string | null;
  reference: string | null;
  description: string | null;
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
}

// ─── Drawings ────────────────────────────────────────────────────────────────

export interface Drawing {
  id: string;
  project_id: string;
  upload_id: string;
  page_number: number;
  storage_path: string;
  viewer_page: number | null;
  filename: string;
  uploaded_by_name: string | null;
  uploaded_at: string;
  drawing_date: string | null;
  received_date: string | null;
  revision: string | null;
  drawing_no: string | null;
  title: string | null;
}

export interface DrawingUpload {
  id: string;
  project_id: string;
  storage_path: string;
  filename: string;
  page_count: number;
  uploaded_by_name: string | null;
  uploaded_at: string;
}

// ─── Specifications ───────────────────────────────────────────────────────────

export interface Specification {
  id: string;
  project_id: string;
  spec_number: string | null;
  title: string;
  description: string | null;
  created_at: string;
}

// ─── Meetings ────────────────────────────────────────────────────────────────

export type MeetingStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Meeting {
  id: string;
  project_id: string;
  meeting_number: number;
  title: string;
  date: string | null;
  status: MeetingStatus;
  location: string | null;
  series: string | null;
  overview: string | null;
  meeting_link: string | null;
  timezone: string | null;
  start_time: string | null;
  end_time: string | null;
  is_private: boolean;
  is_draft: boolean;
  attendees: MeetingAttendee[];
  created_by: string | null;
  created_at: string;
}

export interface MeetingAttendee {
  contact_id: string;
  name: string;
  email: string | null;
  present: boolean;
}

// ─── Transmittals ─────────────────────────────────────────────────────────────

export interface Transmittal {
  id: string;
  project_id: string;
  transmittal_number: number;
  subject: string | null;
  to_id: string | null;
  to_name: string | null;
  cc_contacts: string[];
  sent_via: string | null;
  status: string;
  private: boolean;
  due_by: string | null;
  sent_date: string | null;
  items: TransmittalItem[];
  comments: string | null;
  attachments: Attachment[];
  created_by: string | null;
  created_at: string;
}

export interface TransmittalItem {
  description: string;
  quantity: number | null;
  type: string | null;
  action: string | null;
}

// ─── Commitments ─────────────────────────────────────────────────────────────

export type CommitmentStatus = 'draft' | 'out_for_bid' | 'out_for_signature' | 'approved' | 'complete' | 'void' | 'terminated';
export type CommitmentType = 'subcontract' | 'purchase_order';

export interface Commitment {
  id: string;
  project_id: string;
  number: string | null;
  type: CommitmentType;
  contract_company: string | null;
  title: string | null;
  status: CommitmentStatus;
  executed: boolean;
  original_contract_amount: number | null;
  approved_change_orders: number | null;
  pending_change_orders: number | null;
  trades: string[];
  start_date: string | null;
  estimated_completion: string | null;
  actual_completion: string | null;
  is_private: boolean;
  payment_terms: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  sov_accounting_method: string | null;
}

export interface CommitmentSOVLine {
  id?: string;
  line_number: number;
  budget_code: string | null;
  description: string;
  amount: number;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_cost: number | null;
  billed_to_date: number | null;
  amount_remaining: number | null;
}

// ─── Change Events ────────────────────────────────────────────────────────────

export interface ChangeEvent {
  id: string;
  project_id: string;
  number: number;
  title: string;
  status: string;
  origin: string | null;
  type: string | null;
  change_reason: string | null;
  scope: string | null;
  description: string | null;
  line_items: ChangeEventLineItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeEventLineItem {
  id: string;
  budget_code: string | null;
  description: string | null;
  unit_qty: number | null;
  unit_cost: number | null;
  rom: number | null;
  amount: number | null;
}

// ─── Change Orders ────────────────────────────────────────────────────────────

export type ChangeOrderType = 'prime' | 'commitment';

export interface ChangeOrder {
  id: string;
  project_id: string;
  number: number;
  type: ChangeOrderType;
  contract_name: string | null;
  title: string | null;
  amount: number | null;
  status: string;
  revision: string | null;
  date_initiated: string | null;
  due_date: string | null;
  is_locked: boolean;
  change_reason: string | null;
  description: string | null;
  is_private: boolean;
  executed: boolean;
  schedule_of_values: ChangeOrderSOVLine[];
  created_at: string;
  updated_at: string;
}

export interface ChangeOrderSOVLine {
  budget_code: string | null;
  description: string;
  amount: number;
}
