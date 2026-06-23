export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    companyId: string;
    name: string;
    email: string;
    role: string;
  };
};

export type DashboardSummary = {
  clientsCount: number;
  collections: {
    pending: number;
    overdue: number;
    paid: number;
    totalOpenAmount: number;
    totalPaidAmount: number;
  };
  tasks: {
    pending: number;
    completed: number;
  };
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
  paymentMethod?: string | null;
};

export type Collector = {
  id: string;
  userId?: string | null;
  name: string;
  phone: string;
  whatsappPhone?: string | null;
  email: string;
  active: boolean;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
};

export type CollectionTask = {
  id: string;
  title: string;
  description?: string | null;
  clientId: string;
  collectionId?: string | null;
  collectorId?: string | null;
  type: string;
  priority: string;
  status: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  aiRecommendation?: string | null;
  completedAt?: string | null;
  createdAt?: string;
};

export type Message = {
  id: string;
  clientId?: string | null;
  phone: string;
  direction: string;
  channel: string;
  content: string;
  status: string;
  receivedAt?: string | null;
  sentAt?: string | null;
  aiAnalyzed?: boolean;
  aiIntent?: string | null;
  aiConfidence?: number | null;
  aiSummary?: string | null;
};

export type AiCollectionAgentResult = {
  clientIdentified: boolean;
  client: {
    clientId: string;
    clientName: string;
    clientPhone: string;
  } | null;
  openCollectionsSummary: {
    totalOpenAmount: number | null;
    openCollectionsCount: number | null;
    overdueCollectionsCount: number | null;
  };
  taskCreated: boolean;
  taskId: string | null;
  existingTaskId: string | null;
  taskCreationReason:
    | 'created'
    | 'duplicate_pending_task'
    | 'conditions_not_met';
  intent: string;
  confidence: number;
  priority: string;
  summary: string;
  extractedData: {
    date: string | null;
    time: string | null;
    amount: number | null;
    addressMentioned: boolean;
  };
  recommendedAction: {
    type: string;
    responsible: string | null;
    messageToCollector: string | null;
    messageToClient: string | null;
  };
  risks: string[];
};

export type CollectionVisit = {
  id: string;
  taskId: string;
  clientId: string;
  collectionId?: string | null;
  collectorId?: string | null;
  result: string;
  notes?: string | null;
  paymentReceived: boolean;
  paymentAmount?: string | number | null;
  paymentMethod?: string | null;
  receiptUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  proofPhotoUrl?: string | null;
  visitedAt: string;
  createdAt: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};
