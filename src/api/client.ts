import { Platform } from 'react-native';
import { API_BASE_URL, API_TIMEOUT_MS } from '../config/api';
import { tokenStorage } from './tokenStorage';
import type { ApiErrorResponse, ApiSuccessResponse, AuthTokens } from './types';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  bodyFactory?: () => unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  timeoutMs?: number;
  retryOnUnauthorized?: boolean;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, body: ApiErrorResponse = {}) {
    super(
      body.error?.message ||
        body.message ||
        `API 요청에 실패했습니다. (${status})`,
    );
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error?.code || body.code || 'UNKNOWN_API_ERROR';
    this.details = body.details;
  }
}

const unwrapResponse = <T>(body: unknown): T => {
  if (
    typeof body === 'object' &&
    body !== null &&
    'success' in body &&
    (body as { success?: unknown }).success === true &&
    'data' in body
  ) {
    return (body as ApiSuccessResponse<T>).data;
  }

  return body as T;
};

const isFormData = (value: unknown): value is FormData =>
  typeof FormData !== 'undefined' && value instanceof FormData;

const parseResponse = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

let reissuePromise: Promise<AuthTokens> | null = null;
let logoutPromise: Promise<void> | null = null;
let logoutInProgress = false;

type TokenReissueResponse = {
  accessToken: string;
  refreshToken: string;
};

const isExpiredAccessTokenResponse = (
  response: Response,
  body: unknown,
): boolean =>
  response.status === 401 &&
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  (body as ApiErrorResponse).error?.code === 'EXPIRED_JWT';

const reissue = async (): Promise<AuthTokens> => {
  if (logoutInProgress) {
    throw new ApiError(401, {
      code: 'UNAUTHORIZED',
      message: '로그인이 필요합니다.',
    });
  }

  if (reissuePromise) {
    return reissuePromise;
  }

  reissuePromise = (async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      await tokenStorage.clear();
      throw new ApiError(401, {
        code: 'UNAUTHORIZED',
        message: '로그인이 필요합니다.',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reissue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });
      const body = await parseResponse(response);
      const data = unwrapResponse<Partial<TokenReissueResponse>>(body);

      if (!response.ok || !data?.accessToken || !data?.refreshToken) {
        await tokenStorage.clear();
        throw new ApiError(response.status, body as ApiErrorResponse);
      }

      const tokens: AuthTokens = {
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      };
      await tokenStorage.save(tokens);
      return tokens;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => {
    reissuePromise = null;
  });

  return reissuePromise;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const {
    method = 'GET',
    body,
    bodyFactory,
    headers = {},
    auth = true,
    timeoutMs = API_TIMEOUT_MS,
    retryOnUnauthorized = true,
  } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (auth && logoutInProgress) {
      throw new ApiError(401, {
        code: 'UNAUTHORIZED',
        message: '로그인이 필요합니다.',
      });
    }

    const accessToken = auth ? await tokenStorage.getAccessToken() : null;
    const requestBody = bodyFactory ? bodyFactory() : body;
    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers,
    };

    if (accessToken) {
      requestHeaders.Authorization = `Bearer ${accessToken}`;
    }
    if (requestBody !== undefined && !isFormData(requestBody)) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body:
        requestBody === undefined
          ? undefined
          : isFormData(requestBody)
          ? requestBody
          : JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const data = await parseResponse(response);

    if (
      auth &&
      accessToken &&
      retryOnUnauthorized &&
      isExpiredAccessTokenResponse(response, data)
    ) {
      await reissue();
      return apiRequest<T>(path, {
        ...options,
        retryOnUnauthorized: false,
      });
    }

    if (!response.ok) {
      throw new ApiError(response.status, data as ApiErrorResponse);
    }

    return unwrapResponse<T>(data);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, {
        code: 'REQUEST_TIMEOUT',
        message: '서버 응답 시간이 초과되었습니다.',
      });
    }
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message:
        '서버에 연결할 수 없습니다. 네트워크와 서버 주소를 확인해주세요.',
      details: error,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const isLocallyCompletableLogoutError = (error: unknown) =>
  error instanceof ApiError &&
  (error.code === 'INVALID_REFRESH_TOKEN' ||
    error.code === 'EXPIRED_REFRESH_TOKEN');

export const logoutSession = (): Promise<void> => {
  if (logoutPromise) {
    return logoutPromise;
  }

  logoutInProgress = true;
  logoutPromise = (async () => {
    if (reissuePromise) {
      try {
        await reissuePromise;
      } catch {
        // A rejected refresh already applies its own token cleanup policy.
      }
    }

    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      await tokenStorage.clear();
      return;
    }

    try {
      await apiRequest<void>('/auth/logout', {
        method: 'POST',
        auth: false,
        body: { refreshToken },
      });
    } catch (error) {
      if (!isLocallyCompletableLogoutError(error)) {
        throw error;
      }
    }

    await tokenStorage.clear();
  })().finally(() => {
    logoutInProgress = false;
    logoutPromise = null;
  });

  return logoutPromise;
};

export const createImageFormData = (imagePath: string) => {
  const formData = new FormData();
  // Android camera files default to JPEG; preserve explicit PNG/WEBP formats.
  const extension = imagePath.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  const format = Platform.OS === 'android' && (extension === 'png' || extension === 'webp')
    ? extension
    : 'jpg';
  const uri =
    imagePath.startsWith('file://') || imagePath.startsWith('content://')
      ? imagePath
      : `file://${imagePath}`;

  formData.append('image', {
    uri,
    type: format === 'jpg' ? 'image/jpeg' : `image/${format}`,
    name: `nunnun-${Date.now()}.${format}`,
  } as unknown as Blob);
  return formData;
};
