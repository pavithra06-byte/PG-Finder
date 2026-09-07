import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Search, MessageSquare, BadgeCheck, Building2, IndianRupee, BarChart3 } from "lucide-react";
import api from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";
import { errMsg } from "../api/client.js";
import { jsPDF } from "jspdf";

function downloadLegalPdf(title, sections, filename) {
  const pdf = new jsPDF();
  let y = 22;
  pdf.setFontSize(20);
  pdf.text(title, 20, y);
  y += 8;
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text("PG Finder | Last updated: September 4, 2026", 20, y);
  y += 14;
  sections.forEach(({ heading, text }) => {
    if (y > 260) { pdf.addPage(); y = 22; }
    pdf.setTextColor(20);
    pdf.setFontSize(13);
    pdf.text(heading, 20, y);
    y += 7;
    pdf.setTextColor(75);
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(text, 170);
    lines.forEach((line) => {
      if (y > 280) { pdf.addPage(); y = 22; }
      pdf.text(line, 20, y);
      y += 5;
    });
    y += 7;
  });
  pdf.save(filename);
}

const PRIVACY_SECTIONS = [
  { heading: "1. Information we collect", text: "We collect information you provide when creating an account, including your name, email address, phone number, city, profile details and account role. Owners may provide business and property information. We also collect booking, visit, enquiry, review, favorite and messaging activity needed to operate the service." },
  { heading: "2. Location information", text: "With your permission, PG Finder may use approximate or precise location information to show nearby properties, calculate distances and improve search results. You can disable location access in your browser or device settings." },
  { heading: "3. How we use information", text: "We use information to authenticate users, verify owners, publish and moderate listings, process booking and visit requests, enable tenant-owner communication, send service notifications, prevent misuse and improve our products." },
  { heading: "4. Information shared with others", text: "When you send a booking, visit request, enquiry or message, relevant information is shared with the intended property owner or tenant. Owners can see information needed to manage their listings and requests. We do not sell personal information." },
  { heading: "5. Cookies and local storage", text: "The application uses browser storage to keep you signed in, remember session preferences and support essential functionality. Service providers may use standard technical logs for security, reliability and performance." },
  { heading: "6. Security and retention", text: "We use authentication, role-based access controls and reasonable technical safeguards. We retain information while your account is active or as needed to provide services, resolve disputes, meet legal obligations and maintain security records." },
  { heading: "7. Your rights and choices", text: "You may update profile information, manage notification preferences, disable location permissions or request account assistance. Contact support@pgfinder.local for privacy questions or data requests." },
  { heading: "8. Policy updates", text: "We may update this policy when our services or legal obligations change. The revised version will be posted on this page with a new update date." },
];

const TERMS_SECTIONS = [
  { heading: "1. Acceptance of terms", text: "By accessing or using PG Finder, you agree to these Terms & Conditions and applicable laws. If you do not agree, do not use the service." },
  { heading: "2. Accounts and eligibility", text: "You must provide accurate information, keep your credentials secure and use only your own account. You are responsible for activity performed through your account and must promptly report unauthorized access." },
  { heading: "3. Tenant responsibilities", text: "Tenants must review listing details, submit truthful requests, attend or cancel visits responsibly, communicate respectfully and confirm rental terms directly with the owner before making arrangements." },
  { heading: "4. Owner responsibilities", text: "Owners must provide accurate property details, pricing, availability, images and contact information. Owners are responsible for lawful operation of their properties, responding to requests and honoring commitments made to tenants." },
  { heading: "5. Listings, bookings and communication", text: "PG Finder provides discovery, booking-request, visit-request and communication tools. A booking request is not a guaranteed tenancy until the relevant parties confirm their agreement. Messages and reviews must be lawful, relevant and respectful." },
  { heading: "6. Prohibited conduct", text: "Do not submit misleading content, impersonate another person, discriminate unlawfully, harass users, misuse personal information, manipulate reviews, interfere with the service, upload harmful code or use PG Finder for unlawful activity." },
  { heading: "7. Moderation and suspension", text: "We may review, restrict or remove listings, messages, reviews or accounts that violate these terms, create safety risks, appear fraudulent or harm the service. We may cooperate with lawful investigations." },
  { heading: "8. Disclaimers", text: "PG Finder is a marketplace and communication platform. We do not guarantee the condition, legality, availability, safety, accuracy or suitability of any property or user and are not a party to private rental agreements." },
  { heading: "9. Limitation of liability", text: "To the extent permitted by law, PG Finder is not responsible for losses arising from user conduct, property conditions, private agreements, service interruptions, inaccurate information or reliance on listing content." },
  { heading: "10. Changes and contact", text: "We may modify these terms as the service evolves. Continued use after changes means you accept the updated terms. Questions can be sent to support@pgfinder.local." },
];

export function HowItWorks() {
  const steps = [
    { n: 1, t: "Create your account", d: "Choose Tenant or PG Owner, verify your email through the available sign-in method and keep your profile details current." },
    { n: 2, t: "Search by place", d: "Use a city, neighborhood, map location or your current position to discover approved PGs with distance and availability details." },
    { n: 3, t: "Compare the right fit", d: "Filter by monthly rent, room type, gender, amenities and availability. Open several listings to compare pricing, facilities, photos and reviews." },
    { n: 4, t: "Ask before deciding", d: "Send an enquiry, start a direct conversation with the owner or request a site visit. Updates appear in your dashboard and notifications." },
    { n: 5, t: "Request a room", d: "Select an available room, choose your move-in date and submit a booking request. The assigned PG owner receives it in real time." },
    { n: 6, t: "Track every update", d: "Follow booking, visit, enquiry and message status from your dashboard. Both sides receive real-time in-app and browser notifications." },
    { n: 7, t: "Owners manage securely", d: "Owners submit properties for approval, maintain room availability, review requests and communicate with tenants from one console." },
    { n: 8, t: "Review your stay", d: "After a completed booking, eligible tenants can share a review to help future residents make an informed choice." },
  ];
  return (
    <div className="page page-tight container">
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>How It Works</h1>
      <p className="muted mb-24" style={{ maxWidth: 640 }}>A transparent path from discovering a property to moving in, with tools for both tenants and PG owners.</p>
      <div className="pg-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {steps.map((s) => (
          <div key={s.n} className="card" style={{ padding: 24 }}>
            <div className="step-num">{s.n}</div>
            <h3 style={{ fontSize: 17, marginBottom: 6 }}>{s.t}</h3>
            <p className="small muted">{s.d}</p>
          </div>
        ))}
      </div>
      <div className="grid-2 mt-24">
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 17 }}>For tenants</h3>
          <p className="small muted mt-8">Find a suitable room, ask questions before committing, request a visit and keep all booking updates in one place.</p>
          <Link to="/login" className="btn btn-primary btn-sm mt-16">Start as Tenant</Link>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 17 }}>For PG owners</h3>
          <p className="small muted mt-8">Complete verification, publish accurate listings, manage rooms and respond to tenant requests from your owner dashboard.</p>
          <Link to="/register?role=owner" className="btn btn-outline btn-sm mt-16">List Your PG</Link>
        </div>
      </div>
      <div className="card mt-24" style={{ padding: 24, background: "var(--brand-50)" }}>
        <h3 style={{ fontSize: 17 }}>Built around trust</h3>
        <p className="small muted mt-8">Owner verification, listing moderation, clear status labels, direct communication and review eligibility help both sides make better decisions. Always inspect a property and confirm final rental terms before moving in.</p>
      </div>
    </div>
  );
}

export function ForOwners() {
  const toast = useToast();
  return (
    <div className="page page-tight container">
      <div className="card mb-24" style={{ background: "linear-gradient(120deg, #042f2e, #0f766e)", border: "none", padding: "44px 36px", color: "#fff" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff" }}>Own a PG? Fill your rooms faster.</h1>
        <p style={{ opacity: .85, maxWidth: 560, marginTop: 8 }}>List your property in minutes, receive real-time booking requests, enquiries and visit requests, and manage everything from a single dashboard.</p>
        <div className="flex mt-16">
          <Link to="/register?role=owner" className="btn btn-white btn-lg">List Your PG Free</Link>
          <Link to="/how-it-works" className="btn btn-ghost btn-lg" style={{ color: "#fff" }}>How it works</Link>
        </div>
      </div>
      <div className="pg-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {[
          { ic: <BadgeCheck size={22} />, t: "Admin verification", d: "Owners are verified by our team so tenants can trust your listing." },
          { ic: <Building2 size={22} />, t: "Multiple properties", d: "Add and manage unlimited PG properties from one dashboard." },
          { ic: <Search size={22} />, t: "Location-based discovery", d: "Your PG appears in geospatial searches near colleges, offices and transit." },
          { ic: <MessageSquare size={22} />, t: "Real-time communication", d: "Chat with tenants, reply to enquiries, accept visits — instantly." },
          { ic: <IndianRupee size={22} />, t: "Transparent pricing", d: "Set rent, deposit, food charges and maintenance clearly." },
          { ic: <BarChart3 size={22} />, t: "Analytics", d: "Track bookings, enquiries, ratings and demand by room type." },
        ].map((x) => (
          <div key={x.t} className="card trust-card">
            <div className="t-ic">{x.ic}</div><h4>{x.t}</h4><p>{x.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function About() {
  const principles = [
    { t: "Clarity before commitment", d: "We help people compare rent, deposits, room types, amenities, availability, location and reviews before they contact an owner." },
    { t: "Trust through accountability", d: "Owner verification, listing moderation, direct communication and status updates give both sides a clearer record of every request." },
    { t: "Useful local context", d: "Location-aware search and nearby facilities help tenants understand how a property fits their daily commute and routine." },
    { t: "A fair marketplace", d: "Owners get practical tools to manage rooms and requests, while tenants get a consistent way to discover and evaluate options." },
  ];
  return (
    <div className="page page-tight container" style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>About PG Finder</h1>
      <p className="muted mt-8" style={{ fontSize: 15 }}>
        PG Finder is an accommodation marketplace for students, working professionals and property owners.
        We make the move to a new city more manageable by bringing discovery, questions, visits, bookings and
        ongoing communication into one dependable place.
      </p>
      <div className="card mt-24" style={{ padding: 24, background: "var(--brand-50)" }}>
        <h3 style={{ fontSize: 18 }}>Why we built PG Finder</h3>
        <p className="small muted mt-8">Finding a place to stay often means switching between search pages, phone calls, messages and spreadsheets. PG Finder brings those steps together so tenants can make informed choices and owners can manage genuine interest without losing track of conversations.</p>
      </div>
      <h2 className="mt-24" style={{ fontSize: 21 }}>What we believe</h2>
      <div className="grid-2 mt-24">
        {principles.map((x) => (
          <div key={x.t} className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>{x.t}</h3>
            <p className="small muted">{x.d}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-24" style={{ fontSize: 21 }}>How PG Finder helps</h2>
      <div className="card mt-16" style={{ padding: 24 }}>
        <p className="small muted">Tenants can search by area, use location-aware discovery, compare listings, enquire, chat, request visits and submit booking requests. Owners can complete verification, add properties, manage rooms, respond to enquiries, handle visits and review booking activity from their dashboard.</p>
        <p className="small muted mt-12">Real-time updates keep both sides informed when a request is created, accepted, rejected, rescheduled or completed. Notification preferences, privacy controls and clear account roles keep the experience focused and understandable.</p>
      </div>
      <div className="flex mt-24" style={{ justifyContent: "center" }}>
        <Link to="/how-it-works" className="btn btn-primary">See how it works</Link>
        <Link to="/contact" className="btn btn-outline">Contact us</Link>
      </div>
    </div>
  );
}

export function Contact() {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return toast.error("Fill all fields");
    toast.success("Message sent!", "Our team will get back to you within 24 hours.");
    setForm({ name: "", email: "", message: "" });
  };
  return (
    <div className="page page-tight container" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>Contact Us</h1>
      <p className="muted mb-24">Questions, feedback or support — we'd love to hear from you.</p>
      <div className="card" style={{ padding: 26 }}>
        <form onSubmit={submit}>
          <div className="grid-2">
            <div className="field"><label>Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="field"><label>Message</label><textarea className="textarea" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <button className="btn btn-primary btn-lg">Send Message</button>
        </form>
      </div>
      <div className="grid-2 mt-24">
        <div className="card" style={{ padding: 18 }}><b>📍 Head Office</b><p className="small muted">PG Finder Technologies, Coimbatore, Tamil Nadu</p></div>
        <div className="card" style={{ padding: 18 }}><b>📧 Email</b><p className="small muted">support@pgfinder.local</p></div>
      </div>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <div className="page page-tight container" style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>Privacy Policy</h1>
      <p className="muted mt-8">Last updated: September 4, 2026</p>
      <LegalDocument sections={PRIVACY_SECTIONS} download={() => downloadLegalPdf("PG Finder Privacy Policy", PRIVACY_SECTIONS, "pg-finder-privacy-policy.pdf")} />
    </div>
  );
}

export function TermsAndConditions() {
  return (
    <div className="page page-tight container" style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>Terms &amp; Conditions</h1>
      <p className="muted mt-8">Last updated: September 4, 2026</p>
      <LegalDocument sections={TERMS_SECTIONS} download={() => downloadLegalPdf("PG Finder Terms & Conditions", TERMS_SECTIONS, "pg-finder-terms-and-conditions.pdf")} />
    </div>
  );
}

function LegalDocument({ sections, download }) {
  return (
    <div className="mt-24">
      <div className="flex-between mb-16">
        <span className="small muted">Please review this document carefully.</span>
        <button className="btn btn-primary" onClick={download}>Download PDF</button>
      </div>
      <div className="card" style={{ padding: 26 }}>
        {sections.map(({ heading, text }) => (
          <section key={heading} style={{ marginBottom: 22 }}>
            <h3 style={{ fontSize: 16 }}>{heading}</h3>
            <p className="small muted mt-8">{text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

export function LocationsPage() {
  const [locs, setLocs] = useState([]);
  useEffect(() => { api.get("/location/popular").then((r) => setLocs(r.data.data)).catch(() => {}); }, []);
  return (
    <div className="page page-tight container">
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>Popular Locations</h1>
      <p className="muted mb-24">Click a city to search live PG listings around it.</p>
      <div className="pg-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {locs.map((c) => (
          <Link key={c.name} to={`/find?lat=${c.lat}&lng=${c.lng}&radius=15&label=${encodeURIComponent(c.name)}`} className="card city-card" style={{ height: 130 }}>
            <div className="c-lbl"><b>{c.name}</b><small>{c.state}{c.pgCount ? ` · ${c.pgCount} PGs nearby` : ""}</small></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AmenitiesPage() {
  const [amens, setAmens] = useState([]);
  useEffect(() => { api.get("/amenities").then((r) => setAmens(r.data.data)).catch(() => {}); }, []);
  return (
    <div className="page page-tight container">
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>Amenities</h1>
      <p className="muted mb-24">Search PGs with the amenities that matter to you.</p>
      <div className="check-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {amens.map((a) => (
          <Link key={a.id} to={`/find?amenities=${encodeURIComponent(a.name)}`} className="chip-check" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{a.name}</span><Search size={14} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ComparePage() {
  const location = useLocationState();
  const [items, setItems] = useState(null);
  useEffect(() => {
    const ids = location.state?.ids || [];
    if (ids.length < 2) return;
    api.post("/pgs/compare", { ids }).then((r) => setItems(r.data.data)).catch((e) => toastError(e));
  }, [location.state]);
  if (!location.state?.ids?.length) {
    return (
      <div className="page page-tight container">
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Compare PGs</h1>
        <p className="muted mt-8">Select at least 2 PGs from the search results (use the "Compare" button on cards) to compare them side by side.</p>
        <Link to="/find" className="btn btn-primary mt-16">Go to Search</Link>
      </div>
    );
  }
  if (!items) return <div className="page page-tight container"><div className="skel" style={{ height: 300 }} /></div>;
  const rows = [
    { k: "Rent (from)", v: (p) => `₹${p.rent?.from?.toLocaleString("en-IN")}/mo` },
    { k: "Deposit", v: (p) => `₹${(p.deposit || 0).toLocaleString("en-IN")}` },
    { k: "Location", v: (p) => `${p.area || ""}, ${p.city}` },
    { k: "Distance", v: (p) => p.distanceText || "—" },
    { k: "Rating", v: (p) => `${p.rating?.average || "New"} (${p.rating?.count || 0})` },
    { k: "Gender", v: (p) => p.gender },
    { k: "Room Types", v: (p) => p.roomTypes?.join(", ") },
    { k: "Amenities", v: (p) => p.amenities?.join(", ") },
    { k: "Available Rooms", v: (p) => p.availableRooms ?? "—" },
  ];
  return (
    <div className="page page-tight container">
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Compare PGs</h1>
      <div className="table-wrap mt-16">
        <table className="tbl compare-table">
          <thead>
            <tr>
              <th></th>
              {items.map((p) => (
                <th key={p.id} style={{ textAlign: "center" }}>
                  <img src={p.images?.[0]} alt="" style={{ width: 150, height: 90, objectFit: "cover", borderRadius: 10, margin: "0 auto 8px" }} />
                  <Link to={`/pg/${p.id}`}>{p.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td>{r.k}</td>
                {items.map((p) => <td key={p.id}>{r.v(p)}</td>)}
              </tr>
            ))}
            <tr>
              <td></td>
              {items.map((p) => (
                <td key={p.id}><Link to={`/pg/${p.id}`} className="btn btn-primary btn-sm">View Details</Link></td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useLocation as useLocationState } from "react-router-dom";
function toastError(e) {  }
