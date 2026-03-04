export type AdminSessionItem = {
  session_id: string;
  doc_id: string;
  user_name: string;
  transport: string;
  created_at: string;
  last_seen_at: string;
  client_ip?: string | null;
  user_agent?: string | null;
};

export type AdminDocumentItem = {
  id: string;
  has_password: boolean;
  char_count: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  delete_reason?: string | null;
};

export type AdminSignalingUrlItem = {
  id: number;
  url: string;
  label?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_tested_at?: string | null;
  last_test_source?: string | null;
  last_test_ok?: boolean | null;
  last_test_connect_ms?: number | null;
  last_test_detail?: string | null;
};

export type AdminSignalingTestItem = {
  url: string;
  ok: boolean;
  connect_ms?: number | null;
  detail: string;
  source: "backend" | "frontend";
};

const ADMIN_TOKEN_KEY = "coedit_admin_token";

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  if (!token) {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  const token = getAdminToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers, cache: "no-store" });
}
