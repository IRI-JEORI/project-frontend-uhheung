import { UPLOAD_TIMEOUT_MS } from '../config/api';
import { apiRequest, createImageFormData, logoutSession } from './client';
import { tokenStorage } from './tokenStorage';
import type {
  AuthTokens,
  CurrentUser,
  CreateFixedScheduleRequest,
  DayOfWeek,
  DemoLoginResponse,
  DndWindow,
  FixedSchedule,
  GroupSummary,
  MyTodayResponse,
  MyStatsResponse,
  CreateSleepSessionResponse,
  JsonObject,
  SelfVerifyCreated,
  User,
  UpdateCurrentUserRequest,
  UpdateFixedScheduleRequest,
  WakeGroupDetail,
  PendingWakeSuccess,
  WakeGroupCreated,
  WakeGroupPreview,
  WakeGroupJoinResult,
  WakeGroupUpdated,
  WakeProofResult,
  WakeProofShareResult,
  WakeRequest,
  WakeRequestCreated,
  WakeTarget,
  WakeTargetUpdated,
} from './types';

const encode = (value: string | number) => encodeURIComponent(String(value));

export const authApi = {
  getDemoAccounts: () =>
    apiRequest<{ accounts: User[] }>('/demo-accounts', { auth: false }),

  demoLogin: async (demoAccountId: number) => {
    const response = await apiRequest<DemoLoginResponse>('/auth/demo-login', {
      method: 'POST',
      auth: false,
      body: { demo_account_id: demoAccountId },
    });
    await tokenStorage.save(response);
    return response;
  },

  reissue: async (refreshToken: string) => {
    const response = await apiRequest<{
      accessToken: string;
      refreshToken: string;
    }>('/auth/reissue', {
      method: 'POST',
      auth: false,
      body: { refreshToken },
    });
    const tokens: AuthTokens = {
      access_token: response.accessToken,
      refresh_token: response.refreshToken,
    };
    await tokenStorage.save(tokens);
    return tokens;
  },

  logout: logoutSession,
};

export const userApi = {
  getMe: () => apiRequest<CurrentUser>('/users/me'),
  updateMe: (input: UpdateCurrentUserRequest) =>
    apiRequest<CurrentUser>('/users/me', {
      method: 'PATCH',
      body: input,
    }),
  deleteMe: () => apiRequest<void>('/users/me', { method: 'DELETE' }),
};

export const deviceApi = {
  register: (fcmToken: string) =>
    apiRequest<{ registered: boolean }>('/devices', {
      method: 'POST',
      body: { fcm_token: fcmToken, platform: 'ANDROID' },
    }),
};

export const wakeTargetApi = {
  list: () => apiRequest<{ targets: WakeTarget[] }>('/me/wake-targets'),
  upsert: (text: string) =>
    apiRequest<WakeTargetUpdated>('/me/wake-targets', {
      method: 'POST',
      body: { text },
    }),
  remove: (dayOfWeek: DayOfWeek) =>
    apiRequest<void>(`/me/wake-targets/${encode(dayOfWeek)}`, {
      method: 'DELETE',
    }),
};

export const dndApi = {
  list: () => apiRequest<{ windows: DndWindow[] }>('/me/dnd-windows'),
  create: (text: string) =>
    apiRequest<DndWindow>('/me/dnd-windows', {
      method: 'POST',
      body: { text },
    }),
  remove: (id: number) =>
    apiRequest<void>(`/me/dnd-windows/${encode(id)}`, {
      method: 'DELETE',
    }),
};

export const scheduleApi = {
  list: () => apiRequest<FixedSchedule[]>('/me/fixed-schedules'),
  create: (input: CreateFixedScheduleRequest) =>
    apiRequest<FixedSchedule>('/me/fixed-schedules', {
      method: 'POST',
      body: input,
    }),
  update: (id: number, input: UpdateFixedScheduleRequest) =>
    apiRequest<FixedSchedule>(`/me/fixed-schedules/${encode(id)}`, {
      method: 'PATCH',
      body: input,
    }),
  remove: (id: number) =>
    apiRequest<void>(`/me/fixed-schedules/${encode(id)}`, {
      method: 'DELETE',
    }),
  analyzeImage: (imagePath: string) =>
    apiRequest<JsonObject>('/me/fixed-schedules/analyze', {
      method: 'POST',
      bodyFactory: () => createImageFormData(imagePath),
      timeoutMs: UPLOAD_TIMEOUT_MS,
    }),
  import: (input: JsonObject) =>
    apiRequest<JsonObject>('/me/fixed-schedules/import', {
      method: 'POST',
      body: input,
    }),
};

export const groupApi = {
  list: () => apiRequest<{ groups: GroupSummary[] }>('/groups'),
  create: (name: string) =>
    apiRequest<WakeGroupCreated>('/wake-groups', {
      method: 'POST',
      body: { name },
    }),
  detail: (id: number) =>
    apiRequest<WakeGroupDetail>(`/wake-groups/${encode(id)}`),
  rename: (id: number, name: string) =>
    apiRequest<WakeGroupUpdated>(`/wake-groups/${encode(id)}`, {
      method: 'PATCH',
      body: { name },
    }),
  preview: (inviteCode: string) =>
    apiRequest<WakeGroupPreview>(
      `/wake-groups/preview?code=${encode(inviteCode)}`,
    ),
  join: (inviteCode: string) =>
    apiRequest<WakeGroupJoinResult>('/wake-groups/join', {
      method: 'POST',
      body: { invite_code: inviteCode },
    }),
  leave: (id: number) =>
    apiRequest<void>(`/wake-groups/${encode(id)}/members/me`, {
      method: 'DELETE',
    }),
  getInviteCode: (id: number) =>
    apiRequest<{ invite_code: string }>(
      `/wake-groups/${encode(id)}/invite-code`,
    ),
  getPendingWakeSuccess: (id: number) =>
    apiRequest<PendingWakeSuccess | null>(
      `/wake-groups/${encode(id)}/wake-successes/pending`,
    ),
};

export const wakeApi = {
  wakeMember: (groupId: number, userId: number) =>
    apiRequest<WakeRequestCreated>(
      `/wake-groups/${encode(groupId)}/members/${encode(userId)}/wake`,
      { method: 'POST' },
    ),
  getRequest: (wakeRequestId: number) =>
    apiRequest<WakeRequest>(`/wake-requests/${encode(wakeRequestId)}`),
  getPendingRequest: () =>
    apiRequest<WakeRequest | null>('/me/wake-requests/pending'),
  decline: (wakeRequestId: number) =>
    apiRequest<void>(`/wake-requests/${encode(wakeRequestId)}/decline`, {
      method: 'POST',
    }),
  uploadProof: (wakeRequestId: number, imagePath: string) =>
    apiRequest<WakeProofResult>(
      `/wake-requests/${encode(wakeRequestId)}/proof`,
      {
        method: 'POST',
        bodyFactory: () => createImageFormData(imagePath),
        timeoutMs: UPLOAD_TIMEOUT_MS,
      },
    ),
  shareProof: (wakeRequestId: number, groupIds: number[]) =>
    apiRequest<WakeProofShareResult>(
      `/wake-requests/${encode(wakeRequestId)}/proof/share`,
      {
        method: 'POST',
        body: { group_ids: groupIds },
      },
    ),
  acknowledgeSuccess: (wakeRequestId: number) =>
    apiRequest<void>(
      `/wake-requests/${encode(wakeRequestId)}/success/ack`,
      { method: 'POST' },
    ),
  startSelfVerify: (groupId: number) =>
    apiRequest<SelfVerifyCreated>(`/wake-groups/${encode(groupId)}/self-verify`, {
      method: 'POST',
    }),
};

export const meApi = {
  getToday: () => apiRequest<MyTodayResponse>('/me/today'),
  updateBedTime: (bedTime: string) =>
    apiRequest<{ targetBedTime: string }>('/me/today/bed-time', {
      method: 'PATCH',
      body: { targetBedTime: bedTime },
    }),
  updateReturnTime: (returnTime: string) =>
    apiRequest<{ estimatedReturnTime: string }>('/me/today/return-time', {
      method: 'PATCH',
      body: { estimatedReturnTime: returnTime },
    }),
  sleep: () =>
    apiRequest<CreateSleepSessionResponse>('/me/sleep', {
      method: 'POST',
      body: { source: 'APP' },
    }),
  getStats: () => apiRequest<MyStatsResponse>('/me/stats'),
  submitSleepFeedback: (input: JsonObject) =>
    apiRequest<JsonObject>('/me/sleep-feedback', {
      method: 'POST',
      body: input,
    }),
};

export const nunnunApi = {
  auth: authApi,
  user: userApi,
  device: deviceApi,
  wakeTarget: wakeTargetApi,
  dnd: dndApi,
  schedule: scheduleApi,
  group: groupApi,
  wake: wakeApi,
  me: meApi,
};
