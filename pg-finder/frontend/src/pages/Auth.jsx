import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Home, ShieldCheck, Mail, Lock, User, Phone,
  Building2, ArrowRight, CheckCircle2, Sparkles, Eye, EyeOff,
  BadgeCheck, MessageSquare, MapPin, Sun, Moon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { errMsg } from "../api/client.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const LOGIN_ROLES = [
  { id: "tenant", label: "Tenant", icon: "🎒", dash: "/tenant/dashboard" },
  { id: "owner", label: "PG Owner", icon: "🏢", dash: "/owner/dashboard" },
  { id: "admin", label: "Admin", icon: "🛡️", dash: "/admin/dashboard" },
];
const roleLabel = (id) => (LOGIN_ROLES.find((r) => r.id === id) || {}).label || id;


export function LoginPage() {
  const { login, googleLogin, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);
  const [role, setRole] = useState("tenant");

  const goHome = (u) => {
    const from = location.state?.from;
    if (u.role === "admin") navigate("/admin/dashboard");
    else if (u.role === "owner") navigate(from || "/owner/dashboard");
    else navigate(from || "/tenant/dashboard");
  };

  const ensureRole = (u) => {
    if (u.role === role) return true;
    logout();
    toast.error("Role doesn't match this account", `This email belongs to a ${roleLabel(u.role)} account — choose "${roleLabel(u.role)}" above and try again.`);
    return false;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      if (!ensureRole(u)) return;
      toast.success(`Welcome back, ${u.name}!`);
      goHome(u);
    } catch (err) {
      toast.error("Login failed", errMsg(err));
    } finally { setBusy(false); }
  };

  const handleGoogle = async () => {
    if (role === "admin") {
      toast.info("Admins sign in with email & password", "Pick Tenant or PG Owner to continue with Google.");
      return;
    }
    setGBusy(true);
    try {
      if (!GOOGLE_CLIENT_ID) {
        toast.error("Google sign-in is not configured", "Set VITE_GOOGLE_CLIENT_ID in frontend/.env and restart the frontend.");
        return;
      }
      const loaded = await loadGoogleScript();
      if (!loaded) { toast.error("Could not load Google sign-in", "Check your connection and try again."); return; }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        use_fedcm_for_prompt: false,
        callback: async (resp) => {
          try {
            const u = await googleLogin({ idToken: resp.credential, role });
            if (!ensureRole(u)) return;
            toast.success(`Welcome, ${u.name}!`);
            goHome(u);
          } catch (err) { toast.error("Google login failed", errMsg(err)); }
        },
      });
      window.google.accounts.id.prompt();
    } finally { setGBusy(false); }
  };
  return (
    <AuthShell title="Welcome back" sub="Login to manage your bookings, PGs and messages.">
      {location.search.includes("expired") && (
        <div className="auth3-notice">
          <Sparkles size={15} />
          Your session expired. Please login again.
        </div>
      )}

      {}
      <div className="auth3-toprole login-roles" role="radiogroup" aria-label="Account type">
        {LOGIN_ROLES.map((r) => (
          <button key={r.id} type="button" className={role === r.id ? "active" : ""} onClick={() => setRole(r.id)}>
            <span className="auth3-toprole-ic">{r.icon}</span> {r.label}
          </button>
        ))}
      </div>
      <p className="auth3-rolehint">Choose the type of account you're signing in with</p>

      <form onSubmit={submit} className="auth3-form">
        <div className="auth3-field">
          <label>Email address</label>
          <div className="auth3-input">
            <Mail size={17} />
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" />
          </div>
        </div>
        <div className="auth3-field">
          <label>Password</label>
          <div className="auth3-input">
            <Lock size={17} />
            <input type={showPw ? "text" : "password"} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete="current-password" />
            <button type="button" className="auth3-eye" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button className="auth3-submit" disabled={busy}>
          {busy ? "Logging in…" : "Login"} {!busy && <ArrowRight size={17} />}
        </button>
      </form>

      <div className="auth3-divider"><span>or continue with</span></div>
      <GoogleButton
        busy={gBusy}
        onCredential={async (resp) => {
          setGBusy(true);
          try {
            const u = await googleLogin({ idToken: resp.credential, role });
            if (!ensureRole(u)) return;
            toast.success(`Welcome, ${u.name}!`);
            goHome(u);
          } catch (err) { toast.error("Google login failed", errMsg(err)); }
          finally { setGBusy(false); }
        }}
      />

      <p className="auth3-alt">
        New to PG Finder? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}


export function RegisterPage() {
  const { register, googleLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [role, setRole] = useState("tenant");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", businessName: "" });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);

  const goHome = (u) => {
    if (u.role === "admin") navigate("/admin/dashboard");
    else if (u.role === "owner") navigate("/owner/dashboard");
    else navigate("/tenant/dashboard");
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await register({ ...form, role });
      toast.success("Account created!", `Welcome to PG Finder, ${u.name}`);
      goHome(u);
    } catch (err) {
      toast.error("Registration failed", errMsg(err));
    } finally { setBusy(false); }
  };

  const ensureRole = (u) => {
    if (u.role === role) return true;
    toast.error("Role doesn't match this account", `This Google account belongs to a ${roleLabel(u.role)} account — choose the matching role above.`);
    return false;
  };

  const handleGoogle = async () => {
    if (role === "admin") {
      toast.info("Admins sign in with email & password", "Pick Tenant or PG Owner to continue with Google.");
      return;
    }
    setGBusy(true);
    try {
      if (!GOOGLE_CLIENT_ID) {
        toast.error("Google sign-up is not configured", "Set VITE_GOOGLE_CLIENT_ID in frontend/.env and restart the frontend.");
        return;
      }
      const loaded = await loadGoogleScript();
      if (!loaded) { toast.error("Could not load Google sign-in", "Check your connection and try again."); return; }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        use_fedcm_for_prompt: false,
        callback: async (resp) => {
          try {
            const u = await googleLogin({ idToken: resp.credential, role });
            if (!ensureRole(u)) return;
            toast.success(`Welcome, ${u.name}!`);
            goHome(u);
          } catch (err) { toast.error("Google login failed", errMsg(err)); }
        },
      });
      window.google.accounts.id.prompt();
    } finally { setGBusy(false); }
  };

  return (
    <AuthShell
      title={role === "tenant" ? "Create your account" : role === "owner" ? "Register as a PG owner" : "Create an admin account"}
      sub={role === "tenant"
        ? "Join thousands of tenants finding their perfect PG."
        : role === "owner"
          ? "List your properties and fill rooms faster."
          : "Manage PG listings, users and platform operations."}
      wide
    >
      {}
      <div className="auth3-toprole reg-roles" role="radiogroup" aria-label="Account type">
        {[{ id: "tenant", label: "I'm a Tenant", icon: "🎒" },
          { id: "owner", label: "I'm a PG Owner", icon: "🏢" },
          { id: "admin", label: "I'm an Admin", icon: "🛡️" }].map((r) => (
          <button key={r.id} type="button" className={role === r.id ? "active" : ""} onClick={() => setRole(r.id)}>
            <span className="auth3-toprole-ic">{r.icon}</span> {r.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="auth3-form">
        <div className="auth3-field">
          <label>Full name</label>
          <div className="auth3-input">
            <User size={17} />
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" autoComplete="name" />
          </div>
        </div>

        {role === "owner" && (
          <div className="auth3-field">
            <label>Business / PG name</label>
            <div className="auth3-input">
              <Building2 size={17} />
              <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="e.g. Sri Balaji PG" />
            </div>
          </div>
        )}

        <div className="auth3-row">
          <div className="auth3-field">
            <label>Email address</label>
            <div className="auth3-input">
              <Mail size={17} />
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" />
            </div>
          </div>
          <div className="auth3-field">
            <label>Phone</label>
            <div className="auth3-input">
              <Phone size={17} />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" autoComplete="tel" />
            </div>
          </div>
        </div>

        <div className="auth3-field">
          <label>Password <span className="auth3-hint">(min 6 characters)</span></label>
          <div className="auth3-input">
            <Lock size={17} />
            <input type={showPw ? "text" : "password"} required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete="new-password" />
            <button type="button" className="auth3-eye" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button className="auth3-submit" disabled={busy}>
          {busy ? "Creating account…" : "Get Started"} {!busy && <ArrowRight size={17} />}
        </button>
      </form>

      {role === "owner" && (
        <div className="auth3-note">
          <ShieldCheck size={14} />
          Owners must be verified by admin before publishing listings.
        </div>
      )}

      {}
      <div className="auth3-divider"><span>or sign up with</span></div>
      <GoogleButton
        busy={gBusy}
        label="Sign up with Google"
        onCredential={async (resp) => {
          setGBusy(true);
          try {
            const u = await googleLogin({ idToken: resp.credential, role });
            if (!ensureRole(u)) return;
            toast.success(`Welcome, ${u.name}!`);
            goHome(u);
          } catch (err) { toast.error("Google sign-up failed", errMsg(err)); }
          finally { setGBusy(false); }
        }}
      />

      <p className="auth3-alt">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </AuthShell>
  );
}


function GoogleButton({ onCredential, busy, label = "Continue with Google" }) {
  const buttonRef = useRef(null);
  const credentialRef = useRef(onCredential);
  credentialRef.current = onCredential;

  useEffect(() => {
    let cancelled = false;
    loadGoogleScript().then((loaded) => {
      if (!loaded || cancelled || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => credentialRef.current(response),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: label === "Sign up with Google" ? "signup_with" : "signin_with",
        shape: "rectangular",
        width: 375,
      });
    });
    return () => { cancelled = true; if (buttonRef.current) buttonRef.current.replaceChildren(); };
  }, [label]);

  return (
    <div className="auth3-google-wrap">
      {busy && <span className="auth3-google-loading">Connecting…</span>}
      <div ref={buttonRef} aria-label={label} style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }} />
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}

function loadGoogleScript() {
  return new Promise((resolve) => {
    if (window.google?.accounts) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}


function AuthShell({ title, sub, children, wide }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className={`auth3 auth4 ${isLight ? "auth3-light" : ""}`}>
      {}
      <aside className="auth4-brand">
        <div className="auth4-deco" aria-hidden="true"><span className="a4d a4d-1" /><span className="a4d a4d-2" /><span className="a4d a4d-3" /><span className="a4d a4d-4" /></div>
        <Link to="/" className="auth4-brand-head" title="PG Finder home">
          <span className="auth3-logo-mark"><Home size={19} /></span>
          <b>PG&nbsp;Finder</b>
        </Link>

        <div className="auth4-mid">
          <span className="auth4-eyebrow"><Sparkles size={13} /> Tenants &amp; owners, connected</span>
          <h1>Your next home is <span className="auth4-grad">one search</span> away.</h1>
          <p className="auth4-sub">Verified PGs with real photos and honest rents. Shortlist, book visits, chat with owners — all in one place.</p>

          <ul className="auth4-points">
            <li>
              <span className="auth4-ic"><MapPin size={16} /></span>
              <div><b>Search near you</b><small>Filter by area, budget, gender &amp; food</small></div>
            </li>
            <li>
              <span className="auth4-ic"><ShieldCheck size={16} /></span>
              <div><b>Verified listings</b><small>Owners are verified before they publish</small></div>
            </li>
            <li>
              <span className="auth4-ic"><MessageSquare size={16} /></span>
              <div><b>Talk in real time</b><small>Chat with owners &amp; book visits instantly</small></div>
            </li>
          </ul>

          <div className="auth4-showcase" aria-hidden="true">
            <div className="auth4-mock auth4-mock-pg">
              <span className="auth4-mock-thumb" />
              <span className="auth4-mock-body">
                <b>Single sharing room</b>
                <small>Porur · from ₹5,000/mo</small>
              </span>
              <span className="auth4-mock-badge">Open</span>
            </div>
            <div className="auth4-mock auth4-mock-ok">
              <CheckCircle2 size={15} /> Visit booked · Sat 4:00 PM
            </div>
            <div className="auth4-mock auth4-mock-chat">
              <span className="auth4-bubble">Hi! The AC room is free for a visit tomorrow 😊</span>
            </div>
          </div>
        </div>

        <div className="auth4-trust">
          <span><ShieldCheck size={13} /> Secure &amp; verified</span>
          <span><BadgeCheck size={13} /> 10,000+ tenants</span>
          <span><MessageSquare size={13} /> Real-time chat</span>
        </div>
      </aside>

      {}
      <main className="auth4-side">
        <div className="auth4-side-deco" aria-hidden="true"><span className="a4o a4o-1" /><span className="a4o a4o-2" /><span className="a4o a4o-3" /></div>
        <button
          type="button"
          className="auth3-theme"
          onClick={toggleTheme}
          title={isLight ? "Switch to dark theme" : "Switch to light theme"}
          aria-label="Toggle color theme"
        >
          {isLight ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <div className="auth4-scroll">
          <div className={`auth3-card ${wide ? "auth3-card-wide" : ""}`}>
            <Link to="/" className="auth4-mlogo" title="PG Finder home">
              <span className="auth3-logo-mark"><Home size={18} /></span>
              <b>PG&nbsp;Finder</b>
            </Link>

            <div className="auth3-head">
              <h2>{title}</h2>
              <p>{sub}</p>
            </div>

            {children}
          </div>

          <div className="auth4-trust auth4-trust-mobile">
            <span><ShieldCheck size={13} /> Secure &amp; verified</span>
            <span><BadgeCheck size={13} /> 10,000+ tenants</span>
            <span><MessageSquare size={13} /> Real-time chat</span>
          </div>
        </div>
      </main>
    </div>
  );
}
