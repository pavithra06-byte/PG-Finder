import { Link } from "react-router-dom";
import { Facebook, Home, Instagram, Linkedin, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="f-logo"><span className="logo-mark" style={{ width: 30, height: 30 }}><Home size={16} /></span> PG Finder</div>
          <p className="f-note">
            Find your perfect PG, wherever you go. Verified listings, transparent pricing,
            real reviews and direct owner communication — all in one place.
          </p>
        </div>
        <div>
          <h5>Explore</h5>
          <Link to="/login">Find PG</Link>
          <Link to="/locations">Popular Locations</Link>
          <Link to="/amenities">Amenities</Link>
          <Link to="/how-it-works">How It Works</Link>
        </div>
        <div>
          <h5>Company</h5>
          <Link to="/about">About Us</Link>
          <Link to="/for-owners">For PG Owners</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/register">Get Started</Link>
        </div>
        <div>
          <h5>Legal</h5>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
        </div>
        <div>
          <h5>Popular Cities</h5>
          <Link to="/login">Chennai</Link>
          <Link to="/login">Coimbatore</Link>
          <Link to="/login">Madurai</Link>
          <Link to="/login">Bangalore</Link>
        </div>
        <div className="footer-social">
          <h5>Connect with us</h5>
          <div className="footer-social-links">
            <a href="https://www.facebook.com" target="_blank" rel="noreferrer" aria-label="PG Finder on Facebook" title="Facebook"><Facebook size={17} /></a>
            <a href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="PG Finder on Instagram" title="Instagram"><Instagram size={17} /></a>
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="PG Finder on LinkedIn" title="LinkedIn"><Linkedin size={17} /></a>
            <a href="https://www.youtube.com" target="_blank" rel="noreferrer" aria-label="PG Finder on YouTube" title="YouTube"><Youtube size={17} /></a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} PG Finder.</div>
    </footer>
  );
}
