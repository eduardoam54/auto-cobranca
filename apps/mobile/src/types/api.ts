export type UserRole = 'admin' | 'manager' | 'collector' | 'viewer';

export type PaymentMethod =
  | 'cash'
  | 'pix'
  | 'bank_slip'
  | 'credit_card'
  | 'debit_card'
  | 'other';

export type CollectionVisitResult =
  | 'paid'
  | 'partial_paid'
  | 'not_home'
  | 'refused_payment'
  | 'promised_payment'
  | 'wrong_address'
  | 'rescheduled'
  | 'other';

export type CollectionTaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'failed';

export type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
};

export type AuthUser = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
};

export type SafeUser = AuthUser & {
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type Collector = {
  id: string;
  companyId: string;
  userId?: string | null;
  name: string;
  phone: string;
  whatsappPhone?: string | null;
  email: string;
  active: boolean;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
};

export type MobileMe = {
  user: SafeUser;
  collector: Collector;
};

export type Client = {
  id: string;
  name: string;
  document: string;
  phone: string;
  whatsappPhone?: string | null;
  email?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
};

export type Collection = {
  id: string;
  clientId: string;
  title: string;
  description?: string | null;
  amount: string | number;
  dueDate: string;
  status: string;
  paymentMethod?: PaymentMethod | null;
  paidAt?: string | null;
};

export type MobileTask = {
  id: string;
  companyId: string;
  clientId: string;
  collectionId?: string | null;
  collectorId?: string | null;
  title: string;
  description?: string | null;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: CollectionTaskStatus;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  aiRecommendation?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  client?: Client;
  collection?: Collection | null;
};

export type VisitSummary = {
  id: string;
  result: CollectionVisitResult;
  notes?: string | null;
  paymentReceived: boolean;
  paymentAmount?: string | number | null;
  paymentMethod?: PaymentMethod | null;
  visitedAt: string;
};

export type CompleteTaskResponse = {
  task: MobileTask;
  visit: VisitSummary;
};

export type FailTaskResponse = CompleteTaskResponse;

export type ClientVisit = {
  id: string;
  result: CollectionVisitResult;
  notes?: string | null;
  paymentReceived: boolean;
  paymentAmount?: string | number | null;
  paymentMethod?: PaymentMethod | null;
  visitedAt: string;
  collector?: { name: string } | null;
};
