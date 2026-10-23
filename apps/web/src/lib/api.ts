import {
  AccountListDataSchema,
  AuthenticatedUserSchema,
  ErrorEnvelopeSchema,
  LoginDataSchema,
  LoginRequestSchema,
  ClaimListItemSchema,
  ClaimCompletenessSchema,
  CreateDraftClaimSchema,
  DocumentSchema,
  DownloadTargetSchema,
  DraftClaimSchema,
  HospitalClaimSchema,
  HospitalTimelineItemSchema,
  InitiateDocumentUploadSchema,
  PaginationMetaSchema,
  SubmitClaimSchema,
  UpdateDraftClaimSchema,
  UploadTargetSchema,
  SuccessEnvelopeSchema,
  ReviewerQueueItemSchema,
  ReviewerClaimSchema,
  ReviewActionSchema,
  ReviewActionInputSchema,
  InformationRequestSchema,
  CreateInformationRequestSchema,
  RespondToRequestSchema,
  AuditEntrySchema,
  NotificationSchema,
  HospitalOptionSchema,
  AiJobStatusViewSchema,
  type ClaimIntake,
  type CreateDraftClaim,
  type UserRole,
} from '@aven/contracts';
import { z } from 'zod';

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Cannot reach the Aven API. Start the API and try again.');
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ErrorEnvelopeSchema.safeParse(json);
    throw new Error(error.success ? error.data.error.message : 'The request failed.');
  }

  const envelope = SuccessEnvelopeSchema(z.unknown()).safeParse(json);
  const data = envelope.success ? schema.safeParse(envelope.data.data) : null;
  if (!data?.success) throw new Error('The API returned an unexpected response.');
  return data.data;
}

async function requestPage<T>(path: string, token: string, schema: z.ZodType<T>) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).catch(() => {
    throw new Error('Cannot reach the Aven API.');
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ErrorEnvelopeSchema.safeParse(json);
    throw new Error(error.success ? error.data.error.message : 'The request failed.');
  }
  const parsed = SuccessEnvelopeSchema(z.array(schema)).safeParse(json);
  const pagination = parsed.success
    ? PaginationMetaSchema.safeParse(parsed.data.meta.pagination)
    : null;
  if (!parsed.success || !pagination?.success)
    throw new Error('The API returned an unexpected response.');
  return { items: parsed.data.data, pagination: pagination.data };
}

export const getDemoAccounts = () => request('/auth/accounts', AccountListDataSchema);
export const login = (accountId: string) =>
  request('/auth/login', LoginDataSchema, {
    method: 'POST',
    body: LoginRequestSchema.parse({ accountId }),
  });
export const getCurrentUser = (token: string) =>
  request('/auth/me', AuthenticatedUserSchema, { token });
export const homeForRole = (role: UserRole) =>
  role === 'HOSPITAL_DESK' ? '/hospital' : '/reviewer';

export const listClaims = (token: string, page = 1, pageSize = 20, status?: string) =>
  requestPage(
    `/claims?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ''}`,
    token,
    ClaimListItemSchema,
  );
export const getClaim = (token: string, id: string) =>
  request(`/claims/${id}`, HospitalClaimSchema, { token });
export const createClaim = (token: string, input: CreateDraftClaim) =>
  request('/claims', DraftClaimSchema, {
    token,
    method: 'POST',
    body: CreateDraftClaimSchema.parse(input),
  });
export const updateClaim = (token: string, id: string, version: number, intake: ClaimIntake) =>
  request(`/claims/${id}`, DraftClaimSchema, {
    token,
    method: 'PUT',
    body: UpdateDraftClaimSchema.parse({ expectedVersion: version, intake }),
  });
export const getCompleteness = (token: string, id: string) =>
  request(`/claims/${id}/completeness`, ClaimCompletenessSchema, { token });
export const submitClaim = (token: string, id: string, version: number, emergencyReason?: string) =>
  request(`/claims/${id}/submit`, HospitalClaimSchema, {
    token,
    method: 'POST',
    body: SubmitClaimSchema.parse({ expectedVersion: version, emergencyReason }),
  });
export const getTimeline = (token: string, id: string) =>
  request(`/claims/${id}/timeline`, z.array(HospitalTimelineItemSchema), { token });
export const listDocuments = (token: string, id: string) =>
  request(`/claims/${id}/documents`, z.array(DocumentSchema), { token });
export const initiateUpload = (
  token: string,
  id: string,
  input: z.input<typeof InitiateDocumentUploadSchema>,
) =>
  request(`/claims/${id}/documents/uploads`, UploadTargetSchema, {
    token,
    method: 'POST',
    body: InitiateDocumentUploadSchema.parse(input),
  });
export const finalizeUpload = (token: string, id: string, uploadToken: string) =>
  request(`/claims/${id}/documents/uploads/finalize`, DocumentSchema, {
    token,
    method: 'POST',
    body: { uploadToken },
  });
export const getDownload = (token: string, claimId: string, documentId: string, version: number) =>
  request(
    `/claims/${claimId}/documents/${documentId}/versions/${version}/download`,
    DownloadTargetSchema,
    { token },
  );

export function putPdf(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (value: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('File upload failed.'));
    xhr.onerror = () => reject(new Error('Could not reach document storage.'));
    xhr.send(file);
  });
}

export const getReviewerHospitals = (token: string) =>
  request('/workflow/hospitals', z.array(HospitalOptionSchema), { token });
export const getReviewerQueue = (
  token: string,
  filters: {
    page: number;
    status?: string;
    hospitalId?: string;
    olderThanHours?: number;
    actionRequired?: boolean;
  },
) => {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: '20' });
  if (filters.status) query.set('status', filters.status);
  if (filters.hospitalId) query.set('hospitalId', filters.hospitalId);
  if (filters.olderThanHours) query.set('olderThanHours', String(filters.olderThanHours));
  if (filters.actionRequired) query.set('actionRequired', 'true');
  return requestPage(`/workflow/queue?${query}`, token, ReviewerQueueItemSchema);
};
export const getReviewerClaim = (token: string, id: string) =>
  request(`/workflow/claims/${id}`, ReviewerClaimSchema, { token });
export const getAiJobStatus = (token: string, id: string) =>
  request(`/workflow/claims/${id}/ai-job`, AiJobStatusViewSchema.nullable(), { token });
export const getReviewActions = (token: string, id: string) =>
  request(`/workflow/claims/${id}/actions`, z.array(ReviewActionSchema), { token });
export const createReviewAction = (
  token: string,
  id: string,
  input: z.input<typeof ReviewActionInputSchema>,
) =>
  request(`/workflow/claims/${id}/actions`, ReviewActionSchema, {
    token,
    method: 'POST',
    body: ReviewActionInputSchema.parse(input),
  });
export const getInformationRequests = (token: string, id: string) =>
  request(`/workflow/claims/${id}/requests`, z.array(InformationRequestSchema), { token });
export const createInformationRequest = (
  token: string,
  id: string,
  input: z.input<typeof CreateInformationRequestSchema>,
) =>
  request(`/workflow/claims/${id}/requests`, z.object({ id: z.string().uuid() }), {
    token,
    method: 'POST',
    body: CreateInformationRequestSchema.parse(input),
  });
export const respondToInformationRequest = (
  token: string,
  id: string,
  requestId: string,
  input: z.input<typeof RespondToRequestSchema>,
) =>
  request(
    `/workflow/claims/${id}/requests/${requestId}/respond`,
    z.array(InformationRequestSchema),
    {
      token,
      method: 'POST',
      body: RespondToRequestSchema.parse(input),
    },
  );
export const getAudit = (token: string, id: string) =>
  request(`/workflow/claims/${id}/audit`, z.array(AuditEntrySchema), { token });
export const getNotifications = (token: string) =>
  request('/workflow/notifications', z.array(NotificationSchema), { token });
export const readNotification = (token: string, id: string) =>
  request(`/workflow/notifications/${id}/read`, z.array(NotificationSchema), {
    token,
    method: 'POST',
  });
