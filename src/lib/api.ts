const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, token?: string): Promise<T> {
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
};
