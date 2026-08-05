'use client';

import React from 'react';

export default function DownloadPage() {
  const triggerAlert = (fileName: string) => {
    alert(`DOWNLOAD COMMENCING: ${fileName}`);
  };

  return (
    <main>
      <div className="page-wrapper" style={{ textAlign: 'center' }}>
        <h1>GET CLIENT TERMINAL APP</h1>
        <p>DOWNLOAD THE COMPILED CLIENT BINARY FOR YOUR SYSTEM NODE.</p>

        <div style={{ maxWidth: '400px', margin: '40px auto 0 auto' }}>
          <div className="brutalist-card download-card">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <img src="/uschat-trans.png" alt="USCHAT logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
            </div>
            <h3>ANDROID MOBILE CLIENT</h3>
            <p style={{ marginBottom: '24px', color: '#A1A1AA', fontSize: '13px', fontWeight: '700', letterSpacing: '1px' }}>
              APK COMPILE v1.0.0 (ARM64)
            </p>
            <button 
              onClick={() => triggerAlert('USCHAT_1.0.0_ARM64.apk')} 
              className="brutalist-btn" 
              style={{ width: '100%', cursor: 'pointer' }}
            >
              DOWNLOAD APK FILE
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
