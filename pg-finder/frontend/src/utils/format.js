export const fmtINR = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN");

export const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");

export function timeAgo(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function fmtDate(isoStr) {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(isoStr) {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export const ROOM_TYPES = ["Single", "Double Sharing", "Triple Sharing", "Four Sharing"];
export const GENDERS = ["Male", "Female", "Unisex"];
export const AMENITIES = [
  "Wi-Fi", "Food", "AC", "Parking", "Laundry", "CCTV", "Security",
  "Power Backup", "Housekeeping", "Gym", "Hot Water", "Kitchen", "Study Area", "Furnished",
];
export const BUDGET_BANDS = [
  { label: "₹3,000 – ₹5,000", min: 3000, max: 5000 },
  { label: "₹5,000 – ₹10,000", min: 5000, max: 10000 },
  { label: "₹10,000 – ₹15,000", min: 10000, max: 15000 },
  { label: "₹15,000+", min: 15000, max: null },
];
export const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "nearest", label: "Nearest" },
  { value: "lowest_rent", label: "Lowest Rent" },
  { value: "highest_rated", label: "Highest Rated" },
  { value: "most_reviewed", label: "Most Reviewed" },
  { value: "newest", label: "Newest" },
];
export const BOOKING_STATUS = {
  pending: { label: "Pending", cls: "amber" },
  confirmed: { label: "Confirmed", cls: "blue" },
  active: { label: "Active", cls: "green" },
  completed: { label: "Completed", cls: "gray" },
  cancelled: { label: "Cancelled", cls: "red" },
  rejected: { label: "Rejected", cls: "red" },
};
export const VISIT_STATUS = {
  pending: { label: "Pending", cls: "amber" },
  accepted: { label: "Accepted", cls: "green" },
  rescheduled: { label: "Rescheduled", cls: "blue" },
  rejected: { label: "Rejected", cls: "red" },
  cancelled: { label: "Cancelled", cls: "red" },
  completed: { label: "Completed", cls: "gray" },
};
export const ENQUIRY_TOPICS = [
  "Availability", "Rent", "Deposit", "Food", "AC", "Wi-Fi", "Rules", "Visitors", "Facilities", "General",
];
export const REPORT_REASONS = [
  "Fake listing", "Wrong information", "Harassment", "Fraud", "Safety concern", "Spam", "Other",
];
