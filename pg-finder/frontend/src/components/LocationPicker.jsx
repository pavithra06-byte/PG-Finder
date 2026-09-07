import { useState, useEffect, useCallback } from "react";
import { MapPin, LocateFixed, Search, Crosshair } from "lucide-react";
import Modal from "./Modal.jsx";
import MapView from "./MapView.jsx";
import { useLocationCtx } from "../context/LocationContext.jsx";
import { useToast } from "../context/ToastContext.jsx";


export default function LocationPicker({ value, onSelect, placeholder = "Search city, area or locality", compact = false }) {
  const loc = useLocationCtx();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [searching, setSearching] = useState(false);
  const [mapLoc, setMapLoc] = useState(null);

  const runSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const res = await loc.searchPlace(q.trim());
      setSuggestions(res);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, [loc]);

  useEffect(() => {
    if (!query) { setSuggestions([]); return; }
    const t = setTimeout(() => runSearch(query), 450);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const handleSelect = async (place) => {
    setSuggestions([]);
    setQuery("");
    const picked = await loc.selectPlace(place);
    onSelect?.(picked || loc.location);
    toast.success("Location set", place.label || "Search area updated");
  };

  const useMine = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation unavailable", "Enter a location manually instead.");
      return;
    }
    await loc.detectCurrentLocation();
    if (loc.location) {
      setQuery("");
      onSelect?.(loc.location);
      toast.success("Using your current location", loc.location.label);
    } else if (loc.error) {
      toast.error("Location unavailable", loc.error);
    }
  };

  const pickOnMap = (lat, lng) => {
    setMapLoc({ lat, lng });
  };

  const confirmMapPick = async () => {
    if (!mapLoc) return;
    const picked = await loc.selectOnMap(mapLoc.lat, mapLoc.lng);
    setShowMap(false);
    onSelect?.(picked || loc.location);
    toast.success("Location selected on map", picked?.label || "Map location applied");
  };

  const label = value?.label || (value ? `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}` : "");

  return (
    <div>
      <div className="loc-input-wrap">
        <MapPin className="loc-ic" size={17} />
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value?.label || placeholder}
          onFocus={(e) => { if (!query) { e.target.placeholder = placeholder; } }}
        />
        <button type="button" className="use-mine-btn" onClick={useMine} title="Use my current location">
          <Crosshair size={12} /> {compact ? "Mine" : "Use My Current Location"}
        </button>
        {query && (
          <div className="suggestions">
            {searching && <div className="suggestion-item"><span className="nm">Searching…</span></div>}
            {!searching && suggestions.length === 0 && query.length >= 2 && (
              <div className="suggestion-item"><span className="nm">No locations found</span></div>
            )}
            {suggestions.map((s, i) => (
              <div key={i} className="suggestion-item" onClick={() => handleSelect(s)}>
                <MapPin size={15} style={{ marginTop: 3, color: "var(--brand)", flexShrink: 0 }} />
                <div>
                  <div className="nm">{s.area || s.city || s.label}</div>
                  <div className="sb">{s.label || s.displayName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="hint flex" style={{ gap: 14, marginTop: 6 }}>
        <span><LocateFixed size={11} /> GPS · manual · map</span>
        {!compact && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setShowMap(true)} style={{ padding: 0, fontSize: 12 }}>
            📍 Select on Map
          </button>
        )}
      </div>

      <Modal open={showMap} onClose={() => setShowMap(false)} title="Select location on map" large>
        <p className="small muted mb-16">Click anywhere on the map to drop a pin, then confirm. You can also zoom in/out and pan.</p>
        <MapView center={mapLoc || value || loc.location || loc.DEFAULT_CENTER} pickMode onPick={pickOnMap} height={420} />
        {mapLoc && (
          <div className="card mt-12" style={{ padding: 13 }}>
            <div className="flex-between">
              <div>
                <b>{mapLoc.lat.toFixed(5)}, {mapLoc.lng.toFixed(5)}</b>
                <div className="small muted">Reverse-geocoded on confirm</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={confirmMapPick}>Use this location <Search size={14} /></button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
