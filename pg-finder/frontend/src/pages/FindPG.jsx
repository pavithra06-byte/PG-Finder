import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search, MapPin, SlidersHorizontal, Crosshair, Navigation, RefreshCw,
  List, Map as MapIcon, MoveUpRight, Scale, X,
} from "lucide-react";
import api, { errMsg } from "../api/client.js";
import { useLocationCtx } from "../context/LocationContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import PGCard from "../components/PGCard.jsx";
import MapView from "../components/MapView.jsx";
import LocationPicker from "../components/LocationPicker.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { SkeletonGrid } from "../components/Skeleton.jsx";
import { AMENITIES, ROOM_TYPES, SORTS } from "../utils/format.js";

const RADII = [1, 3, 5, 10, 15, 20, 25];

export default function FindPG() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const loc = useLocationCtx();
  const toast = useToast();
  const { user } = useAuth();

  const [city, setCity] = useState(params.get("city") || "");
  const [district, setDistrict] = useState(params.get("district") || "");
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [radius, setRadius] = useState(5);
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [roomType, setRoomType] = useState("");
  const [gender, setGender] = useState("");
  const [amenities, setAmenities] = useState([]);
  const [verified, setVerified] = useState(false);
  const [availableNow, setAvailableNow] = useState(false);
  const [furnished, setFurnished] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("list"); // list | map
  const [profileOff, setProfileOff] = useState(false); // tenant home-area auto-filter off for this visit

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [within, setWithin] = useState(null);
  const [compareIds, setCompareIds] = useState([]);

  const useCity = params.get("city") || "";
  useEffect(() => { setCity(useCity); }, [useCity]);

  const profileHome = user?.role === "tenant" && user?.homeLocation?.lat != null ? user.homeLocation : null;
  const profileRadius = user?.searchRadius || 5;
  const activeHome = profileHome && !profileOff ? profileHome : null;
  const searchLoc = activeHome || selectedLoc || loc.location;
  const profileDriven = !!activeHome;

  const buildQuery = useCallback((overrides = {}) => {
    const q = {};
    if (overrides.lat != null) {
      q.lat = overrides.lat; q.lng = overrides.lng; q.radius = overrides.radius ?? radius;
    } else if (searchLoc) {
      q.lat = searchLoc.lat; q.lng = searchLoc.lng; q.radius = radius;
    }
    if (city) q.city = city;
    if (district) q.district = district;
    if (minRent) q.minRent = minRent;
    if (maxRent) q.maxRent = maxRent;
    if (roomType) q.roomType = roomType;
    if (gender) q.gender = gender;
    if (amenities.length) q.amenities = amenities.join(",");
    if (verified) q.verified = "1";
    if (availableNow) q.availableNow = "1";
    if (furnished) q.furnished = "1";
    q.sort = sort;
    q.per_page = 24;
    return q;
  }, [searchLoc, city, district, radius, minRent, maxRent, roomType, gender, amenities, verified, availableNow, furnished, sort]);

  const fetchResults = useCallback(async (q) => {
    setLoading(true);
    try {
      const r = await api.get("/pgs", { params: q });
      setItems(r.data.data.items);
      setTotal(r.data.data.total);
    } catch (e) {
      toast.error("Search failed", errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (params.get("lat") && params.get("lng")) {
      const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
      setSelectedLoc({ lat, lng, label: params.get("label") || "Selected location", source: "url" });
      const rad = Number(params.get("radius")) || 5;
      setRadius(rad);
      setMinRent(params.get("minRent") || "");
      setMaxRent(params.get("maxRent") || "");
      setRoomType(params.get("roomType") || "");
      setDistrict(params.get("district") || "");
      const q = { lat, lng, radius: rad, sort, per_page: 24 };
      if (params.get("minRent")) q.minRent = params.get("minRent");
      if (params.get("maxRent")) q.maxRent = params.get("maxRent");
      if (params.get("roomType")) q.roomType = params.get("roomType");
      if (params.get("city")) q.city = params.get("city");
      if (params.get("district")) q.district = params.get("district");
      fetchResults(q);
    } else if (profileHome && !profileOff) {
      setRadius(profileRadius);
      fetchResults({ lat: profileHome.lat, lng: profileHome.lng, radius: profileRadius, sort, per_page: 24 });
    } else if (loc.location) {
      fetchResults(buildQuery());
    } else {
      fetchResults(buildQuery());
    }
  }, []);

  const runSearch = useCallback(() => {
    const q = buildQuery();
    fetchResults(q);
    setParams({}, { replace: true });
    if (!searchLoc && !city && !minRent && !maxRent) {
      toast.info("Showing all PGs", "Add a location or filters to narrow results.");
    }
  }, [buildQuery, fetchResults, setParams, searchLoc, city, minRent, maxRent, toast]);

  const offProfile = () => {
    setProfileOff(true);
    setRadius(5);
    const q = { sort, per_page: 24 };
    if (city) q.city = city;
    if (district) q.district = district;
    if (minRent) q.minRent = minRent;
    if (maxRent) q.maxRent = maxRent;
    if (roomType) q.roomType = roomType;
    if (gender) q.gender = gender;
    if (amenities.length) q.amenities = amenities.join(",");
    if (verified) q.verified = "1";
    if (availableNow) q.availableNow = "1";
    if (furnished) q.furnished = "1";
    fetchResults(q);
    toast.info("Showing all PGs", "Home-area auto-filter is off for this visit.");
  };

  useEffect(() => {
    if (!searchLoc) return;
    api.get("/location/within", { params: { lat: searchLoc.lat, lng: searchLoc.lng } })
      .then((r) => setWithin(r.data.data))
      .catch(() => {});
  }, [searchLoc]);

  const markers = useMemo(() => items.filter((p) => p.location).map((p) => ({
    id: p.id, lat: p.location[1], lng: p.location[0], label: p.name,
    price: p.rent?.from, onClick: () => {},
  })), [items]);

  const toggleCompare = (id) => {
    setCompareIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : (c.length < 4 ? [...c, id] : c)));
  };

  const goCompare = () => navigate("/compare", { state: { ids: compareIds } });

  return (
    <div className="page page-tight">
      <div className="container">
        {}
        <div className="card" style={{ padding: 16, marginBottom: 22 }}>
          <div className="search-grid" style={{ gridTemplateColumns: "1.6fr 1fr .8fr auto auto" }}>
            <div className="field">
              <label>📍 Location</label>
              <LocationPicker value={searchLoc} onSelect={(l) => { setSelectedLoc(l); setCity(""); }} />
            </div>
            <div className="field">
              <label>Radius</label>
              <select className="select" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                {RADII.map((r) => <option key={r} value={r}>{r} km</option>)}
              </select>
            </div>
            <div className="field">
              <label>Max Rent</label>
              <input className="input" type="number" min={0} step={500} placeholder="₹ any" value={maxRent} onChange={(e) => setMaxRent(e.target.value)} />
            </div>
            <div className="field">
              <label>Room Type</label>
              <select className="select" value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                <option value="">Any</option>
                {ROOM_TYPES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="field" style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={runSearch}><Search size={16} /> Search</button>
              <button className="btn btn-outline" onClick={() => setShowFilters(!showFilters)} title="More filters">
                <SlidersHorizontal size={16} />
              </button>
            </div>
          </div>

          <div className="flex mt-12" style={{ gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              await loc.detectCurrentLocation();
              if (loc.location) { setSelectedLoc(loc.location); setCity(""); setTimeout(runSearch, 150); }
              else if (loc.error) toast.error("Location unavailable", loc.error);
            }}>
              <Crosshair size={14} /> Use My Current Location
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const l = searchLoc; if (!l) { toast.info("Pick a location first"); return; }
              setView("map");
            }}>
              <MapIcon size={14} /> View on Map
            </button>
            {loc.permissionDenied && <span className="badge badge-red">Location access is disabled — search manually</span>}
            {profileDriven ? (
              <span className="badge badge-brand" style={{ gap: 6, paddingRight: 5 }}>
                <MapPin size={12} /> Around my home area: {searchLoc.label || "Saved location"} · {radius} km
                <button type="button" onClick={offProfile} title="Show all PGs" aria-label="Turn off home-area filter and show all PGs"
                  style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "inline-flex", padding: 2, borderRadius: 6 }}>
                  <X size={12} />
                </button>
              </span>
            ) : (
              searchLoc && <span className="badge badge-brand"><MapPin size={12} /> {searchLoc.label}</span>
            )}
          </div>

          {}
          {showFilters && (
            <div className="card mt-12" style={{ background: "#f8fafc", padding: 16, border: "1px dashed var(--line)" }}>
              <div className="grid-2">
                <div className="field">
                  <label>Min Rent (₹)</label>
                  <input className="input" type="number" min={0} step={500} value={minRent} onChange={(e) => setMinRent(e.target.value)} placeholder="0" />
                </div>
                <div className="field">
                  <label>Gender Preference</label>
                  <select className="select" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Any</option>
                    <option>Male</option><option>Female</option><option>Unisex</option>
                  </select>
                </div>
                <div className="field">
                  <label>District</label>
                  <input className="input" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Coimbatore" />
                </div>
              </div>
              <div className="field">
                <label>Amenities</label>
                <div className="check-grid">
                  {AMENITIES.map((a) => (
                    <label key={a} className={`chip-check ${amenities.includes(a) ? "active" : ""}`}>
                      <input type="checkbox" checked={amenities.includes(a)}
                        onChange={() => setAmenities((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))} />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex mt-12" style={{ flexWrap: "wrap" }}>
                {[{ k: verified, s: setVerified, l: "Verified Only" },
                  { k: availableNow, s: setAvailableNow, l: "Available Now" },
                  { k: furnished, s: setFurnished, l: "Furnished" }].map((o) => (
                  <label key={o.l} className={`chip-check ${o.k ? "active" : ""}`} style={{ padding: "7px 13px" }}>
                    <input type="checkbox" checked={o.k} onChange={() => o.s(!o.k)} /> {o.l}
                  </label>
                ))}
                <button className="btn btn-outline btn-sm" onClick={() => {
                  setMinRent(""); setMaxRent(""); setRoomType(""); setGender(""); setDistrict("");
                  setAmenities([]); setVerified(false); setAvailableNow(false); setFurnished(false); setCity("");
                }}>Clear Filters <X size={13} /></button>
              </div>
            </div>
          )}
        </div>

        {}
        <div className="flex-between mb-16">
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 750 }}>
              {searchLoc ? `PGs near ${searchLoc.label}` : city ? `PGs in ${city}` : "All PG Listings"}
            </h2>
            <span className="small muted">{total} result{total !== 1 ? "s" : ""}{searchLoc ? ` within ${radius} km` : ""}</span>
          </div>
          <div className="flex">
            <select className="select" style={{ width: 160 }} value={sort} onChange={(e) => { setSort(e.target.value); setTimeout(runSearch, 50); }}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <div className="flex" style={{ gap: 4 }}>
              <button className={`icon-btn ${view === "list" ? "btn-primary" : ""}`} style={view === "list" ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" } : {}} onClick={() => setView("list")} title="List view"><List size={17} /></button>
              <button className={`icon-btn ${view === "map" ? "btn-primary" : ""}`} style={view === "map" ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" } : {}} onClick={() => setView("map")} title="Map view"><MapIcon size={17} /></button>
            </div>
          </div>
        </div>

        {}
        {!loading && items.length === 0 && (
          <EmptyState
            title={`No PGs found${searchLoc ? ` within ${radius} km` : ""}`}
            message="Try increasing your search radius or changing your filters."
            actions={[
              searchLoc && (
                <button key="expand" className="btn btn-primary" onClick={() => {
                  const next = radius === 1 ? 3 : radius === 3 ? 5 : radius === 5 ? 10 : radius === 10 ? 15 : radius === 15 ? 20 : 25;
                  setRadius(next);
                  setTimeout(runSearch, 50);
                }}>
                  <Navigation size={15} /> Expand Search to {radius === 1 ? 3 : radius === 3 ? 5 : radius === 5 ? 10 : radius === 10 ? 15 : radius === 15 ? 20 : 25} km
                </button>
              ),
              <button key="loc" className="btn btn-outline" onClick={() => {
                if (loc.location) { setSelectedLoc(null); setCity(""); }
                loc.detectCurrentLocation();
              }}>Change Location</button>,
            ]}
          />
        )}

        {}
        {view === "list" ? (
          loading ? <SkeletonGrid n={6} /> : (
            <>
              <div className="pg-grid">
                {items.map((pg) => (
                  <div key={pg.id} style={{ position: "relative" }}>
                    <PGCard pg={pg} />
                    <button
                      className={`btn btn-sm ${compareIds.includes(pg.id) ? "btn-primary" : "btn-outline"}`}
                      style={{ position: "absolute", top: 148, right: 56, zIndex: 5, padding: "4px 9px", fontSize: 11 }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(pg.id); }}
                    >
                      <Scale size={12} /> {compareIds.includes(pg.id) ? "Added" : "Compare"}
                    </button>
                  </div>
                ))}
              </div>
              {compareIds.length > 0 && (
                <div className="card mt-16" style={{ position: "sticky", bottom: 12, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50 }}>
                  <span className="small bold">{compareIds.length} PG{compareIds.length > 1 ? "s" : ""} selected for comparison</span>
                  <div className="flex">
                    <button className="btn btn-ghost btn-sm" onClick={() => setCompareIds([])}>Clear</button>
                    <button className="btn btn-primary btn-sm" onClick={goCompare} disabled={compareIds.length < 2}>
                      Compare Now <MoveUpRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        ) : (
          <div className="map-wrap" style={{ height: 560 }}>
            <MapView center={searchLoc || { lat: 13.0827, lng: 80.2707 }} markers={markers} userLocation={user?.role === "tenant" ? searchLoc : searchLoc?.source === "gps" ? searchLoc : null} height={560} />
            <div className="card" style={{ position: "absolute", bottom: 14, left: 14, zIndex: 500, padding: "8px 14px" }}>
              <span className="small bold">{items.length} PG{items.length !== 1 ? "s" : ""} on map</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
