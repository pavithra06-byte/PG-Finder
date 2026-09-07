import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Home, MapPin, MessageSquare, LogOut, Menu, X, User as UserIcon,
  LayoutDashboard, Crosshair, Sun, Moon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useLocationCtx } from "../context/LocationContext.jsx";
import Modal from "./Modal.jsx";
import Avatar from "./Avatar.jsx";
import LocationPicker from "./LocationPicker.jsx";
import MapView from "./MapView.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  const { msgBadge } = useSocket();
  const loc = useLocationCtx();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [locModal, setLocModal] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const authed = !loading && !!user;

  const dashPath = user?.role === "tenant" ? "/tenant/dashboard" : user?.role === "owner" ? "/owner/dashboard" : "/admin/dashboard";
  const msgPath = user?.role === "tenant" ? "/tenant/messages" : "/owner/messages";
  const profilePath = user?.role === "tenant" ? "/tenant/profile" : user?.role === "owner" ? "/owner/profile" : "/admin/profile";

  return (
    <>
      <nav className="navbar">
        <div className="nav-inner">
          <Link to="/" className="logo">
            <span className="logo-mark"><Home size={18} /></span>
            PG&nbsp;Finder
          </Link>

          <div className="nav-links">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              Home
            </NavLink>
            <NavLink to="/how-it-works" className={({ isActive }) => (isActive ? "active" : "")}>
              How It Works
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => (isActive ? "active" : "")}>
              About Us
            </NavLink>
          </div>

          <div className="nav-right">
            {loc.location && (
              <button className="loc-pill" onClick={() => setLocModal(true)} title="Change location">
                <MapPin size={13} color="var(--brand)" />
                <span>{loc.location.label}</span>
              </button>
            )}

            <button className="icon-btn theme-btn" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {!authed && !loading && (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
              </>
            )}

            {authed && (
              <>
                {user.role !== "admin" && (
                  <Link to={msgPath} className="icon-btn" title="Messages">
                    <MessageSquare size={18} />
                    {msgBadge > 0 && <span className="dot">{msgBadge > 9 ? "9+" : msgBadge}</span>}
                  </Link>
                )}
                <Link to={dashPath} className="btn btn-outline btn-sm">
                  <LayoutDashboard size={15} /> Dashboard
                </Link>
                <Link to={profilePath} className="icon-btn" title="Profile">
                  {user.avatar ? <img src={user.avatar} alt="" style={{ width: 22, height: 22, borderRadius: "50%" }} /> : <UserIcon size={18} />}
                </Link>
                <button className="icon-btn" title="Logout" onClick={() => { logout(); navigate("/"); }}>
                  <LogOut size={18} />
                </button>
              </>
            )}

            <button className="icon-btn burger" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu ${open ? "open" : ""}`}>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/how-it-works">How It Works</NavLink>
        <NavLink to="/about">About Us</NavLink>
        <button className="mobile-theme-btn" onClick={() => { toggleTheme(); }}>
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        {!authed && !loading && (
          <div className="flex mt-12">
            <Link to="/login" className="btn btn-outline" style={{ flex: 1 }}>Login</Link>
            <Link to="/register" className="btn btn-primary" style={{ flex: 1 }}>Get Started</Link>
          </div>
        )}
        {authed && (
          <>
            <NavLink to={dashPath}>Dashboard</NavLink>
            {user.role !== "admin" && <NavLink to={msgPath}>Messages</NavLink>}
            <NavLink to={profilePath}>Profile</NavLink>
            <button className="btn btn-outline btn-block mt-12" onClick={() => { logout(); navigate("/"); }}>
              <LogOut size={15} /> Logout
            </button>
          </>
        )}
      </div>

      <LocationModal open={locModal} onClose={() => setLocModal(false)} />
    </>
  );
}

function LocationModal({ open, onClose }) {
  const loc = useLocationCtx();
  const toast = useToast();
  const [tab, setTab] = useState("search");
  const [mapLoc, setMapLoc] = useState(null);

  const apply = (l) => {
    onClose();
    toast.success("Location updated", l?.label || "Search will use the new location");
  };

  return (
    <Modal open={open} onClose={onClose} title="Select your location">
      <div className="flex mb-16" style={{ gap: 8 }}>
        <button className={`btn btn-sm ${tab === "search" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("search")}>Search</button>
        <button className={`btn btn-sm ${tab === "mine" ? "btn-primary" : "btn-outline"}`} onClick={async () => { setTab("mine"); await loc.detectCurrentLocation(); if (loc.location) apply(loc.location); }}>
          <Crosshair size={14} /> Use Current Location
        </button>
        <button className={`btn btn-sm ${tab === "map" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("map")}>Select on Map</button>
      </div>

      {loc.permissionDenied && (
        <div className="card" style={{ padding: 14, background: "var(--red-bg)", border: "none", marginBottom: 12 }}>
          <b style={{ color: "#b91c1c" }}>Location access is disabled.</b>
          <div className="small" style={{ color: "#b91c1c" }}>You can still search manually — the app works fully with a manual location.</div>
        </div>
      )}
      {loc.error && tab !== "mine" && <p className="err-text">{loc.error}</p>}

      {tab === "search" && (
        <LocationPicker onSelect={(l) => l && apply(l)} />
      )}
      {tab === "map" && (
        <>
          <MapView
            center={loc.location || loc.DEFAULT_CENTER}
            userLocation={loc.location}
            pickMode
            onPick={(lat, lng) => setMapLoc({ lat, lng })}
            height={360}
          />
          {mapLoc && (
            <button className="btn btn-primary btn-block mt-12" onClick={async () => {
              const picked = await loc.selectOnMap(mapLoc.lat, mapLoc.lng);
              apply(picked);
            }}>
              Use map location ({mapLoc.lat.toFixed(4)}, {mapLoc.lng.toFixed(4)})
            </button>
          )}
        </>
      )}
    </Modal>
  );
}
