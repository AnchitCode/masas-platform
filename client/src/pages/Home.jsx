import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Navigation,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Eye,
  AlertTriangle,
  ShieldCheck as Shield,
  BarChart3,
  Users,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import MasasLogo from '../components/ui/MasasLogo';

/* ─────────────────── Scroll reveal hook ─────────────────── */
function useScrollReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function RevealSection({ children, className = '', delay = '' }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`animate-on-scroll ${delay} ${className}`}>
      {children}
    </div>
  );
}

/* ─────────────────── Main component ─────────────────── */
export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="flex flex-col">

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="hero-section">
        <div className="mx-auto" style={{ maxWidth: 800 }}>
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Real-time medicine availability
          </div>

          <h1 className="hero-title">
            Find any medicine near you —{' '}
            <span className="hero-title-accent">in seconds</span>
          </h1>

          <p className="hero-sub">
            Stop visiting pharmacy after pharmacy. Search once and see exactly who has your
            prescription in stock, with real-time availability from verified pharmacies nearby.
          </p>

          <form onSubmit={handleSearch} className="hero-search">
            <div style={{ position: 'relative', flex: 1 }}>
              <Search className="hero-search-icon" />
              <input
                type="text"
                className="hero-search-input w-full"
                placeholder="Search any medicine name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              style={{ height: 56, padding: '0 32px', fontSize: 16, borderRadius: 14 }}
            >
              Search
            </Button>
          </form>

          <p className="hero-hint">
            Search across verified pharmacies in your city
          </p>
        </div>
      </section>

      {/* ═══════════════ STATS BAR ═══════════════ */}
      <section className="stats-bar">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">1,200+</div>
            <div className="stat-label">Verified pharmacies</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">50,000+</div>
            <div className="stat-label">Medicines tracked</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">&lt; 2s</div>
            <div className="stat-label">Avg. search time</div>
          </div>
        </div>
      </section>

      {/* ═══════════════ WHY MASAS EXISTS ═══════════════ */}
      <section className="story-section" id="about-section">
        <div className="story-inner">
          <RevealSection>
            <h2 className="story-heading">
              Every minute matters when you need medicine
            </h2>
            <p className="story-sub">
              Across India, patients and caregivers waste hours searching for essential medicines.
              Pharmacies operate in silos with no shared visibility. MASAS was built to fix this.
            </p>
          </RevealSection>

          <div className="story-grid">
            <RevealSection delay="animate-delay-1">
              <div className="story-card">
                <div className="story-card-icon">
                  <Clock style={{ width: 20, height: 20 }} />
                </div>
                <h3 className="story-card-title">Hours wasted searching</h3>
                <p className="story-card-desc">
                  Patients visit 3–5 pharmacies on average before finding their prescription.
                  Every extra trip costs time, money, and energy — especially during emergencies.
                </p>
              </div>
            </RevealSection>

            <RevealSection delay="animate-delay-2">
              <div className="story-card">
                <div className="story-card-icon">
                  <Eye style={{ width: 20, height: 20 }} />
                </div>
                <h3 className="story-card-title">No inventory visibility</h3>
                <p className="story-card-desc">
                  Pharmacies manage stock independently. There's no connected system to check
                  availability across stores — leaving patients guessing.
                </p>
              </div>
            </RevealSection>

            <RevealSection delay="animate-delay-3">
              <div className="story-card">
                <div className="story-card-icon">
                  <AlertTriangle style={{ width: 20, height: 20 }} />
                </div>
                <h3 className="story-card-title">Emergency medicine gaps</h3>
                <p className="story-card-desc">
                  Critical and rare medicines are hardest to find. Shortage situations create
                  real health risks when patients can't locate what they need fast.
                </p>
              </div>
            </RevealSection>
          </div>

          <RevealSection>
            <p className="story-resolution">
              <strong>MASAS bridges this gap</strong> by connecting pharmacy inventory
              systems into a single real-time search layer. Patients find medicines instantly.
              Pharmacies gain visibility. The healthcare supply chain becomes smarter.
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section className="features-section">
        <div className="features-grid">
          <RevealSection delay="animate-delay-1">
            <div className="feature-card">
              <div className="feature-icon">
                <Navigation style={{ width: 24, height: 24 }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                Location-based search
              </h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
                Find the closest pharmacies to your current location that have exactly what
                you need in stock. Sorted by distance for maximum convenience.
              </p>
            </div>
          </RevealSection>

          <RevealSection delay="animate-delay-2">
            <div className="feature-card">
              <div className="feature-icon">
                <CheckCircle2 style={{ width: 24, height: 24 }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                Live stock status
              </h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
                Real-time inventory integration means you see what's actually available right now —
                not stale data from last week. Updated as pharmacies manage stock.
              </p>
            </div>
          </RevealSection>

          <RevealSection delay="animate-delay-3">
            <div className="feature-card">
              <div className="feature-icon">
                <ShieldCheck style={{ width: 24, height: 24 }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                Verified pharmacies only
              </h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
                Every pharmacy on the platform goes through admin verification before appearing
                in search results. Your safety is our baseline, not an afterthought.
              </p>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="how-section">
        <div className="how-inner">
          <RevealSection>
            <h2 className="section-heading" style={{ marginBottom: 8 }}>
              How it works
            </h2>
            <p style={{ fontSize: 15, color: 'var(--muted)' }}>
              Three steps to find any medicine near you
            </p>
          </RevealSection>

          <div className="how-steps">
            <div className="how-line" />

            {[
              { num: 1, title: 'Search', desc: 'Type any medicine or prescription name' },
              { num: 2, title: 'Locate', desc: 'See nearby pharmacies with verified stock' },
              { num: 3, title: 'Pickup', desc: 'Get directions and pick up your medicine' },
            ].map((step) => (
              <div key={step.num} className="how-step">
                <div className="how-step-num">{step.num}</div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {step.title}
                </h4>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FOR ADMINS ═══════════════ */}
      <section className="admin-section" id="admin-section">
        <div className="admin-inner">
          <RevealSection>
            <div className="admin-badge">
              <Shield style={{ width: 13, height: 13 }} />
              Platform Administration
            </div>
            <h2 className="section-heading" style={{ marginBottom: 12 }}>
              For platform administrators
            </h2>
            <p style={{ fontSize: 15, color: 'var(--muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
              MASAS includes a full admin dashboard for managing pharmacy registrations,
              verifying credentials, and monitoring platform health.
            </p>

            <div className="admin-features">
              <div className="admin-feature">
                <ClipboardCheck className="admin-feature-icon" />
                Pharmacy verification
              </div>
              <div className="admin-feature">
                <BarChart3 className="admin-feature-icon" />
                Platform analytics
              </div>
              <div className="admin-feature">
                <Users className="admin-feature-icon" />
                User management
              </div>
            </div>

            <Button
              variant="secondary"
              rightIcon={ArrowRight}
              onClick={() => navigate('/login')}
              style={{ marginTop: 8 }}
            >
              Sign in as admin
            </Button>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════ FOOTER CTA ═══════════════ */}
      <section className="footer-cta">
        <div className="footer-cta-inner">
          <RevealSection>
            <MasasLogo size={40} variant="white" style={{ margin: '0 auto 24px' }} />
            <h2>Ready to list your pharmacy?</h2>
            <p>
              Join the MASAS network and make your medicines discoverable to thousands of
              patients searching for prescriptions nearby.
            </p>
            <button className="btn" onClick={() => navigate('/register')}>
              Register your pharmacy
            </button>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
