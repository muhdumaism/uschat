'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [logs, setLogs] = useState<string[]>([
    '> initializing signal protocol v3...',
    '> pre-keys registered: 100/100',
    '> channel E2EE active. status: SECURE.'
  ]);
  const [loading, setLoading] = useState(false);

  const handleSimulateHandshake = () => {
    setLoading(true);
    setLogs((prev) => [...prev, '> initiating client peer handshake...']);
    
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `> DH key agreement succeeded [Session ID: ${Math.random().toString(36).substring(7).toUpperCase()}]`,
        '> local container key verified.',
        '> session decryption active. connection stable.'
      ]);
      setLoading(false);
    }, 1000);
  };

  return (
    <main style={{ backgroundColor: '#000000' }}>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <img src="/uschat-trans.png" alt="USCHAT Symbol" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '24px', fontWeight: '900', border: '2px solid #ffffff', padding: '4px 10px' }}>v1.0.0</span>
          </div>
          <h1>SECURE ROUTING.<br />ZERO METADATA.</h1>
          <p>USCHAT is a contemporary, end-to-end encrypted messaging engine that values your identity above all. Built with a pure Black Brutalist framework and monospaced keys, it secures your communications from surveillance.</p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <Link href="/download" className="brutalist-btn">
              Get Client App
            </Link>
            <Link href="/privacy" className="brutalist-btn secondary">
              Privacy Protocol
            </Link>
          </div>
        </div>
        <div className="hero-preview">
          <h2>[CRYPTO_LOG_DAEMON]</h2>
          {logs.map((log, idx) => (
            <div key={idx} className="console-line">
              {log}
            </div>
          ))}
          <button 
            onClick={handleSimulateHandshake} 
            disabled={loading}
            className="brutalist-btn"
            style={{ 
              marginTop: '20px', 
              padding: '10px 20px', 
              fontSize: '11px', 
              borderWidth: '2px', 
              boxShadow: '3px 3px 0px #ffffff',
              width: '100%'
            }}
          >
            {loading ? 'CALCULATING DH KEYS...' : 'SIMULATE PEER HANDSHAKE'}
          </button>
        </div>
      </section>

      {/* Specifications Summary */}
      <section className="features">
        <h2 className="section-title">CORE SPECIFICATIONS</h2>
        <div className="features-grid">
          <div className="brutalist-card feature-card">
            <div className="feature-icon">E2</div>
            <h3>E2EE Messaging</h3>
            <p>USCHAT uses a customized implementation of the Signal Double Ratchet protocol. Your messages are encrypted on your device and can only be decrypted by the intended recipient.</p>
          </div>
          <div className="brutalist-card feature-card">
            <div className="feature-icon">VC</div>
            <h3>Secure Voice & Video</h3>
            <p>Real-time encrypted communication with direct peer-to-peer WebRTC handshakes. No calls flow through server relay networks once connection starts.</p>
          </div>
          <div className="brutalist-card feature-card">
            <div className="feature-icon">ZK</div>
            <h3>Zero Trackers</h3>
            <p>No phone numbers required, no contacts synced, and no telemetry collected. Your profile adjustments persist locally inside AsyncStorage.</p>
          </div>
        </div>
      </section>

      {/* Security Architecture Detail Section */}
      <section style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto', borderBottom: '4px solid #ffffff' }}>
        <h2 className="section-title" style={{ marginBottom: '20px' }}>SECURITY ARCHITECTURE</h2>
        <p style={{ color: '#a1a1aa', textAlign: 'center', marginBottom: '50px', fontSize: '16px', maxWidth: '700px', margin: '0 auto 50px auto' }}>
          Deep-dive technical details detailing the secure encryption protocols enforced by client-side application loops.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
          <div className="brutalist-card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '12px' }}>Double Ratchet Key Exchange</h4>
            <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
              Enforces perfect forward secrecy by ratcheting messaging keys on a per-message basis. Compromise of a single key reveals nothing about historical or future payloads.
            </p>
          </div>

          <div className="brutalist-card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '12px' }}>Direct WebRTC Dialing</h4>
            <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
              Voice and video dialing handshakes are resolved via client-to-client SDP/ICE negotiation. Relays are only used for peer discovery, ensuring streams bypass host storage completely.
            </p>
          </div>

          <div className="brutalist-card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '12px' }}>Sandboxed App State</h4>
            <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
              Session logs, credentials, and configuration profile keys are kept sandboxed locally. Deleting messages deletes their SQLite database record instantly.
            </p>
          </div>
        </div>
      </section>

      {/* Monospaced Audit Logs Section */}
      <section style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 className="section-title">INTEGRITY CHECKLIST</h2>
        <div className="brutalist-card" style={{ padding: '30px', backgroundColor: '#121212' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'Share Tech Mono, monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #555', paddingBottom: '8px' }}>
              <span>[SYSTEM_CHECK] DEPLOYMENT TARGET:</span>
              <span style={{ color: '#00FF66' }}>STABLE_v1.0.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #555', paddingBottom: '8px' }}>
              <span>[SECURITY] THIRD-PARTY RELAY NODES:</span>
              <span style={{ color: '#00FF66' }}>0% ENGAGED (ZERO TRUST)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #555', paddingBottom: '8px' }}>
              <span>[DATABASE] ENCRYPTED SQLITE AT REST:</span>
              <span style={{ color: '#00FF66' }}>ACTIVE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #555', paddingBottom: '8px' }}>
              <span>[METADATA] PROFILE PHONE / CONTACT SYNC:</span>
              <span style={{ color: '#FF0000' }}>DISABLED (PASSTHROUGH NULLITY)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #555', paddingBottom: '8px' }}>
              <span>[DIALING] P2P SHIELD CHANNEL SIGNALS:</span>
              <span style={{ color: '#00FF66' }}>100% OPERATIONAL</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
