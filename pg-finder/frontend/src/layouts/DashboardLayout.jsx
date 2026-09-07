import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, MapPin, Heart, CalendarCheck, CalendarClock, MessageSquare,
  Star, User, Building2, PlusCircle, ClipboardList, BarChart3,
  Users, ShieldCheck, Flag, Megaphone, Sparkles, LogOut,
  Home as HomeIcon, ExternalLink, Sun, Moon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import Avatar from "../components/Avatar.jsx";

const MENUS = {
  tenant: [
    { title: "Overview", items: [
      { to: "/tenant/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    ]},
    { title: "Discover", items: [
      { to: "/tenant/nearby", label: "Nearby PGs", icon: <MapPin size={16} /> },
      { to: "/tenant/favorites", label: "Favorites", icon: <Heart size={16} /> },
    ]},
    { title: "Bookings", items: [
      { to: "/tenant/bookings", label: "My Bookings", icon: <CalendarCheck size={16} /> },
      { to: "/tenant/visits", label: "Visit Requests", icon: <CalendarClock size={16} /> },
    ]},
    { title: "Communication", items: [
      { to: "/tenant/enquiries", label: "Enquiries", icon: <MessageSquare size={16} /> },
      { to: "/tenant/messages", label: "Messages", icon: <MessageSquare size={16} />, badge: "msg" },
      { to: "/tenant/reviews", label: "My Reviews", icon: <Star size={16} /> },
    ]},
    { title: "Account", items: [
      { to: "/tenant/profile", label: "Profile", icon: <User size={16} /> },
    ]},
  ],
  owner: [
    { title: "Overview", items: [
      { to: "/owner/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
      { to: "/owner/analytics", label: "Analytics", icon: <BarChart3 size={16} /> },
    ]},
    { title: "Properties", items: [
      { to: "/owner/pgs", label: "My PGs", icon: <Building2 size={16} /> },
      { to: "/owner/pgs/new", label: "Add PG", icon: <PlusCircle size={16} /> },
      { to: "/owner/catalog", label: "Amenities & Categories", icon: <Sparkles size={16} /> },
    ]},
    { title: "Management", items: [
      { to: "/owner/bookings", label: "Bookings", icon: <ClipboardList size={16} /> },
      { to: "/owner/visits", label: "Visit Requests", icon: <CalendarClock size={16} /> },
      { to: "/owner/enquiries", label: "Enquiries", icon: <MessageSquare size={16} /> },
    ]},
    { title: "Communication", items: [
      { to: "/owner/messages", label: "Messages", icon: <MessageSquare size={16} />, badge: "msg" },
      { to: "/owner/reviews", label: "Reviews", icon: <Star size={16} /> },
    ]},
    { title: "Account", items: [
      { to: "/owner/profile", label: "Profile", icon: <User size={16} /> },
    ]},
  ],
  admin: [
    { title: "Overview", items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
      { to: "/admin/analytics", label: "Analytics", icon: <BarChart3 size={16} /> },
    ]},
    { title: "Management", items: [
      { to: "/admin/users", label: "Users", icon: <Users size={16} /> },
      { to: "/admin/owners", label: "Owner Verification", icon: <ShieldCheck size={16} /> },
      { to: "/admin/listings", label: "PG Listings", icon: <Building2 size={16} /> },
      { to: "/admin/bookings", label: "Bookings", icon: <ClipboardList size={16} /> },
      { to: "/admin/reviews", label: "Reviews", icon: <Star size={16} /> },
    ]},
    { title: "Moderation", items: [
      { to: "/admin/reports", label: "Reports", icon: <Flag size={16} /> },
      { to: "/admin/announce", label: "Announce", icon: <Megaphone size={16} /> },
    ]},
    { title: "Account", items: [
      { to: "/admin/profile", label: "Profile", icon: <User size={16} /> },
    ]},
  ],
};

const SEG_LABELS = {
  dashboard: "Dashboard", analytics: "Analytics", pgs: "My PGs", new: "Add PG",
  bookings: "Bookings", visits: "Visit Requests", enquiries: "Enquiries",
  messages: "Messages", reviews: "Reviews",
  profile: "Profile", preferences: "Preferences", settings: "Settings",
  favorites: "Favorites", nearby: "Nearby PGs", find: "Find PG", users: "Users",
  owners: "Owner Verification", listings: "PG Listings", reports: "Reports",
  announce: "Announce", catalog: "Amenities & Categories", pg: "PG Details",
};

export default function DashboardLayout() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { msgBadge } = useSocket();
  const location = useLocation();
  if (!user) return null;

  const groups = MENUS[user.role] || MENUS.tenant;
  const seg = location.pathname.split("/").filter(Boolean);
  let pageLabel = "Dashboard";
  for (let i = seg.length - 1; i >= 0; i--) {
    if (SEG_LABELS[seg[i]]) { pageLabel = SEG_LABELS[seg[i]]; break; }
  }
  const roleConsole = user.role === "tenant" ? "Tenant Console" : user.role === "owner" ? "Owner Console" : "Admin Console";
  const roleTag = user.role === "owner"
    ? (user.ownerDetails?.verificationStatus === "approved" ? "Verified Owner" : "Pending Verification")
    : user.role;
  const msgPath = user.role === "tenant" ? "/tenant/messages" : "/owner/messages";
  const profilePath = `/${user.role}/profile`;

  return (
    <div className={`dash dash-${user.role}`}>
      <aside className="dash-side side-dark">
        <Link to="/" className="side-brand">
          <span className="logo-mark"><HomeIcon size={17} /></span>
          PG Finder
          <span className="side-role">{user.role}</span>
        </Link>

        <nav className="side-nav">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="side-group">{g.title}</div>
              <div className="menu">
                {g.items.map((m) => (
                  <NavLink key={m.to} to={m.to} end={m.to.endsWith("dashboard") || m.to.endsWith("new")} className={({ isActive }) => (isActive ? "active" : "")}>
                    {m.icon} {m.label}
                    {m.badge === "msg" && msgBadge > 0 && <span className="cnt">{msgBadge > 9 ? "9+" : msgBadge}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <div className="side-user">
            <Avatar name={user.name} src={user.avatar} size={38} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</b>
              <span>{roleTag}</span>
            </div>
            <button className="icon-btn" style={{ background: "transparent", borderColor: "#1e293b", color: "#94a3b8" }} title="Logout" onClick={logout}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="dash-main">
        <div className="topbar">
          <div className="topbar-crumb">
            <Link to="/" className="tb-home" title="Home"><HomeIcon size={15} /></Link>
            <span>/</span>
            <span>{roleConsole}</span>
            <span>/</span>
            <b>{pageLabel}</b>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link to="/" className="btn btn-ghost btn-sm"><ExternalLink size={14} /> View Site</Link>
            {user.role !== "admin" && (
              <Link to={msgPath} className="icon-btn" title="Messages">
                <MessageSquare size={17} />
                {msgBadge > 0 && <span className="dot">{msgBadge > 9 ? "9+" : msgBadge}</span>}
              </Link>
            )}
            <Link to={profilePath} className="icon-btn" title="Profile">
              {user.avatar ? <img src={user.avatar} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }} /> : <User size={17} />}
            </Link>
          </div>
        </div>
        <div className="dash-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
