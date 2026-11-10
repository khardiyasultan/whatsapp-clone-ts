const API_BASE_URL = "http://localhost:4000/api";

export type AuthUser = {
  _id?: string;
  id?: string;
  name: string;
  email: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  token?: string;
  accessToken?: string;
  user?: AuthUser;
  [key: string]: unknown;
};

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function apiRequest<T = ApiResponse>(
  path: string,
  options: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authenticated && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = (await response.json().catch(() => ({}))) as ApiResponse;

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data as T;
}

let refreshPromise: Promise<string> | null = null;

export function refreshSession(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const data = await apiRequest<ApiResponse>("/auth/refresh", {
      method: "POST",
    });

    const token = data.token ?? data.accessToken;

    if (typeof token !== "string" || !token) {
      throw new Error("Refresh response did not contain an access token.");
    }

    setAccessToken(token);
    return token;
  })();

  return refreshPromise.finally(() => {
    refreshPromise = null;
  });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const data = await apiRequest<ApiResponse>("/auth/me", {}, true);

  if (!data.user || typeof data.user.email !== "string") {
    throw new Error("Invalid current-user response from backend.");
  }

  return data.user;
}

export async function logoutRequest() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
  }
}
