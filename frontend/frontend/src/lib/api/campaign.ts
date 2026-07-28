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

export type ParticipantStatus = "DRAFT" | "CONFIRMED";

export type ParticipantSummary = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalBagsPurchased: number;
  prepaidAmount: number;
  status: ParticipantStatus;
  itemsRecorded: number;
  recordedItemNames: string[];
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

export type UpdateCampaignInput = {
  name: string;
  eventDate: string;
  totalBags: number;
  pool?: PoolItemInput[];
};

export type UpdatePoolInput = {
  pool: PoolItemInput[];
};

export type UpdateParticipantInput = {
  totalBagsPurchased: number;
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
  exchangedIntoProductNames: string[];
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

/** Near-realtime polling for Campaign list/detail only (not app-wide). */
export const campaignLiveQueryOptions = {
  staleTime: 0,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true as const,
};

export const campaignApi = {
  list: () => apiClient.get<CampaignSummary[]>("/api/campaigns"),

  get: (id: string) => apiClient.get<CampaignDetail>(`/api/campaigns/${id}`),

  create: (input: CreateCampaignInput) =>
    apiClient.post<CampaignDetail>("/api/campaigns", input),

  update: (id: string, input: UpdateCampaignInput) =>
    apiClient.patch<CampaignDetail>(`/api/campaigns/${id}`, input),

  updatePool: (id: string, input: UpdatePoolInput) =>
    apiClient.put<CampaignDetail>(`/api/campaigns/${id}/pool`, input),

  delete: (id: string) => apiClient.delete<void>(`/api/campaigns/${id}`),

  closePreview: (id: string) =>
    apiClient.get<ClosePreview>(`/api/campaigns/${id}/close-preview`),

  close: (id: string) =>
    apiClient.post<CampaignDetail>(`/api/campaigns/${id}/close`),

  reopen: (id: string) =>
    apiClient.post<CampaignDetail>(`/api/campaigns/${id}/reopen`),

  recordParticipant: (campaignId: string, input: RecordParticipantInput) =>
    apiClient.post<ParticipantSummary>(
      `/api/campaigns/${campaignId}/participants`,
      input
    ),

  createDraftParticipant: (
    campaignId: string,
    input: RecordParticipantInput
  ) =>
    apiClient.post<ParticipantSummary>(
      `/api/campaigns/${campaignId}/participants/draft`,
      input
    ),

  updateParticipant: (
    campaignId: string,
    participantId: string,
    input: UpdateParticipantInput
  ) =>
    apiClient.patch<ParticipantSummary>(
      `/api/campaigns/${campaignId}/participants/${participantId}`,
      input
    ),

  confirmDraftParticipant: (campaignId: string, participantId: string) =>
    apiClient.post<ParticipantSummary>(
      `/api/campaigns/${campaignId}/participants/${participantId}/confirm`
    ),

  deleteParticipant: (campaignId: string, participantId: string) =>
    apiClient.delete<void>(
      `/api/campaigns/${campaignId}/participants/${participantId}`
    ),

  deleteDraftParticipant: (campaignId: string, participantId: string) =>
    apiClient.delete<void>(
      `/api/campaigns/${campaignId}/participants/${participantId}/draft`
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
