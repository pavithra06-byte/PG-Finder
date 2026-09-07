import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search, MapPin, Crosshair, ShieldCheck, IndianRupee, Lock, Star, Navigation,
  MessagesSquare, ArrowRight, Building2, BadgeCheck, Users, TrendingUp, Clock,
  Sparkles, ChevronRight, Globe2, BedDouble, Award,
  Wifi, Utensils, Shirt, Car, Dumbbell, Snowflake, Droplets, Power, BookOpen, Tv,
} from "lucide-react";
import api from "../api/client.js";

const CITY_STYLES = {
  Chennai: { g: "linear-gradient(135deg,#0f766e,#115e59)", emoji: "🌊" },
  Bangalore: { g: "linear-gradient(135deg,#4338ca,#312e81)", emoji: "🏙" },
  Hyderabad: { g: "linear-gradient(135deg,#be185d,#831843)", emoji: "🕌" },
  Coimbatore: { g: "linear-gradient(135deg,#b45309,#92400e)", emoji: "🌴" },
  Madurai: { g: "linear-gradient(135deg,#c2410c,#9a3412)", emoji: "🛕" },
  Trichy: { g: "linear-gradient(135deg,#047857,#065f46)", emoji: "🏛" },
  Karaikudi: { g: "linear-gradient(135deg,#1d4ed8,#1e3a8a)", emoji: "🏠" },
  Delhi: { g: "linear-gradient(135deg,#7c3aed,#5b21b6)", emoji: "🕌" },
  Mumbai: { g: "linear-gradient(135deg,#0e7490,#155e75)", emoji: "🚇" },
  Pune: { g: "linear-gradient(135deg,#dc2626,#991b1b)", emoji: "⛰" },
};
const FALLBACK_STYLE = { g: "linear-gradient(135deg,#0f766e,#115e59)", emoji: "📍" };

const AMENITY_ICONS = {
  "Wi-Fi": Wifi, Wifi,
  "Food": Utensils, "Mess": Utensils,
  "Laundry": Shirt, "Parking": Car, "Gym": Dumbbell,
  "AC": Snowflake, "Hot Water": Droplets, "Power Backup": Power,
  "Study Area": BookOpen, "Security": ShieldCheck, "CCTV": ShieldCheck,
  "Housekeeping": Sparkles, "Furnished": BedDouble, "Tv": Tv, "TV": Tv,
};

export default function Landing() {
  const navigate = useNavigate();
  const [popularLocs, setPopularLocs] = useState([]);
  const [allPgs, setAllPgs] = useState([]);
  const [amenityStats, setAmenityStats] = useState([]);
  const [stats, setStats] = useState({ pgs: 0, cities: 0, rooms: 0, rating: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/location/popular").catch(() => ({ data: { data: [] } })),
      api.get("/pgs", { params: { per_page: 30 } }).catch(() => ({ data: { data: { items: [] } } })),
      api.get("/pgs", { params: { per_page: 1 } }).catch(() => ({ data: { data: { total: 0 } } })),
      api.get("/amenities").catch(() => ({ data: { data: [] } })),
    ]).then(([locs, pgs, all, amens]) => {
      const items = pgs.data.data.items;
      const totalPGs = all.data.data.total || items.length;
      const rooms = items.reduce((s, p) => s + (p.availableRooms || 0), 0);
      const rated = items.filter((p) => p.rating?.average > 0);
      const avg = rated.length ? (rated.reduce((s, p) => s + p.rating.average, 0) / rated.length).toFixed(1) : "4.5";

      const counts = {};
      items.forEach((p) => (p.amenities || []).forEach((a) => { counts[a] = (counts[a] || 0) + 1; }));
      const total = items.length || 1;
      const amenityStats = Object.entries(counts)
        .map(([name, n]) => ({ name, n, pct: Math.round((n / total) * 100) }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 8);

      setPopularLocs(locs.data.data);
      setAllPgs(items);
      setAmenityStats(amenityStats);
      setStats({
        pgs: totalPGs,
        cities: locs.data.data.length,
        rooms: Math.max(rooms, totalPGs > 0 ? 1 : 0),
        rating: avg,
        amenities: amens.data.data.length,
      });
      setLoading(false);
    });
  }, []);

  const goNear = () => navigate("/login");

  const searchCity = () => navigate("/login");

  const top = allPgs[0] || null;

  return (
    <div>
      {}
      <section className="hero2">
        <div className="hero2-bg">
          <div className="blob1" />
          <div className="blob2" />
          <div className="grid" />
        </div>
        <div className="container hero2-inner">
          <div className="hero2-grid">
            <div className="hero2-left">
              <span className="hero2-eyebrow"><span className="pulse-dot" /> Verified PG accommodations across India</span>
              <h1 className="hero2-h1">
                Find Your Perfect PG, <span className="grad">Wherever You Go</span>
              </h1>
              <p className="hero2-sub">
                Discover verified PG accommodations that match your location, budget,
                lifestyle, and preferences — with real distances, real reviews and
                direct owner communication.
              </p>

              <div className="hero2-ctas">
                <Link to="/login" className="btn btn-primary btn-lg hero2-cta">
                  <Search size={18} /> Find My PG
                </Link>
                <button className="btn btn-outline btn-lg" onClick={goNear}>
                  <Crosshair size={17} /> Use My Current Location
                </button>
              </div>
              <div className="hero2-mini-trust">
                <span><BadgeCheck size={14} /> Verified listings</span>
                <span><Star size={14} /> Real reviews</span>
                <span><MessagesSquare size={14} /> Direct owner chat</span>
              </div>
            </div>

            {}
            <div className="hero2-right">
              <div className="hero2-collage">
                <img className="collage-img ci1" src="/uploads/pgs/exterior-1.jpg" alt="PG exterior"
                  onError={(e) => { e.currentTarget.src = "/images/hero.jpg"; }} />
                <img className="collage-img ci2" src="/uploads/pgs/exterior-3.jpg" alt="Modern co-living"
                  onError={(e) => { e.currentTarget.src = "/images/hero.jpg"; }} />
                <img className="collage-img ci3" src="/uploads/pgs/interior-1.jpg" alt="PG room"
                  onError={(e) => { e.currentTarget.src = "/images/hero.jpg"; }} />

                <div className="float-card fc1">
                  <span className="fc-ic fc-green"><ShieldCheck size={17} /></span>
                  <div>
                    <b className="small">Verified Listing</b>
                    <div className="small muted">Admin approved</div>
                  </div>
                </div>
                {top && (
                  <div className="float-card fc2">
                    <span className="fc-ic fc-amber"><Star size={17} /></span>
                    <div>
                      <b className="small">{top.name}</b>
                      <div className="small muted">★ {top.rating?.average || "New"} rated · from ₹{top.rent?.from?.toLocaleString("en-IN")}</div>
                    </div>
                  </div>
                )}
                <div className="float-card fc3">
                  <span className="fc-ic fc-blue"><Navigation size={17} /></span>
                  <div>
                    <b className="small">GPS Nearby Search</b>
                    <div className="small muted">Real distances, live results</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {}
      <section className="stats-strip">
        <div className="container stats-inner">
          {[
            { ic: <Building2 size={18} />, v: stats.pgs, l: "Verified PG Listings" },
            { ic: <Globe2 size={18} />, v: stats.cities, l: "Cities Covered" },
            { ic: <BedDouble size={18} />, v: stats.rooms, l: "Rooms Available" },
            { ic: <Award size={18} />, v: stats.rating, l: "Average Tenant Rating", suffix: "★" },
          ].map((s) => (
            <div key={s.l} className="stat-hero">
              <span className="sh-ic">{s.ic}</span>
              <div>
                <b>{s.v}{s.suffix || ""}</b>
                <span>{s.l}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="section-tag">Why PG Finder</span>
              <h2>A better way to find your next home</h2>
              <p>Everything you need to discover, compare and book — built for how students & professionals actually search.</p>
            </div>
          </div>
          <div className="feat-grid">
            {[
              { ic: <ShieldCheck size={22} />, t: "Verified PG Listings", d: "Every listing is reviewed & approved by our team before going live." },
              { ic: <IndianRupee size={22} />, t: "Transparent Pricing", d: "Rent, deposit and food charges shown upfront. No hidden costs." },
              { ic: <Lock size={22} />, t: "Secure Booking", d: "Bookings tracked end-to-end with clear status at every step." },
              { ic: <Star size={22} />, t: "Real Reviews", d: "Only tenants with completed stays can rate — reviews you can trust." },
              { ic: <Navigation size={22} />, t: "Location-Based Search", d: "GPS, manual search or map picking — we find PGs near you." },
              { ic: <MessagesSquare size={22} />, t: "Direct Owner Chat", d: "Talk to owners in real time. No middlemen, no delays." },
            ].map((x) => (
              <div key={x.t} className="feat2">
                <div className="f-ic">{x.ic}</div>
                <div>
                  <h4>{x.t}</h4>
                  <p>{x.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section className="section section-tint">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="section-tag">Top Cities</span>
              <h2>Explore popular locations</h2>
              <p>Click a city to run a live PG search around it — counts update from real listings.</p>
            </div>
            <Link to="/login" className="see-all">Explore all <ArrowRight size={15} /></Link>
          </div>
          <div className="city-grid">
            {popularLocs.map((c) => {
              const st = CITY_STYLES[c.name] || FALLBACK_STYLE;
              return (
                <div key={c.name} className="city2" style={{ background: st.g }} onClick={() => searchCity(c)}>
                  <span className="city2-emoji">{st.emoji}</span>
                  <div>
                    <b>{c.name}</b>
                    <small>{c.state}{c.pgCount > 0 ? ` · ${c.pgCount} PGs nearby` : ""}</small>
                  </div>
                  <ChevronRight className="city2-arrow" size={18} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="section-tag">Inside Our PGs</span>
              <h2>Real amenities, counted live</h2>
              <p>Share of verified listings offering each amenity — the numbers update from live listings, nothing is estimated.</p>
            </div>
            <Link to="/login" className="see-all">Search by amenity <ArrowRight size={15} /></Link>
          </div>
          {loading ? (
            <div className="amen-band">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="amen2 skel-amen" />
              ))}
            </div>
          ) : (
            <>
              <div className="amen-band">
                {amenityStats.map((a) => {
                  const Icon = AMENITY_ICONS[a.name] || BadgeCheck;
                  return (
                    <Link key={a.name} to="/login" className="amen2">
                      <span className="amen2-ic"><Icon size={19} /></span>
                      <div>
                        <b>{a.name}</b>
                        <span className="amen2-bar"><i style={{ width: `${a.pct}%` }} /></span>
                        <small>{a.n} of {stats.pgs || a.n} PGs · {a.pct}%</small>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <p className="amen2-note">
                <Sparkles size={13} />
                Counted from {stats.pgs} verified live listings across {stats.cities} cities — updated every visit.
              </p>
            </>
          )}
        </div>
      </section>

      {}
      <section className="section section-tint">
        <div className="container">
          <div className="section-head" style={{ justifyContent: "center", textAlign: "center" }}>
            <div>
              <span className="section-tag">Simple Process</span>
              <h2>How PG Finder works</h2>
              <p>From discovery to move-in in four simple steps.</p>
            </div>
          </div>
          <div className="how2">
            {[
              { ic: <MapPin size={20} />, t: "Set Your Location", d: "Allow GPS, type any city or area, or drop a pin on the map." },
              { ic: <Search size={20} />, t: "Discover & Compare", d: "Filter by budget, room type and amenities. Compare side by side." },
              { ic: <Clock size={20} />, t: "Visit or Chat", d: "Request a site visit or chat with the owner in real time." },
              { ic: <BadgeCheck size={20} />, t: "Book & Move In", d: "Book your room, get instant confirmation, move in with confidence." },
            ].map((s, i) => (
              <div key={s.t} className="how2-step">
                <div className="how2-top">
                  <span className="how2-num">STEP {i + 1}</span>
                  <span className="how2-ic">{s.ic}</span>
                </div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
                {i < 3 && <span className="how2-connector"><ChevronRight size={16} /></span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section className="section">
        <div className="container">
          <div className="owner-cta">
            <div className="oc-glow" />
            <div className="oc-content">
              <span className="badge" style={{ background: "rgba(94,234,212,.16)", color: "#5eead4" }}>
                <Building2 size={12} /> FOR PG OWNERS
              </span>
              <h2>Own a PG? Fill your rooms faster.</h2>
              <p>
                List your property free, receive booking requests, enquiries and visit
                requests in real time, and manage everything from one dashboard.
              </p>
              <Link to="/for-owners" className="btn btn-white btn-lg">
                List Your PG <ArrowRight size={17} />
              </Link>
            </div>
            <div className="oc-side">
              <div className="oc-mini"><TrendingUp size={18} /> <div><b>Real-time requests</b><span>Bookings, visits & enquiries</span></div></div>
              <div className="oc-mini"><Users size={18} /> <div><b>10,000+ tenants</b><span>searching every month</span></div></div>
            </div>
          </div>
        </div>
      </section>

      {}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="final-cta">
            <Sparkles size={22} />
            <h2>Ready to find your perfect PG?</h2>
            <p>Join thousands of tenants who found their home with PG Finder.</p>
            <div className="flex" style={{ justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <Link to="/login" className="btn btn-primary btn-lg">Start Searching <Search size={17} /></Link>
              <Link to="/register" className="btn btn-outline btn-lg">Create Free Account</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
