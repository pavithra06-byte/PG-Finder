import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Heart, CalendarCheck, CalendarClock, MessageSquare, Star, MapPin,
  BedDouble, Building2, Eye, Trash2, Send, Paperclip, CheckCheck,
} from "lucide-react";
import api, { errMsg } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { requestBrowserNotifications, useSocket } from "../../context/SocketContext.jsx";
import { useLocationCtx } from "../../context/LocationContext.jsx";
import Avatar from "../../components/Avatar.jsx";
import Stars from "../../components/Stars.jsx";
import { StatCard, BookingStatus, VisitStatus } from "../../components/StatusBadge.jsx";
import WelcomeBanner from "../../components/WelcomeBanner.jsx";
import LocationPicker from "../../components/LocationPicker.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Modal from "../../components/Modal.jsx";
import { fmtINR, fmtDate, timeAgo, ENQUIRY_TOPICS } from "../../utils/format.js";


export function TenantDashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [favs, bookings, visits, enquiries] = await Promise.all([
        api.get("/favorites"), api.get("/bookings"), api.get("/visits"),
        api.get("/enquiries"),
      ]);
      const b = bookings.data.data, v = visits.data.data, e = enquiries.data.data;
      const activeBooking = b.find((x) => ["pending", "confirmed", "active"].includes(x.status));
      const upcomingVisit = v.find((x) => ["pending", "accepted", "rescheduled"].includes(x.status));
      setStats({
        savedPGs: favs.data.data.length,
        activeBooking: activeBooking || null,
        upcomingVisit: upcomingVisit || null,
        pendingEnquiries: e.filter((x) => x.status === "open").length,
        bookings: b, visits: v, enquiries: e,
      });
      setRecent([...b.slice(0, 3), ...v.slice(0, 3), ...e.slice(0, 3)].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5));
    } catch (e2) {
      toast.error("Could not load dashboard", errMsg(e2));
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (!stats) return <div className="skel" style={{ height: 260 }} />;

  return (
    <div>
      <WelcomeBanner />
      <div className="stat-grid">
        <StatCard icon={<Heart size={20} />} label="Saved PGs" value={stats.savedPGs} />
        <StatCard icon={<BedDouble size={20} />} label="Booking" value={stats.activeBooking ? `#${stats.activeBooking.id.slice(-5)}` : "None"} color="#1d4ed8" bg="var(--blue-bg)" />
        <StatCard icon={<CalendarClock size={20} />} label="Upcoming Visit" value={stats.upcomingVisit ? fmtDate(stats.upcomingVisit.date) : "None"} color="#b45309" bg="var(--amber-bg)" />
        <StatCard icon={<MessageSquare size={20} />} label="Pending Enquiries" value={stats.pendingEnquiries} color="#b91c1c" bg="var(--red-bg)" />
      </div>

      {stats.activeBooking && (
        <div className="card mb-16" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div className="flex" style={{ gap: 12 }}>
            <div className="s-ic" style={{ background: "var(--blue-bg)", color: "#1d4ed8", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BedDouble size={20} />
            </div>
            <div>
              <b>{stats.activeBooking.pg?.name}</b>
              <div className="small muted">Room {stats.activeBooking.room?.number} · {stats.activeBooking.room?.type} · from {fmtDate(stats.activeBooking.moveInDate)}</div>
            </div>
          </div>
          <div className="flex"><BookingStatus status={stats.activeBooking.status} />
            <Link to="/tenant/bookings" className="btn btn-outline btn-sm">View</Link></div>
        </div>
      )}

      <h3 className="mb-16" style={{ fontSize: 17 }}>Recent Activity</h3>
      <div className="card" style={{ padding: 8 }}>
        {recent.length === 0 && <EmptyState title="No activity yet" message="Search PGs, book a room or send an enquiry to get started." />}
        {recent.map((x, i) => (
          <div key={i} className="flex" style={{ gap: 12, padding: "11px 12px", borderBottom: i < recent.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <Avatar name={x.pg?.name || x.tenant?.name} size={36} />
            <div style={{ flex: 1 }}>
              <div className="small"><b>{x.pg?.name || x.pgName || "PG"}</b> — {x.status || x.topic}</div>
              <div className="small muted">{x.message || x.question || x.roomType || ""}</div>
            </div>
            <span className="small muted">{timeAgo(x.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function useName() {
  const { user } = useAuth();
  return (user?.name || "").split(" ")[0];
}


export function FavoritesPage() {
  const [items, setItems] = useState(null);
  const load = () => api.get("/favorites").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  return (
    <div>
      <div className="dash-head"><h1>Favorites</h1></div>
      {items.length === 0 ? (
        <EmptyState title="No favorites yet" message="Tap the ♥ on any PG card to save it here for quick access." actions={[<Link key="f" to="/find" className="btn btn-primary">Find PGs</Link>]} />
      ) : (
        <div className="pg-grid">
          {items.map((pg) => (
            <div key={pg.id} className="card pg-card">
              <Link to={`/tenant/pg/${pg.id}`} className="img-wrap" style={{ display: "block", height: 170 }}>
                <img src={pg.images?.[0] || "https://placehold.co/600x400"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </Link>
              <div className="body">
                <div className="flex-between"><b>{pg.name}</b><span className="badge badge-gray">{fmtINR(pg.rent?.from)}/mo</span></div>
                <div className="loc-line"><MapPin size={13} /> {pg.area || pg.city}, {pg.city}</div>
                <div className="flex"><Stars value={pg.rating || 0} /><span className="small muted">{pg.rating || "New"} ({pg.reviewCount})</span></div>
                <div className="flex" style={{ gap: 8 }}>
                  <Link to={`/tenant/pg/${pg.id}`} className="btn btn-outline btn-sm" style={{ flex: 1 }}>View</Link>
                  <button className="btn btn-ghost btn-sm" onClick={async () => { await api.delete(`/favorites/${pg.id}`); load(); }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export function TenantBookings() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const toast = useToast();
  const load = () => {
    setError("");
    api.get("/bookings")
      .then((r) => setItems(Array.isArray(r.data.data) ? r.data.data : []))
      .catch((e) => { setItems([]); setError(errMsg(e, "Could not load your bookings.")); });
  };
  useEffect(() => { load(); }, []);
  if (!items) return <div className="skel" style={{ height: 200 }} />;

  const cancel = async (b) => {
    if (!window.confirm("Cancel this booking?")) return;
    try { await api.post(`/bookings/${b.id}/cancel`); toast.success("Booking cancelled"); load(); }
    catch (e) { toast.error("Could not cancel", errMsg(e)); }
  };

  return (
    <div>
      <div className="dash-head"><h1>My Bookings</h1></div>
      {error ? (
        <div className="card booking-error" role="alert">
          <b>Bookings could not be loaded</b>
          <span className="muted small">{error}</span>
          <button className="btn btn-primary btn-sm" onClick={load}>Try again</button>
        </div>
      ) : items.length === 0 ? <EmptyState title="No bookings yet" message="Book a room from any PG detail page — the owner will confirm in real time." actions={[<Link key="f" to="/find" className="btn btn-primary">Find a PG</Link>]} /> : (
        <div className="table-wrap tenant-bookings"><table className="tbl">
          <thead><tr><th>PG</th><th>Room</th><th>Move-in</th><th>Rent</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td><Link to={`/tenant/pg/${b.pgId}`}><b>{b.pg?.name}</b></Link></td>
                <td>{b.room?.number} · {b.room?.type}</td>
                <td>{fmtDate(b.moveInDate)}<div className="small muted">{b.durationMonths} mo</div></td>
                <td>{fmtINR(b.rent)}</td>
                <td><BookingStatus status={b.status} /></td>
                <td className="acts">
                  {["pending", "confirmed"].includes(b.status) && (
                    <button className="btn btn-danger btn-sm" onClick={() => cancel(b)}>Cancel</button>
                  )}
                  <Link to={`/tenant/pg/${b.pgId}`} className="btn btn-outline btn-sm">View PG</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}


export function TenantVisits() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const load = () => api.get("/visits").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  const cancel = async (v) => {
    try { await api.post(`/visits/${v.id}/cancel`); toast.success("Visit cancelled"); load(); }
    catch (e) { toast.error("Could not cancel", errMsg(e)); }
  };
  return (
    <div>
      <div className="dash-head"><h1>Visit Requests</h1></div>
      {items.length === 0 ? <EmptyState title="No visit requests" message="Request a site visit from any PG page — owners respond in real time." /> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>PG</th><th>Date & Time</th><th>Visitors</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <td><Link to={`/tenant/pg/${v.pgId}`}><b>{v.pg?.name}</b></Link></td>
                <td>{fmtDate(v.date)} · {v.time}</td>
                <td>{v.visitors}</td>
                <td><VisitStatus status={v.status} /></td>
                <td className="acts">
                  {["pending", "accepted", "rescheduled"].includes(v.status) && <button className="btn btn-danger btn-sm" onClick={() => cancel(v)}>Cancel</button>}
                  <Link to={`/tenant/pg/${v.pgId}`} className="btn btn-outline btn-sm">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}


export function TenantEnquiries() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const { lastEvent } = useSocket();
  const load = () => api.get("/enquiries").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (lastEvent?.event === "enquiry:new" || lastEvent?.event === "enquiry:reply") load();
  }, [lastEvent]);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  const del = async (id) => {
    try { await api.delete(`/enquiries/${id}`); toast.success("Enquiry deleted"); load(); }
    catch (e) { toast.error("Could not delete", errMsg(e)); }
  };
  return (
    <div>
      <div className="dash-head"><h1>Enquiries</h1><button className="btn btn-outline btn-sm" onClick={load}>Refresh</button></div>
      {items.length === 0 ? <EmptyState title="No enquiries" message="Ask owners about availability, rent, food and more." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((e) => (
            <div key={e.id} className="card" style={{ padding: 18 }}>
              <div className="flex-between">
                <div className="flex" style={{ gap: 8 }}><b>{e.pg?.name}</b><span className="badge badge-gray">{e.topic}</span>
                  {e.status === "open" ? <span className="badge badge-amber">Awaiting reply</span> : <span className="badge badge-green">Answered</span>}</div>
                <span className="small muted">{timeAgo(e.createdAt)}</span>
              </div>
              <p className="small mt-8" style={{ color: "var(--ink-2)" }}>{e.question}</p>
              {e.answer ? (
                <div className="card mt-12" style={{ padding: 12, background: "var(--green-bg)", border: "none" }}>
                  <b className="small">Owner's reply</b>
                  <p className="small mt-8">{e.answer}</p>
                </div>
              ) : <p className="small muted mt-12">The owner hasn't replied yet.</p>}
              <div className="flex mt-12"><Link to={`/tenant/pg/${e.pgId}`} className="btn btn-outline btn-sm">View PG</Link>
                <button className="btn btn-ghost btn-sm" onClick={() => del(e.id)}><Trash2 size={13} /> Delete</button></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export function TenantReviews() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const load = () => api.get("/reviews").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  const del = async (id) => {
    try { await api.delete(`/reviews/${id}`); toast.success("Review deleted"); load(); }
    catch (e) { toast.error("Could not delete", errMsg(e)); }
  };
  return (
    <div>
      <div className="dash-head"><h1>My Reviews</h1></div>
      {items.length === 0 ? <EmptyState title="No reviews yet" message="After a completed stay you can review the PG." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((r) => (
            <div key={r.id} className="card" style={{ padding: 18 }}>
              <div className="flex-between">
                <div className="flex" style={{ gap: 8 }}><b>{r.pgName}</b><Stars value={r.rating} /></div>
                <div className="flex"><span className="small muted">{timeAgo(r.createdAt)}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => del(r.id)}><Trash2 size={13} /></button></div>
              </div>
              {r.comment && <p className="small mt-8">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



export function ProfilePage() {
  const { user, updateUser, refreshUser } = useAuth();
  const toast = useToast();
  const isTenant = user?.role === "tenant";
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "", city: user?.city || "", bio: user?.bio || "", gender: user?.gender || "" });
  const [homeLoc, setHomeLoc] = useState(user?.homeLocation || null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...form };
      if (isTenant) { body.homeLocation = homeLoc; }
      const r = await api.put("/users/me", body);
      updateUser(r.data.data);
      toast.success("Profile updated");
      if (isTenant) toast.success("Home area saved", homeLoc ? homeLoc.label || "Saved area" : undefined);
    } catch (e) { toast.error("Update failed", errMsg(e)); } finally { setBusy(false); }
  };
  const uploadPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("photo", f);
    try {
      const r = await api.post("/users/me/photo", fd);
      await refreshUser();
      toast.success("Photo updated");
    } catch (err) { toast.error("Upload failed", errMsg(err)); }
  };

  return (
    <div className={`profile-layout ${isTenant ? "profile-layout-tenant" : ""}`}>
      <div className="dash-head"><h1>Profile</h1></div>
      <div className="card profile-form-card" style={{ padding: 24 }}>
        <div className="flex mb-24" style={{ gap: 16 }}>
          <Avatar name={user?.name} src={user?.avatar} size={72} />
          <div>
            <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>Change Photo
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={uploadPhoto} />
            </label>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label>Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="field"><label>City</label>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="field"><label>Gender</label>
            <select className="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Prefer not to say</option><option>Male</option><option>Female</option><option>Other</option>
            </select></div>
        </div>
        <div className="field"><label>Bio</label>
          <textarea className="textarea" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Tell us a little about yourself" /></div>
        {isTenant && <div className="field"><label>Home area</label>
          <LocationPicker value={homeLoc} onSelect={setHomeLoc} />
        </div>}
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Profile"}</button>
      </div>
    </div>
  );
}

export function PreferencesPage() {
  const toast = useToast();
  const [prefs, setPrefs] = useState(null);
  useEffect(() => { api.get("/users/preferences").then((r) => setPrefs(r.data.data || {})).catch(() => setPrefs({})); }, []);
  const save = async () => {
    try { await api.put("/users/preferences", prefs); toast.success("Preferences saved", "We'll use these for recommendations."); }
    catch (e) { toast.error("Could not save", errMsg(e)); }
  };
  if (!prefs) return <div className="skel" style={{ height: 200 }} />;
  const set = (k, v) => setPrefs({ ...prefs, [k]: v });
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="dash-head"><h1>Preferences</h1></div>
      <div className="card" style={{ padding: 24 }}>
        <div className="field"><label>Preferred location</label>
          <input className="input" value={prefs.preferredLocation || ""} onChange={(e) => set("preferredLocation", e.target.value)} placeholder="e.g. Anna Nagar, Chennai" /></div>
        <div className="grid-2">
          <div className="field"><label>Max rent (₹/month)</label>
            <input className="input" type="number" value={prefs.maxRent || ""} onChange={(e) => set("maxRent", Number(e.target.value) || "")} /></div>
          <div className="field"><label>Room type</label>
            <select className="select" value={prefs.roomType || ""} onChange={(e) => set("roomType", e.target.value)}>
              <option value="">Any</option><option>Single</option><option>Double Sharing</option><option>Triple Sharing</option><option>Four Sharing</option>
            </select></div>
          <div className="field"><label>Food required?</label>
            <select className="select" value={prefs.foodRequired ? "yes" : "no"} onChange={(e) => set("foodRequired", e.target.value === "yes")}>
              <option value="no">No</option><option value="yes">Yes</option></select></div>
          <div className="field"><label>AC required?</label>
            <select className="select" value={prefs.acRequired ? "yes" : "no"} onChange={(e) => set("acRequired", e.target.value === "yes")}>
              <option value="no">No</option><option value="yes">Yes</option></select></div>
          <div className="field"><label>Gender preference</label>
            <select className="select" value={prefs.genderPreference || ""} onChange={(e) => set("genderPreference", e.target.value)}>
              <option value="">Any</option><option>Male</option><option>Female</option><option>Unisex</option></select></div>
          <div className="field"><label>Move-in date</label>
            <input className="input" type="date" value={prefs.moveInDate || ""} onChange={(e) => set("moveInDate", e.target.value)} /></div>
        </div>
        <div className="field"><label>Preferred amenities</label>
          <div className="check-grid">
            {["Wi-Fi", "Food", "AC", "Laundry", "Housekeeping", "Gym", "Hot Water", "Kitchen"].map((a) => (
              <label key={a} className={`chip-check ${(prefs.amenities || []).includes(a) ? "active" : ""}`}>
                <input type="checkbox" checked={(prefs.amenities || []).includes(a)}
                  onChange={() => set("amenities", (prefs.amenities || []).includes(a) ? prefs.amenities.filter((x) => x !== a) : [...(prefs.amenities || []), a])} />{a}
              </label>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={save}>Save Preferences</button>
      </div>
    </div>
  );
}


export function SettingsPage() {
  const toast = useToast();
  const [pw, setPw] = useState({ oldPassword: "", newPassword: "" });
  const [notif, setNotif] = useState({ bookingUpdates: true, messages: true, enquiries: true, announcements: true });
  useEffect(() => { api.get("/users/preferences").then(() => {}).catch(() => {}); }, []);
  const changePw = async () => {
    if (!pw.oldPassword || pw.newPassword.length < 6) return toast.error("Enter current + new password (min 6 chars)");
    try { await api.put("/users/password", pw); toast.success("Password changed"); setPw({ oldPassword: "", newPassword: "" }); }
    catch (e) { toast.error("Could not change", errMsg(e)); }
  };
  const saveNotif = async () => {
    try { await api.put("/users/settings/notifications", notif); toast.success("Notification settings saved"); }
    catch (e) { toast.error("Could not save", errMsg(e)); }
  };
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="dash-head"><h1>Settings</h1></div>
      <div className="card" style={{ padding: 24, marginBottom: 18 }}>
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Notification Preferences</h3>
        {Object.entries(notif).map(([k, v]) => (
          <label key={k} className="chip-check mb-8" style={{ width: "100%" }}>
            <input type="checkbox" checked={v} onChange={() => setNotif({ ...notif, [k]: !v })} />
            {k.replace(/([A-Z])/g, " $1")}
          </label>
        ))}
        <button className="btn btn-primary btn-sm mt-8" onClick={saveNotif}>Save</button>
      </div>
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Change Password</h3>
        <div className="field"><label>Current password</label><input className="input" type="password" value={pw.oldPassword} onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })} /></div>
        <div className="field"><label>New password</label><input className="input" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></div>
        <button className="btn btn-primary" onClick={changePw}>Update Password</button>
      </div>
    </div>
  );
}


export function MessagesPage({ role }) {
  const { user } = useAuth();
  const toast = useToast();
  const { socket, refreshCounts } = useSocket();
  const location = useLocation();
  const [convs, setConvs] = useState(null);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState({});
  const [online, setOnline] = useState({});
  const [browserPermission, setBrowserPermission] = useState(() => (
    "Notification" in window ? Notification.permission : "unsupported"
  ));

  const loadConvs = () => api.get("/messages/conversations").then((r) => setConvs(r.data.data)).catch(() => setConvs([]));
  useEffect(() => { loadConvs(); }, []);
  useEffect(() => {
    if (location.state?.openConv) {
      const c = convs?.find((x) => x.id === location.state.openConv);
      if (c) openConv(c); else loadConvs().then(() => setActive(location.state.openConv));
    }
  }, [location.state?.openConv, convs]);

  useEffect(() => {
    if (!socket) return undefined;
    const hNew = (d) => { loadConvs(); if (!active || active !== d.conversationId) setActive(d.conversationId); };
    const hRecv = (d) => { if (d.conversationId === active) { setMsgs((m) => [...m, d.message]); markRead(d.conversationId); } };
    const hTyping = (d) => { if (d.conversationId === active) setTyping({ [d.userId]: d.typing }); };
    const hRead = (d) => { if (d.conversationId === active) setMsgs((m) => m.map((x) => ({ ...x, readBy: [...(x.readBy || []), d.userId] }))); };
    const hOnline = (d) => setOnline((o) => ({ ...o, [d.userId]: d.online }));
    socket.on("message:new", hNew);
    socket.on("message:receive", hRecv);
    socket.on("message:typing", hTyping);
    socket.on("message:read", hRead);
    socket.on("user:online", hOnline);
    socket.on("user:offline", hOnline);
    return () => {
      socket.off("message:new", hNew);
      socket.off("message:receive", hRecv);
      socket.off("message:typing", hTyping);
      socket.off("message:read", hRead);
      socket.off("user:online", hOnline);
      socket.off("user:offline", hOnline);
    };
  }, [socket, active, convs]);

  const openConv = async (c) => {
    setActive(c.id);
    socket?.emit("join:conversation", { conversationId: c.id });
    const r = await api.get(`/messages/conversations/${c.id}/messages`);
    setMsgs(r.data.data.messages);
    setOnline((o) => ({ ...o, [c.other.id]: true }));
    setMsgBadgeLocal(c.id);
    socket?.emit("message:read", { conversationId: c.id });
  };

  const setMsgBadgeLocal = (convId) => {
    setConvs((cs) => cs.map((c) => (c.id === convId ? { ...c, unread: 0 } : c)));
    refreshCounts();
  };

  const markRead = (convId) => { socket?.emit("message:read", { conversationId: convId }); };

  const send = async () => {
    if (!text.trim() || !active) return;
    const t = text.trim();
    setText("");
    try {
      const r = await api.post(`/messages/conversations/${active}/send`, { text: t });
      setMsgs((m) => [...m, r.data.data.message]);
      setConvs((cs) => cs.map((c) => (c.id === active ? { ...c, lastMessage: t, lastMessageAt: new Date().toISOString() } : c)));
    } catch (e) { toast.error("Could not send", errMsg(e)); }
  };

  if (!convs) return <div className="skel" style={{ height: 300 }} />;

  return (
    <div>
      <div className="dash-head">
        <h1>Messages</h1>
        {browserPermission === "default" && (
          <button className="btn btn-outline btn-sm" onClick={async () => setBrowserPermission(await requestBrowserNotifications())}>
            Enable browser alerts
          </button>
        )}
      </div>
      <div className="chat-wrap">
        <div className="chat-list">
          {convs.length === 0 && <div style={{ padding: 20 }}><EmptyState title="No conversations" message="Chat with PG owners from any listing page." /></div>}
          {convs.map((c) => (
            <div key={c.id} className={`chat-item ${active === c.id ? "active" : ""}`} onClick={() => openConv(c)}>
              <Avatar name={c.other?.name} src={c.other?.avatar} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="c-name"><span>{c.other?.name}</span>
                  {c.unread > 0 ? <span className="badge badge-red">{c.unread}</span> : <span className="small muted">{timeAgo(c.lastMessageAt)}</span>}</div>
                <div className="c-prev">{c.lastMessage || "Start chatting…"}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="chat-main">
          {!active ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--ink-4)" }}>
              Select a conversation to start chatting
            </div>
          ) : (
            <>
              <div className="chat-head">
                <Avatar name={convs.find((c) => c.id === active)?.other?.name} size={38} />
                <div>
                  <b>{convs.find((c) => c.id === active)?.other?.name}</b>
                  <div className="small muted">{online[convs.find((c) => c.id === active)?.other?.id] ? <span className="online-dot" /> : <span className="offline-dot" />} {online[convs.find((c) => c.id === active)?.other?.id] ? "Online" : "Offline"}</div>
                </div>
              </div>
              <div className="chat-msgs" ref={(el) => el && el.scrollTo({ top: el.scrollHeight })}>
                {msgs.length === 0 && <div className="small muted" style={{ textAlign: "center", marginTop: 40 }}>No messages yet — say hello! 👋</div>}
                {msgs.map((m) => (
                  <div key={m.id} className={`msg ${m.senderId === user?.id ? "mine" : "theirs"}`}>
                    {m.text}
                    <div className="m-time">{timeAgo(m.createdAt)}{m.senderId === user?.id && (m.readBy || []).length > 1 && <CheckCheck size={12} style={{ marginLeft: 3, verticalAlign: -2 }} />}</div>
                  </div>
                ))}
                {Object.values(typing)[0] && <div className="typing"><span className="online-dot" /> typing…</div>}
              </div>
              <div className="chat-input">
                <input
                  className="input"
                  placeholder="Type a message…"
                  value={text}
                  onChange={(e) => { setText(e.target.value); socket?.emit("message:typing", { conversationId: active, typing: e.target.value.length > 0 }); }}
                  onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                />
                <button className="btn btn-primary" onClick={send} disabled={!text.trim()}><Send size={16} /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
