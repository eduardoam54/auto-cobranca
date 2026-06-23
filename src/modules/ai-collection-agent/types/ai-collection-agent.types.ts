import { AiIntent } from '../enums/ai-intent.enum';
import { AiPriority } from '../enums/ai-priority.enum';
import { AiRecommendedAction } from '../enums/ai-recommended-action.enum';

export type AiCollectionAgentInput = {
  companyId: string;
  phone: string;
  messageContent: string;
  messageId?: string;
  clientId?: string;
};

export type AiExtractedData = {
  date: string | null;
  time: string | null;
  amount: number | null;
  addressMentioned: boolean;
};

export type AiActionRecommendation = {
  type: AiRecommendedAction;
  responsible: 'collector' | 'operator' | 'system' | null;
  messageToCollector: string | null;
  messageToClient: string | null;
};

export type AiIdentifiedClient = {
  clientId: string;
  clientName: string;
  clientPhone: string;
} | null;

export type AiOpenCollectionsSummary = {
  totalOpenAmount: number | null;
  openCollectionsCount: number | null;
  overdueCollectionsCount: number | null;
};

export type AiTaskCreationResult = {
  taskCreated: boolean;
  taskId: string | null;
  existingTaskId: string | null;
  taskCreationReason:
    | 'created'
    | 'duplicate_pending_task'
    | 'conditions_not_met';
};

export type AiCollectionAgentResult = {
  clientIdentified: boolean;
  client: AiIdentifiedClient;
  openCollectionsSummary: AiOpenCollectionsSummary;
  taskCreated: boolean;
  taskId: string | null;
  existingTaskId: string | null;
  taskCreationReason:
    | 'created'
    | 'duplicate_pending_task'
    | 'conditions_not_met';
  intent: AiIntent;
  confidence: number;
  priority: AiPriority;
  summary: string;
  extractedData: AiExtractedData;
  recommendedAction: AiActionRecommendation;
  risks: string[];
};
