// CRM utility types and helpers

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost" | "on_hold";
export type LeadPriority = "low" | "medium" | "high";
export type ContactType = "email" | "phone" | "meeting" | "linkedin" | "slack" | "demo" | "proposal" | "other";
export type ContactOutcome = "positive" | "neutral" | "negative" | "no_response";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  on_hold: "On Hold",
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  qualified: "bg-purple-100 text-purple-700 border-purple-200",
  proposal: "bg-orange-100 text-orange-700 border-orange-200",
  negotiation: "bg-indigo-100 text-indigo-700 border-indigo-200",
  won: "bg-green-100 text-green-700 border-green-200",
  lost: "bg-red-100 text-red-700 border-red-200",
  on_hold: "bg-gray-100 text-gray-600 border-gray-200",
};

export const PRIORITY_COLORS: Record<LeadPriority, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

export const CONTACT_TYPE_ICONS: Record<ContactType, string> = {
  email: "📧",
  phone: "📞",
  meeting: "🤝",
  linkedin: "💼",
  slack: "💬",
  demo: "🖥️",
  proposal: "📄",
  other: "📌",
};

export const OUTCOME_COLORS: Record<ContactOutcome, string> = {
  positive: "text-green-600",
  neutral: "text-gray-500",
  negative: "text-red-500",
  no_response: "text-yellow-500",
};

export const PIPELINE_ORDER: LeadStatus[] = [
  "new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "on_hold"
];

export function formatCurrency(value: number | null | undefined, currency = "USD"): string {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const dateStr = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const hours = d.getHours();
  const minutes = d.getMinutes();
  if (hours === 0 && minutes === 0) return dateStr;
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${dateStr} · ${timeStr}`;
}

export function buildGoogleCalendarUrl(params: {
  title: string;
  start: Date;
  durationMinutes?: number;
  details?: string;
}): string {
  const { title, start, durationMinutes = 60, details } = params;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", `${fmt(start)}/${fmt(end)}`);
  if (details) url.searchParams.set("details", details);
  return url.toString();
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const ALL_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "on_hold"];
export const ALL_PRIORITIES: LeadPriority[] = ["high", "medium", "low"];
export const ALL_CONTACT_TYPES: ContactType[] = ["email", "phone", "meeting", "linkedin", "slack", "demo", "proposal", "other"];
export const ALL_OUTCOMES: ContactOutcome[] = ["positive", "neutral", "negative", "no_response"];
