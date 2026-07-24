import { apiClient } from "@/src/lib/api/client";

export type CampaignStatus = "OPEN" | "CLOSED";

export type CampaignSummary = {
  id: string;
  name: string;
  eventDate: string;
  bagPrice: number;
  totalBags: number;
  status: CampaignStatus;
  bagsSold: number;
  createdAt: string;
};

export type PoolItem = {
  id: string;
  productId: string;
  productName: string;
  loadedQuantity: number;
  remainingQuantity: number;
};

export type ParticipantSummary = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalBagsPurchased: number;
  prepaidAmount: number;
};

export type CampaignDetail = CampaignSummary & {
  pool: PoolItem[];
  participants: ParticipantSummary[];
};

export type PoolItemInput = {
  productId: string;
  loadedQuantity: number;
};

export type CreateCampaignInput = {
  name: string;
  eventDate: string;
  bagPrice: number;
  totalBags: number;
  pool: PoolItemInput[];
};

export type ReturnItem = {
  productId: string;
  productName: string;
  quantity: number;
};

export type ClosePreview = {
  campaignId: string;
  message: string;
  productsToReturn: ReturnItem[];
};

export type RecordParticipantInput = {
  customerId?: string;
  newCustomer?: {
    name: string;
    phone?: string;
    address?: string;
  };
  bagsPurchased: number;
};

export type RecordItemsInput = {
  customerId: string;
  productId: string;
  quantity: number;
};

export type TokenRecord = {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  tokenValue: number;
  status: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
};

export type ParticipantToken = {
  id: string;
  productId: string;
  productName: string;
  tokenValue: number;
  costBasis: number | null;
  status: string;
  statusLabel: string;
  createdAt: string;
  outcomeAt: string | null;
  orderId: string | null;
  actionable: boolean;
};

export const campaignKeys = {
  all: ["campaigns"] as const,
  lists: () => [...campaignKeys.all, "list"] as const,
  detail: (id: string) => [...campaignKeys.all, "detail", id] as const,
  closePreview: (id: string) =>
    [...campaignKeys.all, "close-preview", id] as const,
  participantTokens: (campaignId: string, participantId: string) =>
    [...campaignKeys.all, "participant-tokens", campaignId, participantId] as const,
};

export const campaignApi = {
  list: () => apiClient.get<CampaignSummary[]>("/api/campaigns"),

  get: (id: string) => apiClient.get<CampaignDetail>(`/api/campaigns/${id}`),

  create: (input: CreateCampaignInput) =>
    apiClient.post<CampaignDetail>("/api/campaigns", input),

  closePreview: (id: string) =>
    apiClient.get<ClosePreview>(`/api/campaigns/${id}/close-preview`),

  close: (id: string) =>
    apiClient.post<CampaignDetail>(`/api/campaigns/${id}/close`),

  recordParticipant: (campaignId: string, input: RecordParticipantInput) =>
    apiClient.post<ParticipantSummary>(
      `/api/campaigns/${campaignId}/participants`,
      input
    ),

  recordItems: (campaignId: string, input: RecordItemsInput) =>
    apiClient.post<TokenRecord[]>(
      `/api/campaigns/${campaignId}/tokens`,
      input
    ),

  listParticipantTokens: (campaignId: string, participantId: string) =>
    apiClient.get<ParticipantToken[]>(
      `/api/campaigns/${campaignId}/participants/${participantId}/tokens`
    ),
};
