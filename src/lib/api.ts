const API_URL = "https://counterserver.godigital145.workers.dev";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (data && typeof data === "object" && "error" in data ? String(data.error) : null) ?? "Erreur réseau");
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>("GET", path, undefined, token),
  post: <T>(path: string, body?: unknown, token?: string) => request<T>("POST", path, body, token),
  patch: <T>(path: string, body?: unknown, token?: string) => request<T>("PATCH", path, body, token),
  delete: <T>(path: string, token?: string) => request<T>("DELETE", path, undefined, token),
};
