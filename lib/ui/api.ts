/**
 * Typed client for the existing backend routes (consumed as-is). One module so
 * every screen shares the same request shapes and TS types. All calls are
 * relative (same-origin) so they work in dev and prod without config.
 */

export interface FieldChange {
  path: string;
  op: "added" | "removed" | "changed";
  oldValue?: unknown;
  newValue?: unknown;
}
export interface DiffDetail {
  changes?: FieldChange[];
  counts?: { added: number; removed: number; changed: number };
}

export interface SignalEventDTO {
  signalEventId: string;
  companyId: string;
  companyName: string | null;
  trackedPageId: string;
  signalType: string;
  severity: string;
  summary: string;
  diffDetail?: DiffDetail;
  detectedAt: string;
}

export interface CompanyDTO {
  companyId: string;
  name: string;
  rootUrl: string;
  createdAt?: string;
}

export interface TrackedPageDTO {
  trackedPageId: string;
  pageType: string;
  url: string;
  status: string;
  collectorId: string | null;
  lastScrapedAt: string | null;
}

export interface PagesResponse {
  companyId: string;
  count: number;
  discovery: {
    suggestManualEntry: boolean;
    missingPageTypes: string[];
    message: string | null;
  };
  pages: TrackedPageDTO[];
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function postJSON<T>(url: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({} as T)) };
}

// ---- reads ----
export async function fetchGlobalEvents(params?: { signalType?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.signalType) q.set("signalType", params.signalType);
  q.set("limit", String(params?.limit ?? 100));
  return getJSON<{ count: number; filter: unknown; events: SignalEventDTO[] }>(`/api/events?${q}`);
}

export async function fetchCompanyEvents(companyId: string, limit = 100) {
  return getJSON<{ companyId: string; count: number; events: SignalEventDTO[] }>(
    `/api/companies/${companyId}/events?limit=${limit}`
  );
}

export async function fetchCompanies() {
  return getJSON<{ count: number; companies: CompanyDTO[] }>(`/api/companies`);
}

export async function fetchCompanyPages(companyId: string) {
  return getJSON<PagesResponse>(`/api/companies/${companyId}/pages`);
}

// ---- writes ----
export async function addCompany(input: { url: string; name?: string; email?: string; discover?: boolean }) {
  return postJSON<{ companyId: string; name: string; rootUrl: string; discovery: string; error?: string }>(
    `/api/companies`,
    input
  );
}

export async function addOrCorrectPage(companyId: string, input: { pageType: string; url: string }) {
  return postJSON<TrackedPageDTO & { error?: string }>(`/api/companies/${companyId}/pages`, input);
}
