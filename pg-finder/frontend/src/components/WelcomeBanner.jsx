import { Link } from "react-router-dom";
import {
  Home, Search, Heart, PlusCircle, Building2, ShieldCheck, ClipboardList,
  Sparkles, CalendarDays,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";

const ROLE_CFG = {
  tenant: {
    grad: "wb-tenant",
    sub: "Find rooms near you, track bookings and chat with owners — all in one place.",
    chips: [
      { ic: <Search size={12} />, t: "Nearby search" },
      { ic: <Heart size={12} />, t: "Save favorites" },
      { ic: <Sparkles size={12} />, t: "Instant chat" },
    ],
    actions: [
      { to: "/tenant/nearby", label: "Search Nearby PGs", icon: <Search size={15} />, primary: true },
      { to: "/tenant/favorites", label: "My Favorites", icon: <Heart size={15} /> },
    ],
  },
  owner: {
    grad: "wb-owner",
    sub: "Manage your properties, rooms, bookings and earnings analytics in real time.",
    chips: [
      { ic: <Building2 size={12} />, t: "Multi-PG manager" },
      { ic: <ClipboardList size={12} />, t: "Booking control" },
      { ic: <Sparkles size={12} />, t: "Live analytics" },
    ],
    actions: [
      { to: "/owner/pgs/new", label: "Add New PG", icon: <PlusCircle size={15} />, primary: true },
      { to: "/owner/pgs", label: "My Listings", icon: <Building2 size={15} /> },
    ],
  },
  admin: {
    grad: "wb-admin",
    sub: "Platform overview — verify owners, moderate listings and track growth.",
    chips: [
      { ic: <ShieldCheck size={12} />, t: "Owner verification" },
      { ic: <ClipboardList size={12} />, t: "Moderation" },
      { ic: <Sparkles size={12} />, t: "Platform analytics" },
    ],
    actions: [
      { to: "/admin/owners", label: "Verify Owners", icon: <ShieldCheck size={15} />, primary: true },
      { to: "/admin/listings", label: "Review Listings", icon: <ClipboardList size={15} /> },
    ],
  },
};

export default function WelcomeBanner({ extra }) {
  const { user } = useAuth();
  const role = user?.role || "tenant";
  const cfg = ROLE_CFG[role] || ROLE_CFG.tenant;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (user?.name || "there").split(" ")[0];
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={`wb ${cfg.grad}`}>
      <div className="wb-pattern" />
      <div className="wb-glow" />
      <div className="wb-inner">
        <div className="wb-main">
          <div className="wb-greet">
            <Avatar name={user?.name} src={user?.avatar} size={46} />
            <div>
              <span className="wb-hello">{greet}, {first} 👋</span>
              <p>{cfg.sub}</p>
            </div>
          </div>
          <div className="wb-chips">
            {cfg.chips.map((c) => (
              <span key={c.t}>{c.ic} {c.t}</span>
            ))}
          </div>
        </div>

        <div className="wb-side">
          {extra}
          <span className="wb-date"><CalendarDays size={13} /> {dateStr}</span>
          <div className="wb-actions">
            {cfg.actions.map((a) => (
              <Link key={a.to} to={a.to} className={`btn btn-sm ${a.primary ? "btn-white" : "wb-ghost"}`}>
                {a.icon} {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
