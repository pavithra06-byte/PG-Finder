import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


export default function MapView({ center, markers = [], userLocation, onPick, pickMode = false, height = 420, onMoveEnd, fitLocations = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const userMarkerRef = useRef(null);
  const onPickRef = useRef(onPick);
  const onMoveEndRef = useRef(onMoveEnd);
  onPickRef.current = onPick;
  onMoveEndRef.current = onMoveEnd;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 13,
      scrollWheelZoom: true,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on("click", (e) => {
      if (onPickRef.current) onPickRef.current(e.latlng.lat, e.latlng.lng);
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      if (onMoveEndRef.current) onMoveEndRef.current(c.lat, c.lng, map.getZoom());
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markersRef.current = {}; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.setView([center.lat, center.lng], map.getZoom() || 13, { animate: true });
  }, [center?.lat, center?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    const icon = L.divIcon({
      className: "",
      html: `<div class="pg-marker"><span>PG</span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });
    for (const m of markers) {
      seen.add(m.id);
      const key = String(m.id);
      if (markersRef.current[key]) {
        markersRef.current[key].setLatLng([m.lat, m.lng]);
        markersRef.current[key].setIcon(icon);
        if (m.label) {
          markersRef.current[key].bindPopup(
            `<b>${m.label}</b>${m.price ? `<br/>From ₹${m.price.toLocaleString("en-IN")}/mo` : ""}`
          );
        }
      } else {
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        if (m.label) {
          marker.bindPopup(`<b>${m.label}</b>${m.price ? `<br/>From ₹${m.price.toLocaleString("en-IN")}/mo` : ""}`);
        }
        marker.on("click", () => { if (m.onClick) m.onClick(m); });
        markersRef.current[key] = marker;
      }
    }
    for (const key of Object.keys(markersRef.current)) {
      if (!seen.has(key)) {
        map.removeLayer(markersRef.current[key]);
        delete markersRef.current[key];
      }
    }
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userLocation) {
      if (userMarkerRef.current) userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      else userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({ className: "", html: `<div class="user-pin"><span>You</span></div>`, iconSize: [38, 46], iconAnchor: [19, 46] }),
      }).addTo(map).bindPopup("Your location");
    } else if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
  }, [userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitLocations || !userLocation || !markers.length) return;
    const points = markers.map((marker) => [marker.lat, marker.lng]);
    points.push([userLocation.lat, userLocation.lng]);
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 15, animate: true });
  }, [fitLocations, markers, userLocation?.lat, userLocation?.lng]);

  return <div ref={containerRef} style={{ height, width: "100%", zIndex: 1 }} className="leaflet-map" />;
}
