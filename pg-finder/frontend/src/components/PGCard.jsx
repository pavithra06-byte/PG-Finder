import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { MapPin, Heart, ShieldCheck, BedDouble, Wifi, Utensils, Snowflake } from "lucide-react";
import Stars from "./Stars.jsx";
import { fmtINR } from "../utils/format.js";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const AMEN_ICONS = { "Wi-Fi": <Wifi size={12} />, Food: <Utensils size={12} />, AC: <Snowflake size={12} /> };

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistanceKm(km) {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : km.toFixed(0)} km`;
}

export default function PGCard({ pg, onFavChange, showDistance = true }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [fav, setFav] = useState(false);

  useEffect(() => {
    if (user?.role === "tenant" && pg.id) {
      api.get(`/favorites/status/${pg.id}`).then((r) => setFav(r.data.data.favorited)).catch(() => {});
    }
  }, [user?.role, pg.id]);

  const dashPrefix = ["/tenant", "/owner", "/admin"].find((p) => location.pathname.startsWith(p)) || "";
  const to = `${dashPrefix}/pg/${pg.id}`;

  const toggleFav = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate("/login"); return; }
    if (user.role !== "tenant") { toast.info("Favorites are for tenants"); return; }
    try {
      if (fav) {
        await api.delete(`/favorites/${pg.id}`);
        setFav(false);
        toast.success("Removed from favorites");
      } else {
        await api.post(`/favorites/${pg.id}`);
        setFav(true);
        toast.success("Added to favorites", pg.name);
      }
      onFavChange?.();
    } catch (err) {
      toast.error("Could not update favorites", err?.response?.data?.error);
    }
  };

  const img = pg.images?.[0] || "https://placehold.co/600x400?text=PG";
  const homeLocation = user?.role === "tenant" && user.homeLocation?.lat != null && user.homeLocation?.lng != null
    ? { lat: Number(user.homeLocation.lat), lng: Number(user.homeLocation.lng) }
    : null;
  const cardDistanceText = pg.distanceText || (
    homeLocation && pg.location && Array.isArray(pg.location) && pg.location.length >= 2
      ? formatDistanceKm(haversineKm(homeLocation.lat, homeLocation.lng, Number(pg.location[1]), Number(pg.location[0])))
      : null
  );

  return (
    <Link to={to} className="pg-card">
      <div className="img-wrap">
        <img src={img} alt={pg.name} loading="lazy" />
        <div className="top-badges">
          {pg.verified && <span className="badge badge-green"><ShieldCheck size={12} /> Verified</span>}
          {pg.availableNow && <span className="badge badge-blue">Available Now</span>}
        </div>
        <button className={`fav ${fav ? "active" : ""}`} onClick={toggleFav} title={fav ? "Remove favorite" : "Save favorite"}>
          <Heart size={17} fill={fav ? "currentColor" : "none"} />
        </button>
        {showDistance && cardDistanceText && (
          <span className="dist-pill"><MapPin size={12} /> {cardDistanceText} away</span>
        )}
      </div>
      <div className="body">
        <div className="name-row">
          <h3>{pg.name}</h3>
        </div>
        <div className="loc-line">
          <MapPin size={13} /> {pg.area || pg.city}, {pg.city}
        </div>
        <div className="meta">
          <span className="flex" style={{ gap: 4 }}><Stars value={pg.rating?.average || 0} /> <b>{pg.rating?.average || "New"}</b></span>
          <span>·</span>
          <span>{pg.rating?.count || 0} reviews</span>
          <span>·</span>
          <span><BedDouble size={12} style={{ verticalAlign: -2 }} /> {pg.availableRooms ?? 0} rooms free</span>
        </div>
        <div className="amen-row">
          {pg.amenities?.slice(0, 4).map((a) => (
            <span key={a} className="amen-tag">{AMEN_ICONS[a] && <>{AMEN_ICONS[a]} </>}{a}</span>
          ))}
          {(pg.amenities?.length || 0) > 4 && <span className="amen-tag">+{pg.amenities.length - 4} more</span>}
        </div>
        <div className="foot">
          <div>
            <span className="rent">{fmtINR(pg.rent?.from)}</span> <small>/month</small>
          </div>
          <span className="small muted">Deposit {fmtINR(pg.deposit)}</span>
        </div>
      </div>
    </Link>
  );
}
