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

        <div className="download-grid">
          <div className="brutalist-card download-card">
            <h3>ANDROID MOBILE</h3>
            <p style={{ marginBottom: '20px', color: '#A1A1AA', fontSize: '13px' }}>APK COMPILE v2.5.0</p>
            <button 
              onClick={() => triggerAlert('USCHAT_2.5.0_ARM64.apk')} 
              className="brutalist-btn" 
              style={{ width: '100%', cursor: 'pointer' }}
            >
              GET APK
            </button>
          </div>
          <div className="brutalist-card download-card">
            <h3>DESKTOP LINUX</h3>
            <p style={{ marginBottom: '20px', color: '#A1A1AA', fontSize: '13px' }}>APPIMAGE COMPILE v2.5.0</p>
            <button 
              onClick={() => triggerAlert('USCHAT_2.5.0_x86_64.AppImage')} 
              className="brutalist-btn secondary" 
              style={{ width: '100%', cursor: 'pointer' }}
            >
              GET APPIMAGE
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
