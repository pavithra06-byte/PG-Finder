import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Building2, BedDouble, ClipboardList, MessageSquare, Star, PlusCircle,
  ImagePlus, Trash2, Eye, Pencil, MapPin, Upload, X, CalendarClock, BarChart3,
} from "lucide-react";
import api, { errMsg } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import { StatCard, BookingStatus, VisitStatus, ListingStatus, VerificationStatus } from "../../components/StatusBadge.jsx";
import WelcomeBanner from "../../components/WelcomeBanner.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Modal from "../../components/Modal.jsx";
import LocationPicker from "../../components/LocationPicker.jsx";
import { SkeletonLines } from "../../components/Skeleton.jsx";
import { fmtINR, fmtDate, timeAgo, ROOM_TYPES, GENDERS, AMENITIES } from "../../utils/format.js";

const HOUSE_RULES = [
  ["entryExit", "Entry / exit timings"],
  ["visitorPolicy", "Visitor policy"],
  ["smoking", "Smoking policy"],
  ["alcohol", "Alcohol policy"],
  ["pets", "Pet policy"],
  ["foodRules", "Food rules"],
  ["noise", "Noise / quiet hours"],
  ["noticePeriod", "Notice period"],
  ["other", "Other rules"],
];

export function OwnerDashboard() {
  const [stats, setStats] = useState(null);
  const toast = useToast();
  const load = () => api.get("/owners/dashboard").then((r) => setStats(r.data.data)).catch((e) => toast.error("Could not load", errMsg(e)));
  useEffect(() => { load(); }, []);
  if (!stats) return <div className="skel" style={{ height: 260 }} />;

  return (
    <div>
      <WelcomeBanner extra={<VerificationStatus status={stats.verificationStatus} />} />
      {stats.verificationStatus !== "approved" && (
        <div className="card mb-16" style={{ padding: 16, background: "var(--amber-bg)", border: "none" }}>
          <b style={{ color: "#b45309" }}>⏳ Your account is pending admin verification.</b>
          <p className="small" style={{ color: "#92400e" }}>You'll be able to publish listings once an admin verifies you. Meanwhile you can prepare your properties.</p>
        </div>
      )}
      <div className="stat-grid">
        <StatCard icon={<Building2 size={20} />} label="Total PGs" value={stats.totalPGs} />
        <StatCard icon={<BedDouble size={20} />} label="Available Rooms" value={stats.availableRooms} color="#1d4ed8" bg="var(--blue-bg)" />
        <StatCard icon={<BedDouble size={20} />} label="Occupied Beds" value={stats.occupiedBeds} color="#b45309" bg="var(--amber-bg)" />
        <StatCard icon={<ClipboardList size={20} />} label="Pending Bookings" value={stats.pendingBookings} color="#b91c1c" bg="var(--red-bg)" />
        <StatCard icon={<MessageSquare size={20} />} label="New Enquiries" value={stats.newEnquiries} />
        <StatCard icon={<CalendarClock size={20} />} label="Pending Visits" value={stats.pendingVisits} color="#1d4ed8" bg="var(--blue-bg)" />
        <StatCard icon={<Star size={20} />} label="Avg Rating" value={stats.avgRating || "—"} color="#b45309" bg="var(--amber-bg)" />
        <StatCard icon={<MessageSquare size={20} />} label="Unread Messages" value={stats.unreadMessages} color="#b91c1c" bg="var(--red-bg)" />
      </div>
      <div className="grid-2">
        <Link to="/owner/bookings" className="card" style={{ padding: 20, color: "inherit" }}>
          <h3 style={{ fontSize: 16 }}>Bookings <span className="muted small">({stats.totalBookings})</span></h3>
          <p className="small muted mt-8">Active: {stats.activeBookings} · Pending: {stats.pendingBookings}</p>
        </Link>
        <Link to="/owner/analytics" className="card" style={{ padding: 20, color: "inherit" }}>
          <h3 style={{ fontSize: 16 }}>Analytics</h3>
          <p className="small muted mt-8">Bookings by month, room-type demand, rating breakdown & more.</p>
        </Link>
      </div>
    </div>
  );
}


export function OwnerPGList() {
  const { user } = useAuth();
  const toast = useToast();
  const [pgs, setPgs] = useState(null);
  const load = () => api.get("/pgs", { params: { ownerId: user?.id, per_page: 50, all: 1 } }).then((r) => setPgs(r.data.data.items)).catch(() => setPgs([]));
  useEffect(() => { load(); }, [user]);
  if (!pgs) return <div className="skel" style={{ height: 200 }} />;
  return (
    <div>
      <div className="dash-head"><h1>My PGs</h1><Link to="/owner/pgs/new" className="btn btn-primary"><PlusCircle size={16} /> Add PG</Link></div>
      {pgs.length === 0 ? <EmptyState title="No PGs yet" message="Add your first property — it will go live after admin approval." actions={[<Link key="n" to="/owner/pgs/new" className="btn btn-primary">Add PG</Link>]} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {pgs.map((p) => (
            <div key={p.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <img src={p.images?.[0] || "https://placehold.co/400x200"} alt="" style={{ width: 130, height: 90, objectFit: "cover", borderRadius: 10 }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="flex" style={{ gap: 8 }}><b style={{ fontSize: 16 }}>{p.name}</b><ListingStatus status={p.status} /></div>
                <div className="small muted mt-8"><MapPin size={12} /> {p.area || ""} {p.city}, {p.state}</div>
                <div className="small muted">From {fmtINR(p.rent?.from)}/mo · {p.availableRooms ?? 0} rooms free · ⭐ {p.rating?.average || "New"} ({p.rating?.count})</div>
              </div>
              <div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>
                <Link to={`/owner/pg/${p.id}`} className="btn btn-outline btn-sm"><Eye size={14} /> View</Link>
                <Link to={`/owner/pgs/${p.id}/edit`} className="btn btn-outline btn-sm"><Pencil size={14} /> Edit</Link>
                <Link to={`/owner/pgs/${p.id}/rooms`} className="btn btn-outline btn-sm"><BedDouble size={14} /> Rooms</Link>
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  try { const r = await api.post(`/pgs/${p.id}/publish`); toast.success(r.data.message || "Listing updated"); load(); }
                  catch (e) { toast.error("Action failed", errMsg(e)); }
                }}>
                  {p.status === "approved" ? "Unpublish" : "Submit"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PGFormPage({ editId }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!editId);
  const [form, setForm] = useState({
    name: "", description: "", address: "", area: "", district: "", city: "", state: "Tamil Nadu",
    pincode: "", location: null, rentFrom: "", rentTo: "", deposit: "", maintenance: "",
    foodCharges: "", gender: "Unisex", roomTypes: [], amenities: [], foodInfo: "",
    rules: {}, availableNow: true, furnished: true, images: [],
  });

  useEffect(() => {
    if (editId) {
      api.get(`/pgs/${editId}`).then((r) => {
        const d = r.data.data;
        setForm({
          ...form, name: d.name, description: d.description, address: d.address, area: d.area,
          district: d.district || "", city: d.city, state: d.state, pincode: d.pincode,
          location: d.location ? { lat: d.location[1], lng: d.location[0], label: `${d.area || ""}, ${d.city}` } : null,
          rentFrom: d.rent?.from || "", rentTo: d.rent?.to || "", deposit: d.deposit || "",
          maintenance: d.maintenance || "", foodCharges: d.foodCharges || "", gender: d.gender || "Unisex",
          roomTypes: d.roomTypes || [], amenities: d.amenities || [], foodInfo: d.foodInfo || "",
          rules: d.rules || {}, availableNow: d.availableNow, furnished: d.furnished, images: d.images || [],
        });
        setLoading(false);
      }).catch((e) => { toast.error("Could not load PG", errMsg(e)); navigate("/owner/pgs"); });
    }
  }, [editId]);

  const toggle = (arr, v) => setForm({ ...form, [arr]: form[arr].includes(v) ? form[arr].filter((x) => x !== v) : [...form[arr], v] });
  const setRule = (key, value) => setForm({ ...form, rules: { ...form.rules, [key]: value } });
  const [uploading, setUploading] = useState(false);

  const uploadImages = async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    setUploading(true);
    try {
      if (editId) {
        const fd = new FormData();
        files.forEach((f) => fd.append("images", f));
        const r = await api.post(`/pgs/${editId}/images`, fd);
        setForm({ ...form, images: r.data.data.images });
      } else {
        const urls = await Promise.all(files.map((f) => new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(f);
        })));
        setForm({ ...form, images: [...form.images, ...urls].slice(0, 15) });
      }
      toast.success(`${files.length} image(s) added`);
    } catch (err) { toast.error("Upload failed", errMsg(err)); } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!form.name || !form.city || !form.state || !form.address) return toast.error("Name, address, city and state are required");
    if (!form.location) return toast.error("Set the PG location (search or pick on map)");
    if (!form.rentFrom) return toast.error("Starting rent is required");
    if (!form.roomTypes.length) return toast.error("Select at least one room type");
    const payload = {
      name: form.name, description: form.description, address: form.address, area: form.area,
      district: form.district, city: form.city, state: form.state, pincode: form.pincode,
      location: { coordinates: [form.location.lng, form.location.lat] },
      rent: { from: Number(form.rentFrom), to: Number(form.rentTo) || Number(form.rentFrom) },
      deposit: Number(form.deposit) || 0, maintenance: Number(form.maintenance) || 0,
      foodCharges: Number(form.foodCharges) || 0, gender: form.gender, roomTypes: form.roomTypes,
      amenities: form.amenities, foodInfo: form.foodInfo, rules: form.rules, images: form.images,
      availableNow: form.availableNow, furnished: form.furnished,
    };
    try {
      if (editId) { await api.put(`/pgs/${editId}`, payload); toast.success("PG updated", "Changes saved."); }
      else { await api.post("/pgs", payload); toast.success("PG submitted!", "It will go live after admin approval."); }
      navigate("/owner/pgs");
    } catch (e) { toast.error("Could not save PG", errMsg(e)); }
  };

  if (loading) return <div className="skel" style={{ height: 300 }} />;

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="dash-head"><h1>{editId ? "Edit PG" : "Add New PG"}</h1>
        <button className="btn btn-primary" onClick={submit}>Save PG</button></div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h3 className="mb-16" style={{ fontSize: 16 }}>Basic Details</h3>
        <div className="grid-2">
          <div className="field"><label>PG name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sri Balaji PG" /></div>
          <div className="field"><label>Area / Locality</label><input className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Anna Nagar" /></div>
          <div className="field"><label>District</label><input className="input" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="e.g. Chennai" /></div>
          <div className="field"><label>City *</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Chennai" /></div>
          <div className="field"><label>State *</label>
            <select className="select" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
              {["Tamil Nadu", "Karnataka", "Telangana", "Delhi", "Maharashtra", "Kerala", "Andhra Pradesh", "Other"].map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div className="field"><label>Pincode</label><input className="input" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></div>
          <div className="field"><label>Gender preference</label>
            <select className="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              {GENDERS.map((g) => <option key={g}>{g}</option>)}
            </select></div>
        </div>
        <div className="field"><label>Full address *</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, area, city" /></div>
        <div className="field"><label>Description</label>
          <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your PG…" /></div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h3 className="mb-16" style={{ fontSize: 16 }}>📍 Location <span className="small muted">(used for geospatial search)</span></h3>
        <LocationPicker value={form.location} onSelect={(l) => setForm({ ...form, location: l })} />
        {form.location && <p className="hint">Coordinates: {form.location.lat.toFixed(5)}, {form.location.lng.toFixed(5)}</p>}
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h3 className="mb-16" style={{ fontSize: 16 }}>Pricing</h3>
        <div className="grid-2">
          <div className="field"><label>Starting rent (₹/mo) *</label><input className="input" type="number" value={form.rentFrom} onChange={(e) => setForm({ ...form, rentFrom: e.target.value })} /></div>
          <div className="field"><label>Max rent (₹/mo)</label><input className="input" type="number" value={form.rentTo} onChange={(e) => setForm({ ...form, rentTo: e.target.value })} /></div>
          <div className="field"><label>Deposit (₹)</label><input className="input" type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></div>
          <div className="field"><label>Maintenance (₹/mo)</label><input className="input" type="number" value={form.maintenance} onChange={(e) => setForm({ ...form, maintenance: e.target.value })} /></div>
          <div className="field"><label>Food charges (₹/mo)</label><input className="input" type="number" value={form.foodCharges} onChange={(e) => setForm({ ...form, foodCharges: e.target.value })} /></div>
        </div>
        <div className="field"><label>Food info</label>
          <textarea className="textarea" rows={2} value={form.foodInfo} onChange={(e) => setForm({ ...form, foodInfo: e.target.value })} placeholder="Meal plans, veg/non-veg, timings…" /></div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h3 className="mb-16" style={{ fontSize: 16 }}>Room Types & Amenities</h3>
        <div className="check-grid mb-16">
          {ROOM_TYPES.map((r) => (
            <label key={r} className={`chip-check ${form.roomTypes.includes(r) ? "active" : ""}`}>
              <input type="checkbox" checked={form.roomTypes.includes(r)} onChange={() => toggle("roomTypes", r)} />{r}
            </label>
          ))}
        </div>
        <div className="check-grid">
          {AMENITIES.map((a) => (
            <label key={a} className={`chip-check ${form.amenities.includes(a) ? "active" : ""}`}>
              <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggle("amenities", a)} />{a}
            </label>
          ))}
        </div>
        <div className="flex mt-16" style={{ gap: 14 }}>
          <label className={`chip-check ${form.availableNow ? "active" : ""}`}>
            <input type="checkbox" checked={form.availableNow} onChange={() => setForm({ ...form, availableNow: !form.availableNow })} />Available now
          </label>
          <label className={`chip-check ${form.furnished ? "active" : ""}`}>
            <input type="checkbox" checked={form.furnished} onChange={() => setForm({ ...form, furnished: !form.furnished })} />Furnished
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h3 className="mb-16" style={{ fontSize: 16 }}>House Rules</h3>
        <div className="grid-2">
          {HOUSE_RULES.map(([key, label]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input className="input" value={form.rules[key] || ""} onChange={(e) => setRule(key, e.target.value)} placeholder={`Enter ${label.toLowerCase()}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h3 className="mb-16" style={{ fontSize: 16 }}>Photos <span className="small muted">(exterior, rooms, kitchen, common areas…)</span></h3>
        <div className="flex" style={{ gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {form.images.map((img, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={img} alt="" style={{ width: 110, height: 80, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
              <button className="icon-btn" style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, background: "rgba(255,255,255,.9)" }}
                onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })}><X size={12} /></button>
            </div>
          ))}
          <label className="btn btn-outline" style={{ cursor: "pointer", height: 80, width: 110, display: "flex", flexDirection: "column", gap: 4 }}>
            <ImagePlus size={20} /> {uploading ? "Uploading…" : "Add"}
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={uploadImages} />
          </label>
        </div>
      </div>
    </div>
  );
}

export function RoomsPage() {
  const { pgId } = useParams();
  const toast = useToast();
  const [pg, setPg] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [modal, setModal] = useState(null);
  const load = () => {
    api.get(`/pgs/${pgId}`).then((r) => setPg(r.data.data)).catch(() => {});
    api.get("/rooms", { params: { pgId } }).then((r) => setRooms(r.data.data)).catch(() => setRooms([]));
  };
  useEffect(() => { load(); }, [pgId]);

  if (!rooms || !pg) return <div className="skel" style={{ height: 200 }} />;
  return (
    <div>
      <div className="dash-head"><h1>Rooms — {pg.name}</h1>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "new" })}><PlusCircle size={16} /> Add Room</button></div>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Room</th><th>Type</th><th>Capacity</th><th>Occupied</th><th>Available</th><th>Rent</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.id}>
              <td><b>{r.number}</b></td><td>{r.type}</td><td>{r.capacity}</td><td>{r.occupiedBeds}</td>
              <td className={r.availableBeds === 0 ? "muted" : "bold"}>{r.availableBeds}</td>
              <td>{fmtINR(r.rent)}</td>
              <td>{r.status === "available" ? <span className="badge badge-green">Available</span> : r.status === "almost_full" ? <span className="badge badge-amber">Almost Full</span> : r.status === "maintenance" ? <span className="badge badge-red">Maintenance</span> : <span className="badge badge-gray">Full</span>}</td>
              <td className="acts"><button className="btn btn-outline btn-sm" onClick={() => setModal({ mode: "edit", room: r })}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={async () => {
                  if (!window.confirm("Delete this room?")) return;
                  try { await api.delete(`/rooms/${r.id}`); toast.success("Room deleted"); load(); }
                  catch (e) { toast.error("Could not delete", errMsg(e)); }
                }}><Trash2 size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="hint mt-12">Availability is connected to bookings — beds free up automatically when bookings are rejected or cancelled.</p>
      {modal && <RoomModal pgId={pgId} room={modal.room} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}

function RoomModal({ pgId, room, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({
    number: room?.number || "", type: room?.type || "Double Sharing", capacity: room?.capacity || 2,
    occupiedBeds: room?.occupiedBeds || 0, rent: room?.rent || "", deposit: room?.deposit || 0,
    facilities: room?.facilities || [], status: room?.status || "auto",
  });
  const submit = async () => {
    try {
      if (room) await api.put(`/rooms/${room.id}`, form);
      else await api.post("/rooms", { pgId, ...form });
      toast.success(room ? "Room updated" : "Room added");
      onDone();
    } catch (e) { toast.error("Could not save room", errMsg(e)); }
  };
  return (
    <Modal open onClose={onClose} title={room ? `Edit Room ${room.number}` : "Add Room"}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit}>Save Room</button></>}>
      <div className="grid-2">
        <div className="field"><label>Room number *</label><input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
        <div className="field"><label>Type *</label>
          <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select></div>
        <div className="field"><label>Capacity (beds) *</label><input className="input" type="number" min={1} max={8} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
        <div className="field"><label>Occupied beds</label><input className="input" type="number" min={0} max={form.capacity} value={form.occupiedBeds} onChange={(e) => setForm({ ...form, occupiedBeds: Number(e.target.value) })} /></div>
        <div className="field"><label>Rent (₹/mo) *</label><input className="input" type="number" value={form.rent} onChange={(e) => setForm({ ...form, rent: Number(e.target.value) })} /></div>
        <div className="field"><label>Deposit (₹)</label><input className="input" type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: Number(e.target.value) })} /></div>
      </div>
      <div className="field"><label>Status</label>
        <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="auto">Auto (from occupancy)</option>
          <option value="available">Available</option>
          <option value="almost_full">Almost Full</option>
          <option value="full">Full</option>
          <option value="maintenance">Maintenance</option>
        </select></div>
      <div className="field"><label>Room facilities</label>
        <div className="check-grid">
          {["AC", "Wi-Fi", "Furnished", "Attached Bathroom", "Balcony", "Study Table", "Geyser"].map((f) => (
            <label key={f} className={`chip-check ${form.facilities.includes(f) ? "active" : ""}`}>
              <input type="checkbox" checked={form.facilities.includes(f)}
                onChange={() => setForm({ ...form, facilities: form.facilities.includes(f) ? form.facilities.filter((x) => x !== f) : [...form.facilities, f] })} />{f}
            </label>
          ))}
        </div></div>
    </Modal>
  );
}


export function OwnerBookings() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const socket = useSocket();
  const load = () => api.get("/bookings").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => {
    load();
    const h = () => load();
    socket.on("booking:new", h);
    return () => {  };
  }, [socket]);
  if (!items) return <div className="skel" style={{ height: 200 }} />;

  const act = async (id, action, label) => {
    try { await api.post(`/bookings/${id}/${action}`); toast.success(label); load(); }
    catch (e) { toast.error("Action failed", errMsg(e)); }
  };

  return (
    <div>
      <div className="dash-head"><h1>Bookings</h1></div>
      {items.length === 0 ? <EmptyState title="No bookings yet" message="Tenants' booking requests will appear here instantly." /> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Tenant</th><th>PG / Room</th><th>Move-in</th><th>Rent</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td><div className="flex" style={{ gap: 8 }}><span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{b.tenant?.name?.[0]}</span><b>{b.tenant?.name}</b></div>
                  <div className="small muted">{b.tenant?.phone}</div></td>
                <td><b>{b.pg?.name}</b><div className="small muted">Room {b.room?.number} · {b.room?.type} · {b.occupants} occupant(s)</div></td>
                <td>{fmtDate(b.moveInDate)}<div className="small muted">{b.durationMonths} mo</div></td>
                <td>{fmtINR(b.rent)}</td>
                <td><BookingStatus status={b.status} /></td>
                <td className="acts">
                  {b.status === "pending" && <>
                    <button className="btn btn-primary btn-sm" onClick={() => act(b.id, "accept", "Booking accepted — tenant notified")}>Accept</button>
                    <button className="btn btn-danger btn-sm" onClick={() => act(b.id, "reject", "Booking rejected")}>Reject</button>
                  </>}
                  {b.status === "confirmed" && <button className="btn btn-outline btn-sm" onClick={() => act(b.id, "complete", "Booking completed")}>Mark Complete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}


export function OwnerVisits() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const socket = useSocket();
  const [resched, setResched] = useState(null);
  const load = () => api.get("/visits").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => {
    load();
    const h = () => load();
    socket.on("visit:new", h);
    return () => {  };
  }, [socket]);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  const act = async (id, action, label, payload) => {
    try { await api.post(`/visits/${id}/${action}`, payload || {}); toast.success(label); load(); }
    catch (e) { toast.error("Action failed", errMsg(e)); }
  };
  return (
    <div>
      <div className="dash-head"><h1>Visit Requests</h1></div>
      {items.length === 0 ? <EmptyState title="No visit requests" message="Tenants' visit requests will appear here in real time." /> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Tenant</th><th>PG</th><th>Date & Time</th><th>Visitors</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <td><b>{v.tenant?.name}</b><div className="small muted">{v.tenant?.phone}</div></td>
                <td>{v.pg?.name}</td>
                <td>{fmtDate(v.date)} · {v.time}</td>
                <td>{v.visitors}</td>
                <td><VisitStatus status={v.status} /></td>
                <td className="acts">
                  {v.status === "pending" && <>
                    <button className="btn btn-primary btn-sm" onClick={() => act(v.id, "accept", "Visit accepted — tenant notified")}>Accept</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setResched(v)}>Reschedule</button>
                    <button className="btn btn-danger btn-sm" onClick={() => act(v.id, "reject", "Visit rejected")}>Reject</button>
                  </>}
                  {v.status === "rescheduled" && <>
                    <button className="btn btn-primary btn-sm" onClick={() => act(v.id, "accept", "Visit accepted")}>Accept</button>
                    <button className="btn btn-danger btn-sm" onClick={() => act(v.id, "reject", "Visit rejected")}>Reject</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {resched && (
        <RescheduleModal visit={resched} onClose={() => setResched(null)} onDone={(payload) => { act(resched.id, "reschedule", "Visit rescheduled — tenant notified", payload); setResched(null); }} />
      )}
    </div>
  );
}

function RescheduleModal({ visit, onClose, onDone }) {
  const [form, setForm] = useState({ date: visit.date, time: visit.time, reason: "" });
  return (
    <Modal open onClose={onClose} title="Reschedule visit"
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onDone(form)}>Reschedule</button></>}>
      <div className="grid-2">
        <div className="field"><label>New date</label><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <div className="field"><label>New time</label>
          <select className="select" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}>
            {["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"].map((t) => <option key={t}>{t}</option>)}
          </select></div>
      </div>
      <div className="field"><label>Reason (optional)</label><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Available after 4 PM" /></div>
    </Modal>
  );
}


export function OwnerEnquiries() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const { lastEvent } = useSocket();
  const [replyTo, setReplyTo] = useState(null);
  const load = () => api.get("/enquiries").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (lastEvent?.event === "enquiry:new" || lastEvent?.event === "enquiry:reply") load();
  }, [lastEvent]);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  return (
    <div>
      <div className="dash-head"><h1>Enquiries</h1><button className="btn btn-outline btn-sm" onClick={load}>Refresh</button></div>
      {items.length === 0 ? <EmptyState title="No enquiries" message="Tenant questions will appear here in real time." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((e) => (
            <div key={e.id} className="card" style={{ padding: 18 }}>
              <div className="flex-between">
                <div className="flex" style={{ gap: 8 }}><b>{e.tenant?.name}</b><span className="badge badge-gray">{e.topic}</span>
                  {e.status === "open" ? <span className="badge badge-amber">Open</span> : <span className="badge badge-green">Answered</span>}</div>
                <span className="small muted">{timeAgo(e.createdAt)}</span>
              </div>
              <p className="small mt-8"><b>Q:</b> {e.question}</p>
              {e.answer ? <p className="small mt-8" style={{ color: "var(--brand)" }}><b>A:</b> {e.answer}</p>
                : <button className="btn btn-primary btn-sm mt-12" onClick={() => setReplyTo(e)}>Reply</button>}
            </div>
          ))}
        </div>
      )}
      {replyTo && <ReplyModal enquiry={replyTo} onClose={() => setReplyTo(null)} onDone={() => { setReplyTo(null); load(); }} />}
    </div>
  );
}

function ReplyModal({ enquiry, onClose, onDone }) {
  const toast = useToast();
  const [answer, setAnswer] = useState("");
  const submit = async () => {
    if (!answer.trim()) return toast.error("Write an answer first");
    try { await api.post(`/enquiries/${enquiry.id}/reply`, { answer }); toast.success("Reply sent", "The tenant will be notified."); onDone(); }
    catch (e) { toast.error("Could not reply", errMsg(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Reply to enquiry"
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit}>Send Reply</button></>}>
      <div className="card mb-16" style={{ padding: 13, background: "#f8fafc" }}>
        <b className="small">{enquiry.tenant?.name} · {enquiry.topic}</b>
        <p className="small mt-8">{enquiry.question}</p>
      </div>
      <div className="field"><label>Your answer</label><textarea className="textarea" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your reply…" /></div>
    </Modal>
  );
}


export function OwnerReviews() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const load = () => api.get("/reviews").then((r) => setItems(r.data.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  if (!items) return <div className="skel" style={{ height: 200 }} />;
  return (
    <div>
      <div className="dash-head"><h1>Reviews</h1></div>
      {items.length === 0 ? <EmptyState title="No reviews yet" message="Reviews appear here after tenants complete their stays." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((r) => (
            <div key={r.id} className="card" style={{ padding: 18 }}>
              <div className="flex-between">
                <div className="flex" style={{ gap: 8 }}><b>{r.pgName}</b><span className="badge badge-brand">⭐ {r.rating}/5</span></div>
                <span className="small muted">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="small mt-8">{r.comment || "No written comment."}</p>
              <div className="flex mt-8" style={{ gap: 6, flexWrap: "wrap" }}>
                {Object.entries(r.dimensions || {}).map(([k, v]) => <span key={k} className="amen-tag">{k}: {v}★</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export function OwnerAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const { lastEvent } = useSocket();
  const load = useCallback(() => {
    setError(false);
    return api.get("/owners/analytics")
      .then((r) => setData(r.data.data))
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (lastEvent && ["booking:new", "booking:accepted", "booking:rejected", "booking:completed", "booking:cancelled", "enquiry:new", "enquiry:reply", "review:new"].includes(lastEvent.event)) load();
  }, [lastEvent, load]);
  if (!data) return <div className="skel" style={{ height: 300 }} />;
  return (
    <div>
      <div className="dash-head"><h1>Analytics</h1><button className="btn btn-outline btn-sm" onClick={load}>Refresh</button></div>
      {error && <div className="card mb-16" style={{ padding: 14, color: "var(--red)" }}>Analytics could not be refreshed. Try again.</div>}
      <div className="grid-2">
        <div className="card" style={{ padding: 22 }}>
          <h3 className="mb-16" style={{ fontSize: 16 }}>Bookings by Month</h3>
          <BarChart data={data.bookingsByMonth} xKey="month" yKey="count" />
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h3 className="mb-16" style={{ fontSize: 16 }}>Room Type Demand</h3>
          <BarChart data={data.roomTypeDemand} xKey="roomType" yKey="count" />
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h3 className="mb-16" style={{ fontSize: 16 }}>Rating Breakdown</h3>
          <BarChart data={data.ratingBreakdown} xKey="rating" yKey="count" />
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h3 className="mb-16" style={{ fontSize: 16 }}>Booking Status</h3>
          <BarChart data={data.bookingStatusCounts} xKey="status" yKey="count" />
        </div>
      </div>
      <div className="card mt-16" style={{ padding: 22 }}>
        <h3 className="mb-16" style={{ fontSize: 16 }}>Enquiry Topics</h3>
        <div className="flex" style={{ gap: 10, flexWrap: "wrap" }}>
          {data.enquiryTopics.map((t) => (
            <span key={t.topic} className="badge badge-blue">{t.topic}: {t.count}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart({ data = [], xKey, yKey }) {
  const [Chart, setChart] = useState(null);
  useEffect(() => {
    import("recharts").then((m) => setChart(() => (props) => (
      <m.ResponsiveContainer width="100%" height={220}>
        <m.BarChart data={props.data}>
          <m.XAxis dataKey={props.xKey} tick={{ fontSize: 11 }} />
          <m.YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
          <m.Tooltip />
          <m.Bar dataKey={props.yKey} fill="#0d9488" radius={[6, 6, 0, 0]} />
        </m.BarChart>
      </m.ResponsiveContainer>
    )));
  }, []);
  return <div style={{ height: 220 }}>{Chart ? <Chart data={data} xKey={xKey} yKey={yKey} /> : <SkeletonLines n={4} />}</div>;
}
