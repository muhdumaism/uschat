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
        '> establishing local sqlite container key...',
        '> session decryption active. connection stable.'
      ]);
      setLoading(false);
    }, 1200);
  };

  return (
    <main>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-text">
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

      {/* Features Grid */}
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
    </main>
  );
}
