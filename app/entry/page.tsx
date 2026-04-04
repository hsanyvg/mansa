"use client";

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function DataEntry() {
  const [activeTab, setActiveTab] = useState<'order' | 'product' | 'bundle'>('order');

  return (
    <div className={styles.container}>
      {/* Sidebar - Reused from main layout typically, mocked here */}
      <aside className={styles.sidebar} style={{ width: '80px', backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 0', zIndex: 10 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div className={styles.navIcon} title="لوحة القيادة">📊</div>
        </Link>
        <div className={`${styles.navIcon} active`} style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white', boxShadow: '0 0 15px var(--primary-glow)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', marginBottom: '1rem', cursor: 'pointer' }} title="إدخال البيانات">✍️</div>
        <div className={styles.navIcon} title="المنتجات التجميعية">🧩</div>
        <div className={styles.navIcon} title="المخزون">📦</div>
      </aside>

      <main className={styles.main}>
        <h1 className={styles.headerTitle}>بوابة الإدخال - المخزون والمبيعات</h1>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <button 
              onClick={() => setActiveTab('order')}
              className={`${styles.btn} ${activeTab === 'order' ? '' : styles.btnSecondary}`} 
              style={{ padding: '0.75rem 1.5rem', width: 'auto' }}
            >🛒 إدخال طلب جديد</button>
            <button 
              onClick={() => setActiveTab('bundle')}
              className={`${styles.btn} ${activeTab === 'bundle' ? '' : styles.btnSecondary}`} 
              style={{ padding: '0.75rem 1.5rem', width: 'auto' }}
            >🧩 تكوين منتج تجميعي (Bundled)</button>
            <button 
              onClick={() => setActiveTab('product')}
              className={`${styles.btn} ${activeTab === 'product' ? '' : styles.btnSecondary}`} 
              style={{ padding: '0.75rem 1.5rem', width: 'auto' }}
            >📦 إدخال مخزون تفصيلي (مكونات)</button>
        </div>

        <div className={styles.grid}>
          
          {/* Main Action Panel based on Tab */}
          <div className={styles.panel}>
            
            {activeTab === 'order' && (
              <>
                <h2 className={styles.panelTitle}>🛒 تسجيل طلب عميل جديد</h2>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم العميل / رقم الهاتف</label>
                  <input type="text" className={styles.input} placeholder="مثال: أحمد - 078xxxxxxx" />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>اختر المنتج (مفرد أو تجميعي)</label>
                  <select className={styles.select}>
                    <option value="">-- يرجى اختيار المنتج المطلوب --</option>
                    <option value="b1">🎁 بوكس شتوي متكامل (منتج تجميعي) - $85.00</option>
                    <option value="b2">🎁 طقم عناية بالبشرة (منتج تجميعي) - $120.00</option>
                    <option value="s1">📦 كريم ترطيب منفرد (منتج أولي) - $25.00</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>الكمية</label>
                  <input type="number" className={styles.input} defaultValue={1} min={1} />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>الموظفة المسؤولة</label>
                  <select className={styles.select}>
                    <option value="sara">سارة (#EMP-01)</option>
                    <option value="maryam">مريم (#EMP-04)</option>
                    <option value="noor">نور (#EMP-07)</option>
                  </select>
                </div>

                <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ color: '#10B981', fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>✨ ذكاء المخزون:</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    شراء "بوكس شتوي متكامل" سيقوم تلقائياً بخصم (حبة كريم، غطاء واحد، علبة واحدة، واستيكر واحد) من مخزن المكونات الأولي. لا حاجة للخصم اليدوي.
                  </div>
                </div>

                <button className={styles.btn}>تأكيد الطلب 🛍️</button>
              </>
            )}

            {activeTab === 'bundle' && (
              <>
                <h2 className={styles.panelTitle}>🧩 إنشاء تركيبة منتج تجميعي</h2>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم المنتج النهائي (الذي سيباع للزبون)</label>
                  <input type="text" className={styles.input} placeholder="مثال: بوكس الهدايا الكبير" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>سعر البيع الافتراضي</label>
                  <input type="number" className={styles.input} placeholder="0.00" />
                </div>

                <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
                  <label className={styles.label}>المكونات التي يحتويها هذا المنتج (وصفة المنتج)</label>
                  
                  {/* Mock components list */}
                  <div className={styles.componentRow}>
                    <select className={styles.select}>
                      <option>محتوى الكريم السائل (مل)</option>
                      <option selected>العلبة الزجاجية</option>
                      <option>الغطاء البلاستيكي</option>
                    </select>
                    <input type="number" className={styles.input} defaultValue={1} />
                    <button className={styles.removeBtn}>✖</button>
                  </div>
                  
                  <div className={styles.componentRow}>
                    <select className={styles.select}>
                      <option>محتوى الكريم السائل (مل)</option>
                      <option>العلبة الزجاجية</option>
                      <option selected>الغطاء البلاستيكي</option>
                    </select>
                    <input type="number" className={styles.input} defaultValue={1} />
                    <button className={styles.removeBtn}>✖</button>
                  </div>

                  <div className={styles.componentRow}>
                    <select className={styles.select}>
                      <option selected>استيكر العلامة التجارية</option>
                      <option>صندوق التغليف الكرتوني</option>
                    </select>
                    <input type="number" className={styles.input} defaultValue={2} />
                    <button className={styles.removeBtn}>✖</button>
                  </div>

                  <button className={styles.btnSecondary} style={{ padding: '0.75rem', fontSize: '0.875rem', marginTop: '0.5rem', width: '100%', borderRadius: '8px', cursor: 'pointer' }}>+ إضافة مكون آخر للتجميعة</button>
                </div>

                <div style={{ padding: '1rem', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>التكلفة المتوقعة للمنتج (COGS):</span>
                  <span style={{ fontWeight: 'bold' }}>$ 14.50</span>
                </div>

                <button className={styles.btn}>حفظ المنتج التجميعي ✓</button>
              </>
            )}

            {activeTab === 'product' && (
              <>
                <h2 className={styles.panelTitle}>📦 إضافة مكون / مخزون أولي</h2>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم المكون (مثال: علبة زجاج 50مل)</label>
                  <input type="text" className={styles.input} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>الكمية المستلمة (بالمخزن)</label>
                    <input type="number" className={styles.input} placeholder="0" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>وحدة القياس</label>
                    <select className={styles.select}>
                      <option>قطعة / حبة</option>
                      <option>لتر / مل</option>
                      <option>كيلو / غرام</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>تكلفة الشراء الإجمالية (لحساب تكلفة القطعة)</label>
                  <input type="number" className={styles.input} placeholder="0.00" />
                </div>

                <button className={styles.btn}>تحديث المخزون الأولي 📥</button>
              </>
            )}

          </div>

          {/* Activity / Latest Data Panel */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>🕒 آخر الإدخالات والطلبات</h2>
            
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>البيان</th>
                  <th>الوقت</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className={`${styles.badge} ${styles.bundle}`}>طلب مبيعات</span></td>
                  <td>بيع (بوكس شتوي متكامل)</td>
                  <td style={{ color: 'var(--text-muted)' }}>الآن</td>
                  <td>تم خصم المخزون</td>
                </tr>
                <tr>
                  <td><span className={`${styles.badge} ${styles.bundle}`}>إنشاء תجميعي</span></td>
                  <td>تأسيس "طقم عناية كبير"</td>
                  <td style={{ color: 'var(--text-muted)' }}>قبل ساعة</td>
                  <td>محفوظ</td>
                </tr>
                <tr>
                  <td><span className={`${styles.badge} ${styles.single}`}>مخزون أولي</span></td>
                  <td>دخول 5000 استيكر</td>
                  <td style={{ color: 'var(--text-muted)' }}>اليوم، 10ص</td>
                  <td>مكتمل</td>
                </tr>
                <tr>
                  <td><span className={`${styles.badge} ${styles.single}`}>مخزون أولي</span></td>
                  <td>دخول 1000 علبة زجاجية</td>
                  <td style={{ color: 'var(--text-muted)' }}>أمس</td>
                  <td>مكتمل</td>
                </tr>
                <tr>
                  <td><span className={`${styles.badge} ${styles.bundle}`}>طلب مبيعات</span></td>
                  <td>بيع 3x (بوكس هدايا)</td>
                  <td style={{ color: 'var(--text-muted)' }}>أمس</td>
                  <td>تم توصيله</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </div>
  );
}
