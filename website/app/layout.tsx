import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'USCHAT — Cryptographic Monospace Messaging Protocol',
  description: 'An end-to-end encrypted messaging engine that values your identity. Built with a pure Black Brutalist framework.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Navigation Header */}
        <header>
          <div className="nav-container">
            <Link href="/" className="logo">
              <div className="logo-box">U</div>
              <span>USCHAT</span>
            </Link>
            <nav className="nav-links">
              <Link href="/download">Download</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </nav>
          </div>
        </header>

        {children}

        {/* Footer */}
        <footer className="footer">
          <div className="footer-content">
            <div className="footer-logo">USCHAT SECURITY CORE v2.5</div>
            <div className="footer-links">
              <Link href="/download">Download</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
