import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import logoUrl from '../assets/logo.jpg';

export default function PrivacyPolicy() {
  return (
    <div className="page-bg" style={{ minHeight: 'calc(100vh - var(--navbar-height))', padding: '48px 16px' }}>
      <div style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <img src={logoUrl} alt="MASAS Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
        </div>

        <div className="card" style={{ padding: '48px 40px' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 32 }}>Last updated: July 2026</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>1. Information We Collect</h2>
              <p>We collect the following types of information:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li><strong>Account information:</strong> name, email address, and password (hashed)</li>
                <li><strong>Pharmacy details:</strong> pharmacy name, license number, address, phone number, and location coordinates</li>
                <li><strong>Inventory data:</strong> medicine availability, pricing, and stock information</li>
                <li><strong>Google account data:</strong> if you sign in with Google, we receive your name, email, and profile picture</li>
                <li><strong>Usage data:</strong> IP address, browser type, and authentication events for security purposes</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>2. How We Use Your Information</h2>
              <p>We use collected information to:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li>Provide and maintain the MASAS platform</li>
                <li>Verify pharmacy accounts and ensure legitimacy</li>
                <li>Display medicine availability to public users</li>
                <li>Send email notifications (verification, password reset)</li>
                <li>Monitor and improve platform security</li>
                <li>Communicate important updates about the service</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>3. Data Storage &amp; Security</h2>
              <p>
                Your data is stored on secure cloud infrastructure. Passwords are hashed using bcrypt and are never stored in plain text. 
                Verification and password reset tokens are stored as SHA-256 hashes. We use HTTPS for all data transmission 
                and implement industry-standard security practices including rate limiting, JWT-based authentication, and 
                httpOnly cookies for session management.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>4. Public Information</h2>
              <p>
                The following information is publicly visible when a pharmacy is verified: pharmacy name, address, 
                phone number, general location, and medicine inventory (availability, pricing). Your personal email 
                address and account details are not publicly displayed.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>5. Third-Party Services</h2>
              <p>
                We may use third-party services for:
              </p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li><strong>Google Authentication:</strong> for sign-in functionality (subject to Google&apos;s Privacy Policy)</li>
                <li><strong>Email delivery:</strong> for sending verification and notification emails</li>
                <li><strong>Cloud hosting:</strong> for data storage and application hosting</li>
              </ul>
              <p style={{ marginTop: 8 }}>
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>6. Data Retention</h2>
              <p>
                We retain your account data for as long as your account is active. Authentication audit logs are 
                retained for security monitoring purposes. You may request deletion of your account and associated 
                data by contacting us.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li>Access and review your personal information</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account</li>
                <li>Opt out of non-essential communications</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>8. Cookies</h2>
              <p>
                We use httpOnly cookies for session management (refresh tokens). These are essential for 
                the platform&apos;s authentication functionality and cannot be disabled. We do not use 
                tracking or advertising cookies.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify registered users of 
                significant changes via email. Continued use of the platform constitutes acceptance of 
                the updated policy.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>10. Contact</h2>
              <p>
                For privacy-related inquiries, please contact us at{' '}
                <a href="mailto:privacy@masas.com" style={{ color: 'var(--green-600)', fontWeight: 500 }}>
                  privacy@masas.com
                </a>.
              </p>
            </section>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link
            to="/register"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--green-600)', fontWeight: 500, textDecoration: 'none' }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to registration
          </Link>
        </div>
      </div>
    </div>
  );
}
