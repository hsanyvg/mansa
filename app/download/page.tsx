"use client";

import React, { useEffect } from 'react';

export default function DownloadRedirect() {
  useEffect(() => {
    // Redirect to the actual APK file in public folder
    setTimeout(() => {
      window.location.href = '/mansa-mobile.apk';
    }, 1000);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0c0c12',
      color: '#ffffff',
      fontFamily: 'Cairo, sans-serif',
      padding: '2rem',
      textAlign: 'center',
      direction: 'rtl'
    }}>
      <div style={{
        backgroundColor: 'rgba(30, 30, 45, 0.65)',
        padding: '3rem 2rem',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        maxWidth: '400px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
      }}>
        <span style={{ fontSize: '4rem', marginBottom: '1.5rem', display: 'block' }}>📥</span>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>جاري بدء تحميل التطبيق...</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
          يرجى الانتظار ثانية واحدة، سيقوم هاتفك بتحميل ملف الـ APK الخاص بتطبيق منسا موبايل تلقائياً.
        </p>
        
        <a 
          href="/mansa-mobile.apk" 
          download
          style={{
            display: 'inline-block',
            backgroundColor: '#8b5cf6',
            color: '#ffffff',
            padding: '0.8rem 1.5rem',
            borderRadius: '12px',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
            transition: 'background-color 0.2s'
          }}
        >
          اضغط هنا إذا لم يبدأ التحميل تلقائياً
        </a>
      </div>
    </div>
  );
}
