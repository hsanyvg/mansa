"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../lib/firebase";
import { doc, getDoc } from 'firebase/firestore';

export default function MobileDownloadPage() {
  const [localIp, setLocalIp] = useState<string>('localhost');
  const [loadingIp, setLoadingIp] = useState<boolean>(true);
  const [apkUrl, setApkUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    // 1. Fetch local network IP
    fetch('/api/local-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data.ip) {
          setLocalIp(data.ip);
        }
        setLoadingIp(false);
      })
      .catch((err) => {
        console.error("Failed to fetch local IP:", err);
        setLoadingIp(false);
      });

    // 2. Fetch direct APK URL from Firestore settings
    const fetchApkUrl = async () => {
      try {
        const docRef = doc(db, 'settings', 'mobile_app');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().apkUrl) {
          setApkUrl(docSnap.data().apkUrl);
        }
      } catch (err) {
        console.error("Error fetching APK URL from Firestore:", err);
      }
    };
    fetchApkUrl();
  }, []);

  // Fallback to local server download link if Firestore config is empty
  const activeApkUrl = apkUrl || `http://${localIp}:3000/download`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeApkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.centeredContent}>
        <header className={styles.headerCentered}>
          <h1 className={styles.titleCentered}>📱 تحميل تطبيق منسا موبايل</h1>
          <p className={styles.subtitleCentered}>
            امسح الباركود التالي مباشرة من كاميرا الهاتف لتنزيل وتثبيت التطبيق فوراً.
          </p>
        </header>

        {/* The Single Centerpiece Barcode Card */}
        <div className={styles.mainQrCard}>
          <div className={styles.qrWrapperWhite}>
            {loadingIp ? (
              <div className={styles.skeletonQr} />
            ) : (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(activeApkUrl)}&color=000000&bgcolor=ffffff`}
                alt="Direct Download Barcode"
                className={styles.largeQrImage}
              />
            )}
            <span className={styles.qrLabelLarge}>امسح الباركود للتحميل المباشر للهاتف</span>
          </div>

          {/* Copy URL Row below the barcode */}
          <div className={styles.copyLinkContainer}>
            <span className={styles.linkLabel}>رابط التحميل المباشر:</span>
            <div className={styles.urlInputRow}>
              <input 
                type="text" 
                readOnly 
                value={activeApkUrl} 
                className={styles.urlReadOnlyInput} 
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button 
                onClick={handleCopyLink} 
                className={copied ? styles.copyBtnSuccess : styles.copyBtn}
              >
                {copied ? 'تم النسخ! ✅' : 'نسخ الرابط 📋'}
              </button>
            </div>
          </div>

          {/* Simple download link button */}
          <div className={styles.linkSection}>
            <a 
              href={activeApkUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={styles.downloadLinkBtn}
            >
              📥 تحميل التطبيق للكمبيوتر مباشرة
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
