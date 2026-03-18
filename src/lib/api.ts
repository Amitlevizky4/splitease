// In dev: Vite proxies /api to localhost:3001
// In prod: VITE_API_URL points to the Render backend
const API_BASE = import.meta.env.DEV
  ? "/api"
  : `${import.meta.env.VITE_API_URL || "https://splitease-e9ze.onrender.com"}/api`;

function getToken(): string | null {
  return localStorage.getItem("splitease_token");
}

export function setToken(token: string): void {
  localStorage.setItem("splitease_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("splitease_token");
}

export function hasToken(): boolean {
  return !!localStorage.getItem("splitease_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string; avatar: string };
}

export interface MeResponse {
  user: { id: string; name: string; email: string; avatar: string };
}

export function loginWithGoogle(
  credential: string,
  inviteToken?: string,
): Promise<AuthResponse> {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential, inviteToken }),
  });
}

export interface InviteInfo {
  inviterName: string;
  inviterAvatar: string;
  groupName?: string;
  email: string;
}

export function getInviteInfo(token: string): Promise<InviteInfo> {
  return request(`/invitations/info/${token}`);
}

export function getMe(): Promise<MeResponse> {
  return request("/auth/me");
}

// Data
export interface ApiData {
  users: Array<{ id: string; name: string; email: string; avatar: string }>;
  groups: Array<{
    id: string;
    name: string;
    emoji: string;
    currency: string;
    memberIds: string[];
    memberRoles: Record<string, string>;
  }>;
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    currency: string;
    category: string;
    date: string;
    paidBy: string;
    splits: Array<{ userId: string; amount: number }>;
    splitMethod: string;
    groupId?: string;
  }>;
  payments: Array<{
    id: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
    date: string;
    groupId?: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    amount?: number;
    currency?: string;
    date: string;
    relatedUsers: string[];
    groupId?: string;
  }>;
  friendIds: string[];
}

export function fetchData(): Promise<ApiData> {
  return request("/data");
}

// Friends
export function addFriendByEmail(email: string) {
  return request<{ id: string; name: string; email: string; avatar: string }>(
    "/friends",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export function removeFriend(friendId: string) {
  return request(`/friends/${friendId}`, { method: "DELETE" });
}

// Groups
export function createGroup(data: {
  name: string;
  emoji: string;
  currency: string;
  members: Array<{ userId: string; role: string }>;
}) {
  return request("/groups", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateGroup(
  id: string,
  data: {
    name?: string;
    emoji?: string;
    currency?: string;
    members?: Array<{ userId: string; role: string }>;
  },
) {
  return request(`/groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteGroup(id: string) {
  return request(`/groups/${id}`, { method: "DELETE" });
}

// Expenses
export function createExpense(data: {
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  paidBy: string;
  splits: Array<{ userId: string; amount: number }>;
  splitMethod: string;
  groupId?: string;
}) {
  return request("/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateExpense(
  id: string,
  data: {
    description: string;
    amount: number;
    currency: string;
    category: string;
    date: string;
    paidBy: string;
    splits: Array<{ userId: string; amount: number }>;
    splitMethod: string;
    groupId?: string;
  },
) {
  return request(`/expenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteExpense(id: string) {
  return request(`/expenses/${id}`, { method: "DELETE" });
}

// Payments
export function createPayment(data: {
  toUserId: string;
  amount: number;
  currency: string;
  groupId?: string;
}) {
  return request("/payments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function settleAllPayments(
  payments: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }>,
) {
  return request<{ count: number }>("/payments/settle-all", {
    method: "POST",
    body: JSON.stringify({ payments }),
  });
}

// Accept invite (for already-logged-in users)
export function acceptInvite(token: string) {
  return request<{ status: string; message: string }>("/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

// Invitations
export function sendInvitation(data: { email: string; groupId?: string }) {
  return request<{
    status: string;
    message: string;
    inviteLink?: string;
    user?: { id: string; name: string; email: string; avatar: string };
  }>("/invitations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
