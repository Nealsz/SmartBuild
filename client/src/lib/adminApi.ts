/**
 * lib/adminApi.ts
 * Typed fetch utilities for all admin API endpoints.
 * Automatically attaches JWT from localStorage and redirects
 * to /admin/login on 401 responses.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Token helpers ──────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sb_admin_token");
}

export function setToken(token: string): void {
  localStorage.setItem("sb_admin_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("sb_admin_token");
  localStorage.removeItem("sb_admin_username");
}

// ── Base fetch wrapper ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true,
  retries = 1,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = getToken();
    if (!token) {
      window.location.href = "/admin/login";
      throw new Error("No token");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return apiFetch<T>(path, options, requiresAuth, retries - 1);
    }
    throw new Error("Server disconnected. Please check your connection.");
  }

  if (res.status === 401) {
    clearToken();
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Category {
  key: string;
  label: string;
  count: number;
}

export interface ComponentPage {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
): Promise<{ access_token: string; username: string }> {
  return apiFetch("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  }, false);
}

// ── Categories ─────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<{ categories: Category[] }> {
  return apiFetch("/admin/categories");
}

// ── Component CRUD ─────────────────────────────────────────────────────────────

export async function listComponents(
  category: string,
  page = 1,
  pageSize = 100,
  search = "",
): Promise<ComponentPage> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    q: search,
  });
  return apiFetch(`/admin/components/${category}?${params}`);
}

export async function createComponent(
  category: string,
  data: Record<string, unknown>,
): Promise<{ created: Record<string, unknown> }> {
  return apiFetch(`/admin/components/${category}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateComponent(
  category: string,
  id: string,
  data: Record<string, unknown>,
): Promise<{ updated: Record<string, unknown> }> {
  return apiFetch(`/admin/components/${category}/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteComponent(
  category: string,
  id: string,
): Promise<{ deleted: boolean }> {
  return apiFetch(`/admin/components/${category}/${id}`, {
    method: "DELETE",
  });
}

// ── Store Tickets Types & API ──────────────────────────────────────────────────

export interface StoreTicket {
  id: string;
  ticket_code: string;
  total_price: number;
  build_data: Record<string, unknown>;
  status: "Pending" | "Reserved" | "Building" | "Completed" | "Cancelled" | "Expired";
  is_stock_deducted: boolean;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  created_at: string;
  expires_at: string;
  updated_at?: string;
}

export interface TicketPage {
  data: StoreTicket[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  status_counts: Record<string, number>;
}

export async function createStoreTicket(payload: {
  total_price: number;
  build_data: Record<string, unknown>;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
}): Promise<{
  success: boolean;
  ticket_code: string;
  id: string;
  total_price: number;
  status: string;
  expires_at: string;
  valid_days: number;
  message: string;
}> {
  return apiFetch(
    "/tickets",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}

export async function getStoreTicketByCode(ticketCode: string): Promise<StoreTicket> {
  return apiFetch(`/tickets/${encodeURIComponent(ticketCode)}`, {}, false);
}

export async function listAdminTickets(
  params: {
    page?: number;
    pageSize?: number;
    status?: string;
    q?: string;
  } = {},
): Promise<TicketPage> {
  const qp = new URLSearchParams();
  if (params.page) qp.set("page", String(params.page));
  if (params.pageSize) qp.set("page_size", String(params.pageSize));
  if (params.status && params.status !== "All") qp.set("status", params.status);
  if (params.q) qp.set("q", params.q);
  return apiFetch(`/admin/tickets?${qp.toString()}`);
}

export async function updateAdminTicketStatus(
  ticketId: string,
  status: string,
): Promise<{
  success: boolean;
  id: string;
  ticket_code: string;
  status: string;
  is_stock_deducted: boolean;
  message: string;
}> {
  return apiFetch(`/admin/tickets/${ticketId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteAdminTicket(
  ticketId: string,
): Promise<{ deleted: boolean; id: string; ticket_code: string }> {
  return apiFetch(`/admin/tickets/${ticketId}`, {
    method: "DELETE",
  });
}
