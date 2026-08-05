import React from 'react';

export default function PrivacyPage() {
  return (
    <main>
      <div className="page-wrapper">
        <h1>PRIVACY POLICY PROTOCOL</h1>
        <p>LAST REVISED: AUGUST 5, 2026</p>
        
        <h2>1. DATA COLLECTION NULLITY</h2>
        <p>The USCHAT routing architecture is designed with metadata minimization as a hard constraint. No profile databases hold unencrypted messaging payloads. Since handles do not require cellular telephone registration, there is no mapping between offline identities and cryptographic endpoints.</p>

        <h2>2. CRYPTOGRAPHIC KEY REGISTRY</h2>
        <p>All pre-keys, identity keys, and ratcheting keys are generated locally on client terminals. The cloud database acts as an asynchronous key distribution server (Signal Pre-Key Bundle distribution). Server operators cannot access private session keys.</p>

        <h2>3. MEDIA TRANSFERS</h2>
        <p>Images and documents are stored as AES-256 encrypted blobs inside server directories. The decryption keys are never transmitted to the host and remain solely within the client message logs.</p>

        <h2>4. WEBRTC COMMUNICATIONS</h2>
        <p>Voice and Video calls utilize direct peer connection streams. IP exchange occurs only during standard SDP/ICE handshake protocols. No audio or video data payload is ever routed or archived by the server daemon.</p>
      </div>
    </main>
  );
}
