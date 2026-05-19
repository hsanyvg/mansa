"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function AlertsSettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [isActive, setIsActive] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(60);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'alerts_settings', 'cpo_alerts');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsActive(data.isActive || false);
          // Enforce 60 min minimum even if old data had less
          setIntervalMinutes(Math.max(60, data.intervalMinutes || 60));
        }
      } catch (err) {
        console.error("Error fetching alert settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (intervalMinutes < 60) {
      alert('الحد الأدنى المسموح به هو 60 دقيقة لتجنب حظر حساباتك الإعلانية من شركة ميتا.');
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, 'alerts_settings', 'cpo_alerts');
      await setDoc(docRef, {
        isActive,
        intervalMinutes: Number(intervalMinutes),
        updatedAt: new Date()
      });
      alert('تم حفظ إعدادات الأرشفة بنجاح!');
    } catch (err) {
      console.error("Error saving alert settings:", err);
      alert('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div style={{ color: 'white', padding: '2rem', textAlign: 'center' }}>جاري تحميل الإعدادات...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>🤖 إعدادات الأرشفة الآلية (CPO)</h1>
        <p className={styles.subtitle}>تكوين التوليد التلقائي لتقارير تكلفة الطلب وحفظها في الأرشيف الذكي</p>
      </header>

      <form onSubmit={handleSave}>
        <div className={styles.toggleContainer}>
          <div className={styles.toggleLabel}>
            <div className={styles.toggleTitle}>تفعيل الأرشفة الآلية</div>
            <div className={styles.toggleDesc}>عند التفعيل، سيقوم النظام بمراجعة الإعلانات وحفظ تقرير دوري في الأرشيف</div>
          </div>
          <label className={styles.switch}>
            <input 
              type="checkbox" 
              checked={isActive} 
              onChange={(e) => setIsActive(e.target.checked)} 
            />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>⏱️ جدول التوليد الآلي</h2>
          <div className={styles.formGroup}>
            <label className={styles.label}>معدل التحديث (كل كم دقيقة؟)</label>
            <input 
              type="number" 
              className={styles.input}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              min="60"
              max="1440"
              required
            />
          </div>
          <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 'bold' }}>
            ⚠️ لحماية حساباتك الإعلانية من الحظر من قبل خوارزميات ميتا (Meta Rate Limits)، الحد الأدنى المسموح به هو 60 دقيقة.
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            مثال: 60 دقيقة، سيتم سحب البيانات وإنشاء تقرير التكلفة وحفظه في الأرشيف كل ساعة.
          </p>
        </div>

        <div className={styles.buttonContainer}>
          <button type="submit" className={styles.saveBtn} disabled={isSaving}>
            {isSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
          </button>
        </div>
      </form>
    </div>
  );
}
