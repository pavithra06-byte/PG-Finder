import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users, Building2, ShieldCheck, Star, Flag, Megaphone, BarChart3, Sparkles,
  Check, X, Ban, UserCheck, Trash2, Search,
} from "lucide-react";
import api, { errMsg } from "../../api/client.js";
import { useToast } from "../../context/ToastContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import { StatCard, BookingStatus, ListingStatus, VerificationStatus } from "../../components/StatusBadge.jsx";
import WelcomeBanner from "../../components/WelcomeBanner.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Modal from "../../components/Modal.jsx";
import { fmtDate, fmtINR, timeAgo } from "../../utils/format.js";

const toast = {};


export function AdminDashboard() {
  const [s, setS] = useState(null);
  const [a, setA] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [owners, setOwners] = useState([]);
  const toast = useToast();
  const load = () => {
    api.get("/admin/dashboard").then((r) => setS(r.data.data)).catch(() => {});
    api.get("/admin/analytics").then((r) => setA(r.data.data)).catch(() => {});
    api.get("/admin/users", { params: { role: "tenant", per_page: 5 } }).then((r) => setTenants(r.data.data.items)).catch(() => {});
    api.get("/admin/users", { params: { role: "owner", per_page: 5 } }).then((r) => setOwners(r.data.data.items)).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  if (!s) return <div className="skel" style={{ height: 300 }} />;

  return (
    <div>
      <WelcomeBanner />
      <div className="stat-grid">
        <StatCard icon={<Users size={20} />} label="Total Users" value={s.users} />
        <StatCard icon={<Users size={20} />} label="Tenants" value={s.tenants} color="#1d4ed8" bg="var(--blue-bg)" />
        <StatCard icon={<ShieldCheck size={20} />} label="Owners" value={s.owners} color="#b45309" bg="var(--amber-bg)" />
        <StatCard icon={<ShieldCheck size={20} />} label="Pending Owner Verifications" value={s.pendingOwners} color="#b91c1c" bg="var(--red-bg)" />
        <StatCard icon={<Building2 size={20} />} label="PG Listings" value={s.pgListings} />
        <StatCard icon={<Sparkles size={20} />} label="Pending Listings" value={s.pendingListings} color="#b45309" bg="var(--amber-bg)" />
        <StatCard icon={<Building2 size={20} />} label="Rooms" value={s.rooms} color="#1d4ed8" bg="var(--blue-bg)" />
        <StatCard icon={<Building2 size={20} />} label="Occupied Beds" value={s.occupiedBeds} />
        <StatCard icon={<Star size={20} />} label="Bookings" value={s.bookings} color="#7c3aed" bg="#ede9fe" />
        <StatCard icon={<Star size={20} />} label="Active Bookings" value={s.activeBookings} color="#047857" bg="var(--green-bg)" />
        <StatCard icon={<Star size={20} />} label="Completed" value={s.completedBookings} color="#1d4ed8" bg="var(--blue-bg)" />
        <StatCard icon={<Star size={20} />} label="Cancelled" value={s.cancelledBookings} color="#b91c1c" bg="var(--red-bg)" />
        <StatCard icon={<Star size={20} />} label="Reviews" value={s.reviews} color="#b45309" bg="var(--amber-bg)" />
        <StatCard icon={<Flag size={20} />} label="Open Reports" value={s.openReports} color="#b91c1c" bg="var(--red-bg)" />
      </div>

      <div className="grid-2 mb-24">
        <div className="card" style={{ padding: 22 }}>
          <div className="flex-between mb-16">
            <h3 style={{ fontSize: 16 }}>Recent Tenants</h3>
            <Link to="/admin/users?role=tenant" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {tenants.length === 0 ? <p className="small muted">No tenant details available.</p> : tenants.map((tenant) => (
            <div key={tenant.id} className="flex-between" style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div><b style={{ fontSize: 13.5 }}>{tenant.name}</b><div className="small muted">{tenant.email}</div></div>
              <span className={`badge ${tenant.status === "suspended" ? "badge-red" : "badge-green"}`}>{tenant.status || "active"}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div className="flex-between mb-16">
            <h3 style={{ fontSize: 16 }}>Recent PG Owners</h3>
            <Link to="/admin/owners" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {owners.length === 0 ? <p className="small muted">No owner details available.</p> : owners.map((owner) => (
            <div key={owner.id} className="flex-between" style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div><b style={{ fontSize: 13.5 }}>{owner.name}</b><div className="small muted">{owner.email} · {owner.pgCount || 0} PGs</div></div>
              <VerificationStatus status={owner.verificationStatus} />
            </div>
          ))}
        </div>
      </div>

      {a && (
        <div className="grid-2">
          <div className="card" style={{ padding: 22 }}>
            <h3 className="mb-16" style={{ fontSize: 16 }}>User Registrations</h3>
            <LineChart data={a.userRegistrations} xKey="month" yKey="count" />
          </div>
          <div className="card" style={{ padding: 22 }}>
            <h3 className="mb-16" style={{ fontSize: 16 }}>Booking Trends</h3>
            <LineChart data={a.bookings} xKey="month" yKey="count" />
          </div>
          <div className="card" style={{ padding: 22 }}>
            <h3 className="mb-16" style={{ fontSize: 16 }}>Popular Locations (by listings)</h3>
            <BarChart data={a.popularLocations} xKey="city" yKey="count" />
          </div>
          <div className="card" style={{ padding: 22 }}>
            <h3 className="mb-16" style={{ fontSize: 16 }}>Popular Room Types (by bookings)</h3>
            <BarChart data={a.popularRoomTypes} xKey="roomType" yKey="count" />
          </div>
        </div>
      )}
    </div>
  );
}


export function AdminUsers({ verifyOnly }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const toast = useToast();
  const load = () => {
    const params = { per_page: 50 };
    if (verifyOnly) params.role = "owner";
    if (q) params.q = q;
    api.get("/admin/users", { params }).then((r) => setItems(r.data.data.items)).catch(() => setItems([]));
  };
  useEffect(() => { load(); }, [verifyOnly]);
  if (!items) return <div className="skel" style={{ height: 200 }} />;

  const setStatus = async (id, status) => {
    try { await api.post(`/admin/users/${id}/status`, { status }); toast.success(`User ${status}`); load(); }
    catch (e) { toast.error("Action failed", errMsg(e)); }
  };
  const verify = async (id, decision, reason) => {
    try { await api.post(`/admin/owners/${id}/verify`, { decision, reason }); toast.success(`Owner ${decision}`); load(); }
    catch (e) { toast.error("Action failed", errMsg(e)); }
  };

  return (
    <div>
      <div className="dash-head"><h1>{verifyOnly ? "Owner Verification" : "Users"}</h1>
        <div className="flex"><input className="input" style={{ width: 220 }} placeholder="Search name / email…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="btn btn-outline" onClick={load}><Search size={15} /></button></div></div>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>User</th><th>Role</th><th>Status</th>{verifyOnly && <th>Verification</th>}<th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map((u) => {
            const verificationStatus = u.verificationStatus || "pending";
            return (
              <tr key={u.id}>
              <td><b>{u.name}</b><div className="small muted">{u.email}</div></td>
              <td><span className="badge badge-blue" style={{ textTransform: "capitalize" }}>{u.role}</span></td>
              <td>{u.status === "active" ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Suspended</span>}</td>
              {verifyOnly && <td><VerificationStatus status={verificationStatus} /></td>}
              <td className="small muted">{fmtDate(u.createdAt)}</td>
              <td className="acts">
                {verifyOnly && verificationStatus === "pending" && <>
                  <button className="btn btn-primary btn-sm" onClick={() => verify(u.id, "approved")}><UserCheck size={13} /> Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => verify(u.id, "rejected", "Documents unclear")}><X size={13} /> Reject</button>
                </>}
                {!verifyOnly && u.role !== "admin" && (
                  u.status === "active"
                    ? <button className="btn btn-outline btn-sm" onClick={() => setStatus(u.id, "suspended")}><Ban size={13} /> Suspend</button>
                    : <button className="btn btn-primary btn-sm" onClick={() => setStatus(u.id, "active")}><Check size={13} /> Activate</button>
                )}
              </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </div>
  );
}


export function AdminListings() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const toast = useToast();
  const load = () => api.get("/admin/listings", { params: { status: filter, per_page: 50 } }).then((r) => setItems(r.data.data.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, [filter]);
  if (!items) return <div className="skel" style={{ height: 200 }} />;

  const decide = async (id, action, reason) => {
    try { await api.post(`/admin/listings/${id}/${action}`, { reason } || {}); toast.success(`Listing ${action}d`); load(); }
    catch (e) { toast.error("Action failed", errMsg(e)); }
  };

  return (
    <div>
      <div className="dash-head"><h1>PG Listings</h1>
        <div className="flex" style={{ gap: 6 }}>
          {["pending", "approved", "rejected", "suspended", "unpublished"].map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div></div>
      {items.length === 0 ? <EmptyState title={`No ${filter} listings`} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((p) => (
            <div key={p.id} className="card" style={{ padding: 16, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <img src={p.images?.[0] || "https://placehold.co/300x160"} alt="" style={{ width: 120, height: 82, objectFit: "cover", borderRadius: 10 }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="flex" style={{ gap: 8 }}><b>{p.name}</b><ListingStatus status={p.status} /></div>
                <div className="small muted">{p.area || ""} {p.city}, {p.state} · by <b>{p.ownerName}</b></div>
                <div className="small muted">From ₹{p.rent?.from?.toLocaleString("en-IN")}/mo · {p.gender} · {p.roomTypes?.join(", ")}</div>
                {p.rejectionReason && <div className="small" style={{ color: "var(--red)" }}>Rejection reason: {p.rejectionReason}</div>}
              </div>
              <div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>
                <Link to={`/admin/pg/${p.id}`} className="btn btn-outline btn-sm">View</Link>
                {p.status === "pending" && <>
                  <button className="btn btn-primary btn-sm" onClick={() => decide(p.id, "approve")}><Check size={13} /> Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setRejectTarget(p)}><X size={13} /> Reject</button>
                </>}
                {p.status === "approved" && <button className="btn btn-outline btn-sm" onClick={() => decide(p.id, "suspend")}><Ban size={13} /> Suspend</button>}
                {(p.status === "suspended" || p.status === "rejected") && <button className="btn btn-primary btn-sm" onClick={() => decide(p.id, "approve")}><Check size={13} /> Approve</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {rejectTarget && (
        <Modal open onClose={() => setRejectTarget(null)} title={`Reject "${rejectTarget.name}"`}
          footer={<><button className="btn btn-outline" onClick={() => setRejectTarget(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { decide(rejectTarget.id, "reject", rejectReason); setRejectTarget(null); setRejectReason(""); }}>Reject Listing</button></>}>
          <div className="field"><label>Reason (sent to owner)</label><input className="input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Photos don't match the property" /></div>
        </Modal>
      )}
    </div>
  );
}

export function AdminBookings() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("");
  const toast = useToast();
  const load = () => api.get("/admin/bookings", { params: filter ? { status: filter } : {} }).then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, [filter]);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  return (
    <div>
      <div className="dash-head"><h1>All Bookings</h1>
        <select className="select" style={{ width: 160 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {["pending", "confirmed", "active", "completed", "cancelled", "rejected"].map((s) => <option key={s}>{s}</option>)}
        </select></div>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Tenant</th><th>PG</th><th>Room</th><th>Move-in</th><th>Rent</th><th>Status</th></tr></thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id}>
              <td><b>{b.tenant?.name}</b></td><td>{b.pg?.name}</td>
              <td>{b.room?.number} · {b.room?.type}</td>
              <td>{fmtDate(b.moveInDate)}</td><td>{fmtINR(b.rent)}</td>
              <td><BookingStatus status={b.status} /></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}


export function AdminReviews() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const load = () => api.get("/admin/reviews").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  const del = async (id) => {
    try { await api.delete(`/reviews/${id}`); toast.success("Review removed"); load(); }
    catch (e) { toast.error("Could not remove", errMsg(e)); }
  };
  return (
    <div>
      <div className="dash-head"><h1>Reviews (moderation)</h1></div>
      {items.length === 0 ? <EmptyState title="No reviews" /> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Tenant</th><th>PG</th><th>Rating</th><th>Comment</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.tenantName}</td><td>{r.pgName}</td><td>⭐ {r.rating}/5</td>
                <td style={{ maxWidth: 320 }}>{r.comment || "—"}</td>
                <td className="small muted">{timeAgo(r.createdAt)}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => del(r.id)}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}


export function AdminReports() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const load = () => api.get("/reports").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  const resolve = async (id) => {
    try { await api.post(`/reports/${id}/resolve`, { resolution: "Reviewed by admin" }); toast.success("Report resolved"); load(); }
    catch (e) { toast.error("Could not resolve", errMsg(e)); }
  };
  return (
    <div>
      <div className="dash-head"><h1>Reports & Complaints</h1></div>
      {items.length === 0 ? <EmptyState title="No reports" message="User reports will appear here." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((r) => (
            <div key={r.id} className="card" style={{ padding: 16 }}>
              <div className="flex-between">
                <div className="flex" style={{ gap: 8 }}><b>{r.pgName}</b>
                  <span className="badge badge-red">{r.reason}</span>
                  {r.status === "open" ? <span className="badge badge-amber">Open</span> : <span className="badge badge-green">Resolved</span>}</div>
                <span className="small muted">by {r.reporter?.name} · {timeAgo(r.createdAt)}</span>
              </div>
              {r.details && <p className="small mt-8">{r.details}</p>}
              {r.status === "open" && <button className="btn btn-primary btn-sm mt-12" onClick={() => resolve(r.id)}><Check size={13} /> Resolve</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export function AdminAnnounce() {
  const toast = useToast();
  const [form, setForm] = useState({ title: "", body: "", role: "", link: "" });
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!form.title || !form.body) return toast.error("Title and body are required");
    setBusy(true);
    try {
      const r = await api.post("/notifications/announce", form);
      toast.success(`Announcement sent to ${r.data.data.sentTo} users`, "All recipients get a real-time notification.");
      setForm({ title: "", body: "", role: "", link: "" });
    } catch (e) { toast.error("Could not send", errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="dash-head"><h1>Platform Announcement</h1></div>
      <div className="card" style={{ padding: 24 }}>
        <div className="field"><label>Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. New season offers on Coimbatore PGs" /></div>
        <div className="field"><label>Message</label><textarea className="textarea" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the announcement…" /></div>
        <div className="grid-2">
          <div className="field"><label>Audience</label>
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="">Everyone</option><option value="tenant">Tenants only</option><option value="owner">Owners only</option>
            </select></div>
          <div className="field"><label>Link (optional)</label><input className="input" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/find" /></div>
        </div>
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={send}><Megaphone size={17} /> {busy ? "Sending…" : "Send Announcement"}</button>
      </div>
    </div>
  );
}


export function AdminAnalytics() {
  const [a, setA] = useState(null);
  useEffect(() => { api.get("/admin/analytics").then((r) => setA(r.data.data)).catch(() => {}); }, []);
  if (!a) return <div className="skel" style={{ height: 300 }} />;
  return (
    <div>
      <div className="dash-head"><h1>Platform Analytics</h1></div>
      <div className="grid-2">
        <div className="card" style={{ padding: 22 }}><h3 className="mb-16" style={{ fontSize: 16 }}>User Registrations</h3><LineChart data={a.userRegistrations} xKey="month" yKey="count" /></div>
        <div className="card" style={{ padding: 22 }}><h3 className="mb-16" style={{ fontSize: 16 }}>PG Listings</h3><LineChart data={a.pgListings} xKey="month" yKey="count" /></div>
        <div className="card" style={{ padding: 22 }}><h3 className="mb-16" style={{ fontSize: 16 }}>Bookings</h3><LineChart data={a.bookings} xKey="month" yKey="count" /></div>
        <div className="card" style={{ padding: 22 }}><h3 className="mb-16" style={{ fontSize: 16 }}>Popular Locations</h3><BarChart data={a.popularLocations} xKey="city" yKey="count" /></div>
        <div className="card" style={{ padding: 22 }}><h3 className="mb-16" style={{ fontSize: 16 }}>Popular Room Types</h3><BarChart data={a.popularRoomTypes} xKey="roomType" yKey="count" /></div>
        <div className="card" style={{ padding: 22 }}><h3 className="mb-16" style={{ fontSize: 16 }}>Popular Amenities</h3><BarChart data={a.popularAmenities} xKey="amenity" yKey="count" /></div>
      </div>
    </div>
  );
}


export function AdminCatalog() {
  const toast = useToast();
  const [amens, setAmens] = useState([]);
  const [newAmen, setNewAmen] = useState("");
  const load = () => api.get("/amenities").then((r) => setAmens(r.data.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!newAmen.trim()) return;
    try { await api.post("/amenities", { name: newAmen.trim() }); setNewAmen(""); toast.success("Amenity added"); load(); }
    catch (e) { toast.error("Could not add", errMsg(e)); }
  };
  const del = async (id) => {
    try { await api.delete(`/amenities/${id}`); toast.success("Amenity deleted"); load(); }
    catch (e) { toast.error("Could not delete", errMsg(e)); }
  };
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="dash-head"><h1>Amenities & Categories</h1></div>
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Manage Amenities</h3>
        <div className="flex mb-16">
          <input className="input" placeholder="New amenity name" value={newAmen} onChange={(e) => setNewAmen(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn btn-primary" onClick={add}>Add</button>
        </div>
        <div className="check-grid">
          {amens.map((a) => (
            <div key={a.id} className="chip-check" style={{ justifyContent: "space-between" }}>
              <span>{a.name}</span>
              <button className="btn-ghost" style={{ border: "none", color: "var(--red)" }} onClick={() => del(a.id)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function LineChart({ data = [], xKey, yKey }) {
  const [C, setC] = useState(null);
  useEffect(() => {
    import("recharts").then((m) => setC(() => (props) => (
      <m.ResponsiveContainer width="100%" height={230}>
        <m.LineChart data={props.data}>
          <m.XAxis dataKey={props.xKey} tick={{ fontSize: 11 }} />
          <m.YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
          <m.Tooltip />
          <m.Line type="monotone" dataKey={props.yKey} stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3 }} />
        </m.LineChart>
      </m.ResponsiveContainer>
    )));
  }, []);
  return <div style={{ height: 230 }}>{C ? <C data={data} xKey={xKey} yKey={yKey} /> : <div className="skel" style={{ height: 200 }} />}</div>;
}

function BarChart({ data = [], xKey, yKey }) {
  const [C, setC] = useState(null);
  useEffect(() => {
    import("recharts").then((m) => setC(() => (props) => (
      <m.ResponsiveContainer width="100%" height={230}>
        <m.BarChart data={props.data}>
          <m.XAxis dataKey={props.xKey} tick={{ fontSize: 11 }} />
          <m.YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
          <m.Tooltip />
          <m.Bar dataKey={props.yKey} fill="#0d9488" radius={[6, 6, 0, 0]} />
        </m.BarChart>
      </m.ResponsiveContainer>
    )));
  }, []);
  return <div style={{ height: 230 }}>{C ? <C data={data} xKey={xKey} yKey={yKey} /> : <div className="skel" style={{ height: 200 }} />}</div>;
}
