import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import api from "../api/client";


const LocationContext = createContext(null);

const DEFAULT_CENTER = { lat: 11.0168, lng: 76.9558 }; // Coimbatore

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null); // {lat, lng, label, area, city, state, source}
  const [detecting, setDetecting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState(null);
  const watchId = useRef(null);
  const lastWatched = useRef(null);

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const r = await api.get("/location/reverse", { params: { lat, lng } });
      const d = r.data.data;
      return {
        label: d.label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        city: d.city, state: d.state, area: d.area, displayName: d.displayName,
      };
    } catch {
      return { label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, city: "", state: "", area: "" };
    }
  }, []);

  const setByCoords = useCallback(async (lat, lng, source = "gps") => {
    if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Invalid coordinates received.");
      return null;
    }
    setDetecting(false);
    const place = await reverseGeocode(lat, lng);
    const loc = { lat, lng, source, ...place };
    setLocation(loc);
    setError(null);
    return loc;
  }, [reverseGeocode]);

  const detectCurrentLocation = useCallback(() => {
    setError(null);
    if (!navigator.geolocation) {
      setPermissionDenied(true);
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await setByCoords(pos.coords.latitude, pos.coords.longitude, "gps");
      },
      (err) => {
        setDetecting(false);
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setError("Location access is disabled. Enter a location manually to continue.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out. Try again or search manually.");
        } else {
          setError("Could not get your location. Please search manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, [setByCoords]);

  const startWatching = useCallback(async () => {
    if (!navigator.geolocation) return;
    if (watchId.current != null) return;
    try {
      const loc = await detectCurrentLocation();
      void loc;
    } catch {  }
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const prev = lastWatched.current;
        if (prev) {
          const dLat = latitude - prev.lat, dLng = longitude - prev.lng;
          const distM = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
          if (distM < 300) return;
        }
        lastWatched.current = { lat: latitude, lng: longitude };
        await setByCoords(latitude, longitude, "gps");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 }
    );
  }, [detectCurrentLocation, setByCoords]);

  const stopWatching = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  useEffect(() => () => stopWatching(), [stopWatching]);

  useEffect(() => {
    const onSignedOut = () => {
      stopWatching();
      lastWatched.current = null;
      setLocation(null);
      setPermissionDenied(false);
      setError(null);
      setDetecting(false);
    };
    window.addEventListener("pgf:signed-out", onSignedOut);
    return () => window.removeEventListener("pgf:signed-out", onSignedOut);
  }, [stopWatching]);

  const searchPlace = useCallback(async (query) => {
    const r = await api.get("/location/search", { params: { q: query } });
    return r.data.data;
  }, []);

  const compactLabel = (place) => {
    const bits = [];
    if (place.area && place.area !== place.city) bits.push(place.area);
    if (place.city) bits.push(place.city);
    if (!bits.length && place.state) bits.push(place.state);
    return bits.join(", ") || place.label || place.displayName || "";
  };

  const selectPlace = useCallback(async (place) => {
    const loc = await setByCoords(Number(place.lat), Number(place.lng), "manual");
    if (loc) {
      loc.label = compactLabel(place);
      loc.city = place.city; loc.state = place.state; loc.area = place.area;
      setLocation({ ...loc });
    }
    return loc;
  }, [setByCoords]);

  const selectOnMap = useCallback(async (lat, lng) => {
    return setByCoords(lat, lng, "map");
  }, [setByCoords]);

  const clearLocation = useCallback(() => setLocation(null), []);

  const value = {
    location, setLocation, detecting, permissionDenied, error,
    detectCurrentLocation, startWatching, stopWatching,
    searchPlace, selectPlace, selectOnMap, reverseGeocode, setByCoords,
    clearLocation, DEFAULT_CENTER,
  };
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export const useLocationCtx = () => useContext(LocationContext);
