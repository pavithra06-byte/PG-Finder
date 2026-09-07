import { BOOKING_STATUS, VISIT_STATUS } from "../utils/format.js";

export function BookingStatus({ status }) {
  const s = BOOKING_STATUS[status] || { label: status, cls: "gray" };
  return <span className={`badge badge-${s.cls}`}>{s.label}</span>;
}

export function VisitStatus({ status }) {
  const s = VISIT_STATUS[status] || { label: status, cls: "gray" };
  return <span className={`badge badge-${s.cls}`}>{s.label}</span>;
}

export function ListingStatus({ status }) {
  const map = {
    approved: ["Published", "green"], pending: ["Pending Approval", "amber"],
    rejected: ["Rejected", "red"], suspended: ["Suspended", "red"],
    unpublished: ["Unpublished", "gray"], draft: ["Draft", "gray"],
  };
  const [label, cls] = map[status] || [status, "gray"];
  return <span className={`badge badge-${cls}`}>{label}</span>;
}

export function VerificationStatus({ status }) {
  const map = {
    approved: ["Verified", "green"], pending: ["Pending", "amber"], rejected: ["Rejected", "red"],
  };
  const [label, cls] = map[status] || [status, "gray"];
  return <span className={`badge badge-${cls}`}>{label}</span>;
}

export function StatCard({ icon, label, value, color = "var(--brand)", bg = "var(--brand-50)" }) {
  return (
    <div className="card stat-card">
      <div className="s-ic" style={{ background: bg, color }}>{icon}</div>
      <div>
        <div className="s-val">{value}</div>
        <div className="s-lbl">{label}</div>
      </div>
    </div>
  );
}
