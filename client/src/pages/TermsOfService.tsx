import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import logoUrl from '../assets/logo.jpg';

export default function TermsOfService() {
  return (
    <div className="page-bg" style={{ minHeight: 'calc(100vh - var(--navbar-height))', padding: '48px 16px' }}>
      <div style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <img src={logoUrl} alt="MASAS Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
        </div>

        <div className="card" style={{ padding: '48px 40px' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Terms of Service</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 32 }}>Last updated: July 2026</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>1. Acceptance of Terms</h2>
              <p>
                By accessing or using MASAS (Medicine Availability &amp; Shortage Alert System), you agree to be bound by these Terms of Service. 
                If you do not agree with any part of these terms, you may not use our platform.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>2. Description of Service</h2>
              <p>
                MASAS is a platform that connects pharmacies with customers by providing real-time medicine availability information. 
                Pharmacies can register, manage their inventory, and make their stock visible to the public. 
                The platform does not facilitate the direct sale or delivery of medicines.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>3. User Accounts</h2>
              <p>
                To use certain features, you must create an account and provide accurate, complete, and current information. 
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. 
                You agree to notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>4. Pharmacy Obligations</h2>
              <p>
                Pharmacies registering on MASAS represent and warrant that they hold valid pharmacy licenses and 
                are authorized to operate in their jurisdiction. Pharmacies are responsible for the accuracy of their 
                inventory data, including medicine availability, pricing, and expiry dates. MASAS does not guarantee 
                the accuracy of pharmacy-provided information.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>5. Verification Process</h2>
              <p>
                All pharmacy accounts are subject to a verification process by MASAS administrators. 
                Pharmacy profiles will remain in a &quot;Pending&quot; status until verified. MASAS reserves the right 
                to reject or revoke verification at any time for any reason, including but not limited to 
                providing false information or violating these terms.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>6. Prohibited Conduct</h2>
              <p>Users may not:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li>Provide false or misleading information</li>
                <li>Use the platform for any illegal purpose</li>
                <li>Attempt to gain unauthorized access to other accounts or systems</li>
                <li>Interfere with or disrupt the platform&apos;s operation</li>
                <li>Scrape, harvest, or collect data from the platform without authorization</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>7. Limitation of Liability</h2>
              <p>
                MASAS is provided &quot;as is&quot; without warranties of any kind. We are not liable for any 
                indirect, incidental, special, or consequential damages arising from your use of the platform. 
                MASAS does not provide medical advice and is not responsible for decisions made based on 
                information displayed on the platform.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>8. Modifications</h2>
              <p>
                We reserve the right to modify these terms at any time. Continued use of the platform after 
                changes constitutes acceptance of the modified terms. We will notify registered users of 
                significant changes via email.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>9. Contact</h2>
              <p>
                For questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:support@masas.com" style={{ color: 'var(--green-600)', fontWeight: 500 }}>
                  support@masas.com
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
