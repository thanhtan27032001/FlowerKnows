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
  createdAt: string;
};

export type CampaignDetail = CampaignSummary & {
  poolQuantityTotal: number;
  pool: PoolItem[];
  participants: ParticipantSummary[];
  totalPoolCostValue: number;
  excludedFromCostCount: number;
  totalBagsSoldValue: number;
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
    note?: string;
  };
  bagsPurchased: number;
};

export type RecordItemLine = {
  productId: string;
  quantity: number;
};

export type RecordItemsInput = {
  customerId: string;
  lines: RecordItemLine[];
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

export type ParticipantTurn = {
  id: string;
  campaignParticipantId: string;
  customerId: string;
  customerName: string;
  turnNumber: number;
  bagCount: number;
  note: string | null;
  /** Added in v5.4 — informational only, never blocks a save. See US-38 AC #13. */
  isBalanced: boolean;
  /** Added in v5.4 — Σ bag_count minus total_bags_purchased for this row's participant. */
  difference: number;
};

/** Added in v5.4 — returned by DELETE since the row itself is gone. */
export type ParticipantTurnBalance = {
  campaignParticipantId: string;
  isBalanced: boolean;
  difference: number;
};

/** Shared shape for surfacing a v5.4 non-blocking balance mismatch to the turns table
 * banner, regardless of which of the 3 mutating endpoints (create/edit/delete) produced it. */
export type BalanceResult = {
  isBalanced: boolean;
  difference: number;
  campaignParticipantId: string;
  customerName: string;
};

export type UpdateParticipantTurnNoteInput = {
  note: string | null;
};

export type CreateParticipantTurnInput = {
  campaignParticipantId: string;
  bagCount: number;
  note?: string | null;
};

export type UpdateParticipantTurnBagCountInput = {
  bagCount: number;
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

export type SuggestPoolInput = {
  totalBags: number;
  bagPrice: number;
  expectedTotalCost: number;
  costTolerance: number;
  /** Product IDs that must appear; each is suggested at quantity=1. */
  wishlist?: string[];
};

export type SuggestedPoolItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
};

export type SuggestPoolResult = {
  suggestedPool: SuggestedPoolItem[];
  totalSuggestedCost: number;
  deviation: number;
  withinTolerance: boolean;
  warnings: string[];
};

export const campaignKeys = {
  all: ["campaigns"] as const,
  lists: () => [...campaignKeys.all, "list"] as const,
  detail: (id: string) => [...campaignKeys.all, "detail", id] as const,
  closePreview: (id: string) =>
    [...campaignKeys.all, "close-preview", id] as const,
  participantTokens: (campaignId: string, participantId: string) =>
    [...campaignKeys.all, "participant-tokens", campaignId, participantId] as const,
  participantTurns: (campaignId: string) =>
    [...campaignKeys.all, "participant-turns", campaignId] as const,
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

  suggestPool: (input: SuggestPoolInput) =>
    apiClient.post<SuggestPoolResult>("/api/campaigns/suggest-pool", input),

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

  listParticipantTurns: (campaignId: string) =>
    apiClient.get<ParticipantTurn[]>(
      `/api/campaigns/${campaignId}/participant-turns`
    ),

  updateParticipantTurnNote: (
    turnId: string,
    input: UpdateParticipantTurnNoteInput
  ) =>
    apiClient.patch<ParticipantTurn>(
      `/api/participant-turns/${turnId}`,
      input
    ),

  createParticipantTurn: (campaignId: string, input: CreateParticipantTurnInput) =>
    apiClient.post<ParticipantTurn>(
      `/api/campaigns/${campaignId}/participant-turns`,
      input
    ),

  updateParticipantTurnBagCount: (
    turnId: string,
    input: UpdateParticipantTurnBagCountInput
  ) =>
    apiClient.patch<ParticipantTurn>(
      `/api/participant-turns/${turnId}/bag-count`,
      input
    ),

  deleteParticipantTurn: (turnId: string) =>
    apiClient.delete<ParticipantTurnBalance>(`/api/participant-turns/${turnId}`),
};
