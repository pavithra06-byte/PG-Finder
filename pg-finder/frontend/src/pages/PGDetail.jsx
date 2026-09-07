import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import {
  MapPin, Heart, ShieldCheck, Share2, MessageSquare, Navigation, Wifi, Utensils,
  Snowflake, Check, X, BedDouble, Star, Users, Clock, IndianRupee, Flag, Building2,
  ChevronLeft, Home, AlertTriangle, Ban, PawPrint, UtensilsCrossed, Volume2, DoorOpen, ExternalLink,
} from "lucide-react";
import api, { errMsg } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLocationCtx } from "../context/LocationContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import Modal from "../components/Modal.jsx";
import Stars from "../components/Stars.jsx";
import Avatar from "../components/Avatar.jsx";
import MapView from "../components/MapView.jsx";
import { SkeletonLines } from "../components/Skeleton.jsx";
import { fmtINR, fmtDate, timeAgo, ENQUIRY_TOPICS, REPORT_REASONS } from "../utils/format.js";

const FACILITY_LABELS = {
  college: "🎓 College", university: "🏛 University", hospital: "🏥 Hospital",
  bus_stop: "🚌 Bus Stop", railway_station: "🚉 Railway Station", restaurant: "🍽 Restaurant",
  supermarket: "🛒 Supermarket", atm: "🏧 ATM", pharmacy: "💊 Pharmacy", gym: "🏋 Gym",
};

export default function PGDetail() {
  const { id } = useParams();
  const location = useLocation();
  const inDash = /^\/(tenant|owner|admin)(\/|$)/.test(location.pathname);
  const { user } = useAuth();
  const consolePreview = inDash && user && user.role !== "tenant";
  const homeOf = (role) => (role === "owner" ? "/owner/pgs" : role === "admin" ? "/admin/listings" : "/tenant/nearby");
  const backLabel = () => (user?.role === "owner" ? "My PGs" : user?.role === "admin" ? "PG Listings" : "Nearby PGs");
  const toast = useToast();
  const loc = useLocationCtx();
  const socket = useSocket();
  const navigate = useNavigate();
  const tenantLocation = user?.role === "tenant"
    ? (user.homeLocation?.lat != null && user.homeLocation?.lng != null
      ? { ...user.homeLocation, lat: Number(user.homeLocation.lat), lng: Number(user.homeLocation.lng) }
      : loc.location?.lat != null && loc.location?.lng != null
        ? { ...loc.location, lat: Number(loc.location.lat), lng: Number(loc.location.lng) }
        : null)
    : null;

  const [pg, setPg] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [facilities, setFacilities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);
  const [modal, setModal] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (user?.role === "tenant" && !tenantLocation) loc.detectCurrentLocation();
  }, [user?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      const distanceOrigin = tenantLocation || loc.location;
      if (distanceOrigin?.lat != null && distanceOrigin?.lng != null) {
        params.lat = Number(distanceOrigin.lat);
        params.lng = Number(distanceOrigin.lng);
      }
      const [pgR, roomR, revR] = await Promise.all([
        api.get(`/pgs/${id}`, { params }).catch(() => null),
        api.get("/rooms", { params: { pgId: id } }).catch(() => ({ data: { data: [] } })),
        api.get("/reviews", { params: { pgId: id } }).catch(() => ({ data: { data: [] } })),
      ]);
      if (!pgR || pgR.status === 404) { toast.error("PG not found"); navigate(inDash ? homeOf(user?.role) : "/find"); return; }
      setPg(pgR.data.data);
      setRooms(roomR.data.data);
      setReviews(revR.data.data);
      api.post(`/pgs/${id}/views`).catch(() => {});
      if (user?.role === "tenant") {
        api.get(`/favorites/status/${id}`).then((r) => setFav(r.data.data.favorited)).catch(() => {});
        api.get(`/reviews/eligible/${id}`).then((r) => setEligibility(r.data.data)).catch(() => {});
      }
    } catch (e) {
      toast.error("Could not load PG", errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [id, loc.location, user?.role, toast, navigate]);

  useEffect(() => { load(); }, [load]);

  const loadFacilities = async () => {
    setFacilities([]);
    try {
      const r = await api.get("/pgs/nearby-facilities", { params: { pgId: id } });
      setFacilities(r.data.data);
    } catch {
      setFacilities([]);
    }
  };
  useEffect(() => { if (pg?.location) loadFacilities(); }, [id, pg?.location]);

  const requireLogin = () => {
    if (!user) { navigate("/login", { state: { from: `/pg/${id}` } }); return false; }
    if (user.role === "owner") { toast.info("Owners can't book — login as a tenant"); return false; }
    return true;
  };

  const toggleFav = async () => {
    if (!requireLogin()) return;
    try {
      if (fav) { await api.delete(`/favorites/${id}`); setFav(false); toast.success("Removed from favorites"); }
      else { await api.post(`/favorites/${id}`); setFav(true); toast.success("Saved to favorites"); }
    } catch (e) { toast.error("Could not update", errMsg(e)); }
  };

  const startChat = async () => {
    if (!user) { navigate("/login"); return; }
    try {
      const r = await api.post("/messages/conversations", { otherId: pg.owner.id, pgId: id });
      navigate(user.role === "owner" ? "/owner/messages" : "/tenant/messages", { state: { openConv: r.data.data.id } });
    } catch (e) { toast.error("Could not start chat", errMsg(e)); }
  };

  if (loading) {
    return <div className={`${inDash ? "" : "page page-tight"} container`}><div className="skel" style={{ height: 460, borderRadius: 16 }} /><div className="mt-16"><SkeletonLines n={6} /></div></div>;
  }
  if (!pg) return null;

  const coords = pg.location ? { lat: pg.location[1], lng: pg.location[0] } : null;
  const gallery = pg.images?.length ? pg.images : ["https://placehold.co/800x500?text=PG"];

  return (
    <div className={inDash ? "" : "page page-tight"}>
      <div className="container">
        {inDash
          ? <Link to={homeOf(user?.role)} className="btn btn-ghost btn-sm mb-16"><ChevronLeft size={15} /> Back to {backLabel()}</Link>
          : <Link to="/find" className="btn btn-ghost btn-sm mb-16"><ChevronLeft size={15} /> Back to search</Link>}

        <div className="gallery">
          <img className="g-main" src={gallery[0]} alt={pg.name} onClick={() => setLightbox(gallery[0])} />
          {gallery.slice(1, 5).map((g, i) => (
            <img key={i} src={g} alt="" onClick={() => setLightbox(g)} />
          ))}
        </div>

        <div className="detail-grid">
          <div className="detail-left">
            <div className="card" style={{ padding: 24 }}>
              <div className="flex-between" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="flex mb-8" style={{ gap: 8 }}>
                    {pg.verified && <span className="badge badge-green"><ShieldCheck size={12} /> Verified</span>}
                    <span className="badge badge-blue">{pg.gender} PG</span>
                    {pg.availableNow && <span className="badge badge-brand">Available Now</span>}
                    <span className="badge badge-gray">{pg.status === "approved" ? "Published" : pg.status}</span>
                  </div>
                  <h1 style={{ fontSize: 26, fontWeight: 800 }}>{pg.name}</h1>
                  <div className="flex mt-8" style={{ gap: 6, color: "var(--ink-3)", fontSize: 14 }}>
                    <MapPin size={15} /> {pg.address}, {pg.city}, {pg.state}
                  </div>
                  <div className="flex mt-8" style={{ gap: 14, flexWrap: "wrap" }}>
                    <span className="flex" style={{ gap: 5 }}><Stars value={pg.rating?.average || 0} /> <b>{pg.rating?.average || "New"}</b> <span className="muted small">({pg.rating?.count || 0} reviews)</span></span>
                    {pg.distanceText && <span className="badge badge-brand"><Navigation size={12} /> {pg.distanceText} from your location</span>}
                  </div>
                </div>
                <div className="flex">
                  {!consolePreview && (
                    <button className="icon-btn" onClick={toggleFav} title="Save"><Heart size={18} fill={fav ? "currentColor" : "none"} style={fav ? { color: "var(--red)" } : {}} /></button>
                  )}
                  <button className="icon-btn" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copied"); }}><Share2 size={18} /></button>
                </div>
              </div>

              <p className="mt-16" style={{ color: "var(--ink-2)" }}>{pg.description}</p>

              <div className="grid-2 mt-24">
                <div className="card" style={{ padding: 16, background: "var(--brand-50)", border: "none" }}>
                  <div className="small muted">Monthly rent</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--brand)" }}>{fmtINR(pg.rent?.from)} – {fmtINR(pg.rent?.to)}</div>
                </div>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="card" style={{ padding: 16 }}>
                    <div className="small muted">Deposit</div>
                    <div className="bold">{fmtINR(pg.deposit)}</div>
                  </div>
                  <div className="card" style={{ padding: 16 }}>
                    <div className="small muted">Maintenance</div>
                    <div className="bold">{pg.maintenance ? fmtINR(pg.maintenance) : "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, marginBottom: 14 }}>Rooms & Availability</h3>
              {rooms.length === 0 && <p className="muted small">No rooms added yet.</p>}
              {rooms.map((r) => (
                <div key={r.id} className="room-row">
                  <div>
                    <div className="r-name">Room {r.number} · {r.type}</div>
                    <div className="r-sub">
                      {r.availableBeds} of {r.capacity} bed{r.capacity > 1 ? "s" : ""} available · {r.facilities?.join(", ") || "Standard"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>{fmtINR(r.rent)}<span className="small muted">/mo</span></div>
                    <div className="small muted">Deposit {fmtINR(r.deposit)}</div>
                  </div>
                  <div className="flex" style={{ gap: 6, flexDirection: "column", alignItems: "flex-end" }}>
                    {r.status === "maintenance" ? <span className="badge badge-red">Maintenance</span>
                      : r.availableBeds === 0 ? <span className="badge badge-gray">Full</span>
                      : <span className="badge badge-green">{r.availableBeds} free</span>}
                    {!consolePreview && (
                      <button className="btn btn-primary btn-sm" disabled={r.availableBeds < 1 || r.status === "maintenance"}
                        onClick={() => { if (requireLogin()) { setModal({ type: "book", room: r }); } }}>
                        Book Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {consolePreview ? (
                <div className="mt-12 card" style={{ padding: "12px 14px", background: "var(--brand-50)", border: "1px dashed var(--brand-2)" }}>
                  <span className="small">👁 Previewing from the <b>{user.role === "owner" ? "Owner Console" : "Admin Console"}</b> — bookings, visits & enquiries come from tenants on the <Link to={`/pg/${pg.id}`} style={{ fontWeight: 700 }}>public page</Link>.</span>
                </div>
              ) : (
              <div className="flex mt-12" style={{ gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-outline" onClick={() => { if (requireLogin()) setModal({ type: "visit" }); }}>
                  <Clock size={15} /> Request a Site Visit
                </button>
                <button className="btn btn-outline" onClick={() => { if (requireLogin()) setModal({ type: "enquiry" }); }}>
                  <MessageSquare size={15} /> Ask a Question
                </button>
              </div>
              )}
            </div>

            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, marginBottom: 14 }}>Amenities & Facilities</h3>
              <div className="check-grid">
                {pg.amenities?.map((a) => (
                  <div key={a} className="chip-check active" style={{ cursor: "default" }}>
                    {a === "Wi-Fi" ? <Wifi size={14} /> : a === "Food" ? <Utensils size={14} /> : a === "AC" ? <Snowflake size={14} /> : <Check size={14} />} {a}
                  </div>
                ))}
                {(!pg.amenities || pg.amenities.length === 0) && <span className="muted small">No amenities listed.</span>}
              </div>
              {pg.foodInfo && (
                <div className="mt-16 card" style={{ padding: 14, background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <b className="small">🍛 Food Info</b>
                  <p className="small muted mt-8">{pg.foodInfo}</p>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, marginBottom: 14 }}>House Rules</h3>
              <div className="rule-list">
                {pg.rules && Object.entries({
                  entryExit: ["🚪 Entry / Exit", DoorOpen], visitorPolicy: ["👥 Visitors", Users],
                  smoking: ["🚭 Smoking", Ban], alcohol: ["🍺 Alcohol", AlertTriangle],
                  pets: ["🐾 Pets", PawPrint], foodRules: ["🍛 Food", UtensilsCrossed],
                  noise: ["🔇 Noise", Volume2], noticePeriod: ["📅 Notice", Clock], other: ["📋 Other", Flag],
                }).filter(([k]) => pg.rules[k]).map(([k, [label, Icon]]) => (
                  <div key={k} className="rule-item">
                    <Icon size={16} style={{ flexShrink: 0, color: "var(--brand)", marginTop: 1 }} />
                    <div><b>{label}</b>{pg.rules[k]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div className="flex-between mb-16">
                <h3 style={{ fontSize: 18 }}>Ratings & Reviews <span className="muted small">({reviews.length})</span></h3>
                {user?.role === "tenant" && eligibility?.eligible && !eligibility.hasReviewed && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: "review" })}>Write a Review</button>
                )}
              </div>
              {reviews.length === 0 && <p className="muted small">No reviews yet. Be the first to review after your stay!</p>}
              {reviews.map((r) => (
                <div key={r.id} className="flex" style={{ alignItems: "flex-start", gap: 12, padding: "13px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <Avatar name={r.tenant?.name} src={r.tenant?.avatar} size={40} />
                  <div style={{ flex: 1 }}>
                    <div className="flex-between">
                      <b style={{ fontSize: 14 }}>{r.tenant?.name}</b>
                      <span className="small muted">{timeAgo(r.createdAt)}</span>
                    </div>
                    <div className="flex mt-8" style={{ gap: 6 }}><Stars value={r.rating} /> <span className="small bold">{r.rating}/5</span></div>
                    {r.comment && <p className="small mt-8" style={{ color: "var(--ink-2)" }}>{r.comment}</p>}
                    {Object.keys(r.dimensions || {}).length > 0 && (
                      <div className="flex mt-8" style={{ gap: 6, flexWrap: "wrap" }}>
                        {Object.entries(r.dimensions).map(([k, v]) => (
                          <span key={k} className="amen-tag">{k.replace(/([A-Z])/g, " $1")}: {v}★</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {!consolePreview && (
              <div className="card sticky-box" style={{ padding: 22 }}>
                <div className="flex mb-16" style={{ gap: 12 }}>
                  <Avatar name={pg.owner?.name} src={pg.owner?.avatar} size={46} />
                  <div>
                    <b>{pg.owner?.name}</b>
                    {pg.owner?.isVerified && <span className="badge badge-green ml-8"><ShieldCheck size={11} /> Verified Owner</span>}
                    <div className="small muted">{pg.owner?.responseTime || "Usually responds quickly"}</div>
                  </div>
                </div>
                <button className="btn btn-outline btn-block mb-8" onClick={startChat}>
                  <MessageSquare size={16} /> Chat with Owner
                </button>
                <button className="btn btn-primary btn-block mb-8" disabled={!rooms.some((room) => room.availableBeds > 0 && room.status !== "maintenance")}
                  onClick={() => {
                    const availableRoom = rooms.find((room) => room.availableBeds > 0 && room.status !== "maintenance");
                    if (availableRoom && requireLogin()) setModal({ type: "book", room: availableRoom });
                  }}>
                  <BedDouble size={16} /> Book a Room
                </button>
                <button className="btn btn-dark btn-block" onClick={() => { if (requireLogin()) setModal({ type: "visit" }); }}>
                  <Clock size={16} /> Request Visit
                </button>
                <button className="btn btn-ghost btn-block mt-8 small" style={{ color: "var(--red)" }}
                  onClick={() => { if (requireLogin()) setModal({ type: "report" }); }}>
                  <Flag size={14} /> Report this listing
                </button>
              </div>
            )}

            {coords && (
              <div className={`card ${consolePreview ? "" : "mt-16"}`} style={{ padding: 14 }}>
                <h4 className="mb-12">📍 Location on Map</h4>
                <div className="map-wrap" style={{ height: 240 }}>
                  <MapView center={coords} markers={[{ id: "pg", ...coords, label: pg.name }]} userLocation={tenantLocation} fitLocations={user?.role === "tenant"} height={240} />
                </div>
              </div>
            )}

            {facilities && (
              <div className="card mt-16" style={{ padding: 22 }}>
                <h4 className="mb-12">🏙 Nearby Facilities</h4>
                {facilities.length === 0 && <p className="small muted">Live map data unavailable right now.</p>}
                {facilities.slice(0, 8).map((f, i) => (
                  <div key={i} className="flex-between" style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13.5 }}>
                    <span>{FACILITY_LABELS[f.category] || f.category} · <b>{f.name}</b></span>
                    <span className="badge badge-gray">{f.distanceText}</span>
                  </div>
                ))}
                <p className="small muted mt-12">Distances computed live from OpenStreetMap data.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal?.type === "book" && (
        <BookingModal pg={pg} room={modal.room} onClose={() => setModal(null)}
          onDone={(status) => { setModal(null); toast.success(status === "created" ? "Booking request sent!" : "Booking created", "The owner will be notified instantly."); load(); }} />
      )}
      {modal?.type === "visit" && (
        <VisitModal pg={pg} onClose={() => setModal(null)} onDone={() => { setModal(null); toast.success("Visit request sent!", "The owner will be notified instantly."); }} />
      )}
      {modal?.type === "enquiry" && (
        <EnquiryModal pg={pg} onClose={() => setModal(null)} onDone={() => { setModal(null); toast.success("Enquiry sent!", "The owner will reply soon."); }} />
      )}
      {modal?.type === "review" && (
        <ReviewModal pg={pg} onClose={() => setModal(null)} onDone={() => { setModal(null); toast.success("Thanks for your review!"); load(); }} />
      )}
      {modal?.type === "report" && (
        <ReportModal pg={pg} onClose={() => setModal(null)} onDone={() => { setModal(null); toast.success("Report submitted", "Our team will review it."); }} />
      )}

      {lightbox && (
        <div className="modal-overlay" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 14, boxShadow: "var(--shadow-lg)" }} />
        </div>
      )}
    </div>
  );
}

function BookingModal({ pg, room, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({
    moveInDate: "", duration: 3, occupants: 1, name: "", phone: "", message: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.moveInDate) return toast.error("Select a move-in date");
    if (Number(form.occupants) > Number(room.availableBeds || 0)) {
      return toast.error("Not enough beds available", `Only ${room.availableBeds} bed${room.availableBeds === 1 ? " is" : "s are"} available in this room.`);
    }
    setBusy(true);
    try {
      const r = await api.post("/bookings", {
        pgId: pg.id, roomId: room.id, moveInDate: form.moveInDate,
        duration: Number(form.duration), occupants: Number(form.occupants), message: form.message,
      });
      onDone("created");
      if (r.data.data?.status === "pending") toast.success("Booking request sent to owner");
    } catch (e) {
      toast.error("Booking failed", errMsg(e, "The room is no longer available for those occupants or dates."));
    } finally {
      setBusy(false);
    }
  };

  const minDate = new Date().toISOString().split("T")[0];
  return (
    <Modal open onClose={onClose} title={`Book ${room.type} — ${pg.name}`}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Confirm Booking Request"}</button></>}>
      <div className="card mb-16" style={{ padding: 13, background: "#f8fafc" }}>
        <div className="flex-between small">
          <span>Room {room.number} · {room.type}</span><b>{fmtINR(room.rent)}/mo</b>
        </div>
        <div className="flex-between small mt-8">
          <span className="muted">Deposit</span><b>{fmtINR(room.deposit)}</b>
        </div>
        <div className="flex-between small mt-8">
          <span className="muted">Available beds</span><b className="badge badge-green">{room.availableBeds}</b>
        </div>
      </div>
      <div className="grid-2">
        <div className="field"><label>Move-in date *</label>
          <input type="date" className="input" min={minDate} value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} /></div>
        <div className="field"><label>Duration (months)</label>
          <select className="select" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
            {[1, 2, 3, 4, 5, 6, 9, 12].map((m) => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}
          </select></div>
      </div>
      <div className="field"><label>Occupants</label>
        <select className="select" value={form.occupants} onChange={(e) => setForm({ ...form, occupants: e.target.value })}>
          {Array.from({ length: Math.min(4, Number(room.availableBeds || 0)) }, (_, i) => i + 1)
            .map((n) => <option key={n} value={n}>{n}</option>)}
        </select></div>
      <div className="field"><label>Your name</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
      <div className="field"><label>Phone</label>
        <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91" /></div>
      <div className="field"><label>Message to owner (optional)</label>
        <textarea className="textarea" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Anything the owner should know…" /></div>
      <p className="hint">The owner will review your request. Rooms are reserved instantly to prevent double booking.</p>
    </Modal>
  );
}

function VisitModal({ pg, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ date: "", time: "11:00 AM", visitors: 1, message: "" });
  const [busy, setBusy] = useState(false);
  const minDate = new Date().toISOString().split("T")[0];
  const submit = async () => {
    if (!form.date || !form.time) return toast.error("Pick a date and time");
    setBusy(true);
    try {
      await api.post("/visits", { pgId: pg.id, date: form.date, time: form.time, visitors: Number(form.visitors), message: form.message });
      onDone();
    } catch (e) { toast.error("Could not send request", errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Request a visit — ${pg.name}`}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Request Visit"}</button></>}>
      <div className="grid-2">
        <div className="field"><label>Date *</label>
          <input type="date" className="input" min={minDate} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <div className="field"><label>Time *</label>
          <select className="select" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}>
            {["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"].map((t) => <option key={t}>{t}</option>)}
          </select></div>
      </div>
      <div className="field"><label>Number of visitors</label>
        <select className="select" value={form.visitors} onChange={(e) => setForm({ ...form, visitors: e.target.value })}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select></div>
      <div className="field"><label>Message (optional)</label>
        <textarea className="textarea" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Anything specific you'd like to see?" /></div>
    </Modal>
  );
}

function EnquiryModal({ pg, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ topic: "Availability", question: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (form.question.trim().length < 5) return toast.error("Please write your question");
    setBusy(true);
    try {
      await api.post("/enquiries", { pgId: pg.id, topic: form.topic, question: form.question });
      onDone();
    } catch (e) { toast.error("Could not send", errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Ask the owner"
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send Enquiry"}</button></>}>
      <div className="field"><label>Topic</label>
        <select className="select" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
          {ENQUIRY_TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select></div>
      <div className="field"><label>Your question *</label>
        <textarea className="textarea" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="e.g. Is the deposit refundable? What are the meal timings?" /></div>
      <p className="hint">Your enquiry is stored and the owner replies here — you'll get a notification.</p>
    </Modal>
  );
}

function ReviewModal({ pg, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ rating: 4, comment: "", cleanliness: 4, location: 4, food: 4, facilities: 4, security: 4, valueForMoney: 4 });
  const [busy, setBusy] = useState(false);
  const dims = ["cleanliness", "location", "food", "facilities", "security", "valueForMoney"];
  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/reviews", { pgId: pg.id, ...form });
      onDone();
    } catch (e) { toast.error("Review failed", errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Rate your stay at ${pg.name}`}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Posting…" : "Post Review"}</button></>}>
      <div className="field">
        <label>Overall rating</label>
        <div className="flex" style={{ gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className="icon-btn" style={form.rating >= n ? { background: "var(--amber)", color: "#fff", borderColor: "var(--amber)" } : {}} onClick={() => setForm({ ...form, rating: n })}>
              <Star size={17} fill={form.rating >= n ? "#fff" : "none"} />
            </button>
          ))}
        </div>
      </div>
      <div className="grid-2">
        {dims.map((d) => (
          <div className="field" key={d}><label className="small">{d.replace(/([A-Z])/g, " $1")}</label>
            <select className="select" value={form[d]} onChange={(e) => setForm({ ...form, [d]: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
            </select></div>
        ))}
      </div>
      <div className="field"><label>Written review</label>
        <textarea className="textarea" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="How was your stay?" /></div>
    </Modal>
  );
}

function ReportModal({ pg, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ reason: REPORT_REASONS[0], details: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/reports", { pgId: pg.id, ...form });
      onDone();
    } catch (e) { toast.error("Could not submit", errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Report this listing"
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-danger" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit Report"}</button></>}>
      <div className="field"><label>Reason</label>
        <select className="select" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
          {REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select></div>
      <div className="field"><label>Details (optional)</label>
        <textarea className="textarea" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Tell us more…" /></div>
    </Modal>
  );
}
