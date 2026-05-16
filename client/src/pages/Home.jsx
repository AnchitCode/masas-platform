import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, CheckCircle2, Navigation, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';

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
      {/* Hero Section */}
      <section style={{ backgroundColor: 'var(--green-50)', padding: '80px 24px', textAlign: 'center' }}>
        <div className="mx-auto" style={{ maxWidth: 800 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: 'white', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: 'var(--green-700)', boxShadow: 'var(--shadow-sm)', marginBottom: 24 }}>
            <MapPin style={{ width: 14, height: 14 }} />
            Live medicine availability near you
          </div>
          
          <h1 style={{ fontSize: 48, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, marginBottom: 24, letterSpacing: '-0.02em' }}>
            Find medicines at <span style={{ color: 'var(--green-600)' }}>nearby pharmacies</span> instantly
          </h1>
          
          <p style={{ fontSize: 18, color: 'var(--slate-600)', maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.5 }}>
            Don't waste time visiting multiple stores. Search for your prescription and see exactly who has it in stock right now.
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', maxWidth: 500, margin: '0 auto', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <Search style={{ width: 20, height: 20, color: 'var(--muted)' }} />
              </div>
              <input
                type="text"
                placeholder="Enter medicine name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: 56,
                  padding: '0 16px 0 48px',
                  fontSize: 16,
                  border: '2px solid var(--green-200)',
                  borderRadius: 12,
                  outline: 'none',
                  backgroundColor: 'white',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--green-500)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--green-200)'}
              />
            </div>
            <Button type="submit" size="lg" style={{ height: 56, padding: '0 32px', fontSize: 16, borderRadius: 12 }}>
              Search
            </Button>
          </form>
          
          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 16 }}>
            Searching across verified pharmacies in your city
          </p>
        </div>
      </section>

      {/* Stats Row */}
      <section style={{ backgroundColor: 'white', padding: '40px 24px', borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto" style={{ maxWidth: 1000, display: 'flex', justifyContent: 'center', gap: 64, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>1,200+</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>Verified pharmacies</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>50,000+</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>Medicines tracked</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>&lt; 2s</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>Search time</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="page-bg" style={{ padding: '80px 24px' }}>
        <div className="mx-auto" style={{ maxWidth: 1000 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            <div className="card" style={{ padding: 32 }}>
              <div style={{ width: 48, height: 48, backgroundColor: 'var(--green-100)', color: 'var(--green-600)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <Navigation style={{ width: 24, height: 24 }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Location-based search</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>Find the closest pharmacies to your current location that have exactly what you need in stock.</p>
            </div>

            <div className="card" style={{ padding: 32 }}>
              <div style={{ width: 48, height: 48, backgroundColor: 'var(--green-100)', color: 'var(--green-600)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <CheckCircle2 style={{ width: 24, height: 24 }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Live stock status</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>Our system integrates directly with pharmacy inventory systems to provide real-time availability.</p>
            </div>

            <div className="card" style={{ padding: 32 }}>
              <div style={{ width: 48, height: 48, backgroundColor: 'var(--green-100)', color: 'var(--green-600)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <ShieldCheck style={{ width: 24, height: 24 }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Verified only</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>Every pharmacy on our platform is strictly vetted and verified to ensure your safety and security.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ backgroundColor: 'white', padding: '80px 24px' }}>
        <div className="mx-auto" style={{ maxWidth: 800, textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 48 }}>How it works</h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 24, left: 0, right: 0, height: 2, backgroundColor: 'var(--green-100)', zIndex: 0 }} />
            
            {[
              { num: 1, title: 'Search', desc: 'Type your medicine name' },
              { num: 2, title: 'Locate', desc: 'Find nearby pharmacies with stock' },
              { num: 3, title: 'Pickup', desc: 'Get directions and pick it up' }
            ].map((step) => (
              <div key={step.num} style={{ position: 'relative', zIndex: 1, backgroundColor: 'white', padding: '0 16px' }}>
                <div style={{ width: 48, height: 48, backgroundColor: 'var(--green-600)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, margin: '0 auto 16px' }}>
                  {step.num}
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{step.title}</h4>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
