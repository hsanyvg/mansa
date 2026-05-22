"use client";

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import styles from './page.module.css';

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  shipmentCompany?: string;
  totalAmount: number;
  status: string;
  fulfillmentStatus?: string;
  is_settled?: boolean;
  paymentStatus?: string;
  date: any;
  addDate?: string;
  addTime?: string;
  items?: any[];
  notes?: string;
  region?: string;
  governorate?: string;
  employeeName?: string;
  isPaidToStaff?: boolean;
  settledWalletName?: string;
  settlementStatementId?: string;
  settlementAgent?: string;
  settlementNotes?: string;
  settlementImages?: string[];
}

interface Wallet {
  id: string;
  name: string;
}

interface UploadedImage {
  id: string;
  name: string;
  originalSize: number;
  compressedSize: number;
  dataUrl: string;
  file: File;
}

export default function TreasurySettlementPage() {
  const [actualBalance, setActualBalance] = useState<number>(0);
  const [pendingBalance, setPendingBalance] = useState<number>(0);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isSettling, setIsSettling] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [settledOrders, setSettledOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'settled'>('pending');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Phase 2 Form States
  const [externalStatementId, setExternalStatementId] = useState('');
  const [deliveryAgent, setDeliveryAgent] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // File Input Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // HTML5 Canvas image compression to keep files < 200KB and preserve text clarity
  const compressImage = (file: File): Promise<UploadedImage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Limit resolution for text clarity and compression efficiency
          const maxDim = 1600;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
          }

          let quality = 0.8;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          let blobSize = Math.round((dataUrl.length - 22) * 3 / 4);

          while (blobSize > 200 * 1024 && quality > 0.15) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            blobSize = Math.round((dataUrl.length - 22) * 3 / 4);
          }

          const arr = dataUrl.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const compressedBlob = new Blob([u8arr], { type: mime });
          const compressedFile = new File([compressedBlob], file.name, {
            type: mime,
            lastModified: Date.now()
          });

          resolve({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            originalSize: file.size,
            compressedSize: compressedFile.size,
            dataUrl: dataUrl,
            file: compressedFile
          });
        };
        img.onerror = () => {
          resolve({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            originalSize: file.size,
            compressedSize: file.size,
            dataUrl: event.target?.result as string,
            file: file
          });
        };
      };
      reader.onerror = () => {
        resolve({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          originalSize: file.size,
          compressedSize: file.size,
          dataUrl: '',
          file: file
        });
      };
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsCompressing(true);
    const filesArray = Array.from(e.target.files);
    
    try {
      const promises = filesArray.map(file => compressImage(file));
      const results = await Promise.all(promises);
      setUploadedImages(prev => [...prev, ...results]);
    } catch (err) {
      console.error("Error compressing images:", err);
    } finally {
      setIsCompressing(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeImage = (id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  };

  // Fetch wallets list
  useEffect(() => {
    const unsubWallets = onSnapshot(collection(db, 'wallets'), (snapshot) => {
      setWallets(snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
      })));
    });
    return () => unsubWallets();
  }, []);

  useEffect(() => {
    // Fetch all orders for real-time calculations and filter delivered ones
    const q = collection(db, 'orders');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let actual = 0;
      let pending = 0;
      const pendingList: Order[] = [];
      const settledList: Order[] = [];

      snapshot.docs.forEach((document) => {
        const data = document.data();
        const amount = Number(data.totalAmount) || Number(data.price) || 0;
        
        const isSettled = data.is_settled === true || data.paymentStatus === 'settled';
        const isDelivered = data.status === 'delivered' || data.fulfillmentStatus === 'Delivered';

        if (isDelivered) {
          // Format dates
          let addDate = '---';
          let addTime = '---';
          if (data.date) {
            const dateObj = data.date.toDate ? data.date.toDate() : new Date(data.date);
            addDate = dateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
            addTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
          }

          const orderObj: Order = {
            id: document.id,
            customerName: data.customerName || 'بدون اسم',
            customerPhone: data.customerPhone || data.phone || '',
            shipmentCompany: data.shipmentCompany || '---',
            totalAmount: amount,
            status: data.status || '',
            fulfillmentStatus: data.fulfillmentStatus || '',
            is_settled: isSettled,
            paymentStatus: data.paymentStatus || '',
            date: data.date,
            addDate,
            addTime,
            items: data.items || [],
            notes: data.notes || '',
            region: data.region || '---',
            governorate: data.governorate || '---',
            employeeName: data.employeeName || '---',
            isPaidToStaff: data.isPaidToStaff || false,
            settledWalletName: data.settledWalletName || '',
            settlementStatementId: data.settlementStatementId || '',
            settlementAgent: data.settlementAgent || '',
            settlementNotes: data.settlementNotes || '',
            settlementImages: data.settlementImages || []
          };

          if (isSettled) {
            actual += amount;
            settledList.push(orderObj);
          } else {
            pending += amount;
            pendingList.push(orderObj);
          }
        }
      });

      // Sort pending list by date descending (newest first)
      pendingList.sort((a, b) => {
        const tA = a.date?.toMillis ? a.date.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
        const tB = b.date?.toMillis ? b.date.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
        return tB - tA;
      });

      // Sort settled list by date descending (newest first)
      settledList.sort((a, b) => {
        const tA = a.date?.toMillis ? a.date.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
        const tB = b.date?.toMillis ? b.date.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
        return tB - tA;
      });

      setActualBalance(actual);
      setPendingBalance(pending);
      setPendingOrders(pendingList);
      setSettledOrders(settledList);
      
      // Remove any selected orders that are no longer pending
      setSelectedOrders((prev) => {
        const next = new Set(prev);
        for (const id of next) {
          if (!pendingList.find(o => o.id === id)) {
            next.delete(id);
          }
        }
        return next;
      });

    }, (error) => {
      console.error("Error fetching orders:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrders(new Set(pendingOrders.map(o => o.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (id: string, checked: boolean) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSettle = () => {
    if (selectedOrders.size === 0) return;
    setSelectedWalletId('');
    setExternalStatementId('');
    setDeliveryAgent('');
    setSettlementNotes('');
    setUploadedImages([]);
    setShowWalletModal(true);
  };

  const handleConfirmSettlement = async () => {
    if (selectedOrders.size === 0 || !selectedWalletId) return;

    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet) {
      alert("المحفظة المحددة غير موجودة.");
      return;
    }

    setIsSettling(true);
    try {
      const batch = writeBatch(db);
      let totalAmount = 0;

      selectedOrders.forEach(orderId => {
        const order = pendingOrders.find(o => o.id === orderId);
        if (order) {
          totalAmount += order.totalAmount;
        }
        const orderRef = doc(db, 'orders', orderId);
        batch.update(orderRef, {
          is_settled: true,
          paymentStatus: 'settled',
          settledWalletId: selectedWallet.id,
          settledWalletName: selectedWallet.name,
          settledAt: serverTimestamp(),
          settlementStatementId: externalStatementId || '',
          settlementAgent: deliveryAgent || '',
          settlementNotes: settlementNotes || '',
          settlementImages: uploadedImages.map(img => img.dataUrl)
        });
      });

      // Create a deposit transaction record in treasury_transactions
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toISOString().split('T')[0];

      const transactionRef = doc(collection(db, 'treasury_transactions'));
      batch.set(transactionRef, {
        type: 'deposit',
        amount: totalAmount,
        currency: 'IQD',
        date: dateStr,
        time: timeStr,
        details: `تسوية تلقائية للطلبات ذات الأرقام: ${Array.from(selectedOrders).join(', ')}`,
        walletId: selectedWallet.id,
        createdAt: serverTimestamp(),
        externalStatementId: externalStatementId || '',
        deliveryAgent: deliveryAgent || '',
        notes: settlementNotes || '',
        images: uploadedImages.map(img => img.dataUrl),
        settledOrderIds: Array.from(selectedOrders)
      });

      await batch.commit();

      setSelectedOrders(new Set());
      setShowWalletModal(false);
      setSelectedWalletId('');
      setExternalStatementId('');
      setDeliveryAgent('');
      setSettlementNotes('');
      setUploadedImages([]);
      alert('تمت تسوية الطلبات المحددة وإيداع المبلغ في المحفظة بنجاح!');
    } catch (error) {
      console.error("Error during settlement:", error);
      alert('حدث خطأ أثناء التسوية. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSettling(false);
    }
  };

  const totalSelectedAmount = Array.from(selectedOrders).reduce((sum, orderId) => {
    const order = pendingOrders.find(o => o.id === orderId);
    return sum + (order ? order.totalAmount : 0);
  }, 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>الخزنة المالية (تسوية الطلبات)</h1>
      </div>



      {/* Settlement Table Section */}
      <div className={styles.tableSection}>
        <div className={styles.sectionHeader}>
          {/* Tabs Container */}
          <div className={styles.tabsContainer}>
            <button 
              className={`${styles.tab} ${activeTab === 'pending' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              الطلبات المعلقة ({pendingOrders.length})
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'settled' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('settled')}
            >
              التسويات المكتملة ({settledOrders.length})
            </button>
          </div>

          {activeTab === 'pending' && (
            <button 
              className={styles.settleButton} 
              onClick={handleSettle}
              disabled={selectedOrders.size === 0 || isSettling}
            >
              {isSettling ? (
                <span className={styles.loader}></span>
              ) : (
                <>
                  <span className={styles.settleIcon}>✓</span>
                  تأكيد استلام المبالغ (تسوية)
                </>
              )}
            </button>
          )}
        </div>

        <div className={styles.tableContainer}>
          {activeTab === 'pending' ? (
            pendingOrders.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkboxCell}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={selectedOrders.size === pendingOrders.length && pendingOrders.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>رقم الطلب</th>
                    <th>اسم الزبون</th>
                    <th>شركة التوصيل / المندوب</th>
                    <th>المبلغ المستحق</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map(order => (
                    <tr key={order.id}>
                      <td className={styles.checkboxCell}>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={selectedOrders.has(order.id)}
                          onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                        />
                      </td>
                      <td>{order.id}</td>
                      <td>{order.customerName}</td>
                      <td>{order.shipmentCompany || '---'}</td>
                      <td className={styles.amountCol}>{order.totalAmount.toLocaleString()} د.ع</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            padding: '4px'
                          }}
                          title="عرض تفاصيل الطلب"
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>✨</div>
                <div>لا توجد طلبات معلقة بانتظار التسوية!</div>
              </div>
            )
          ) : (
            // Settled orders tab
            settledOrders.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>اسم الزبون</th>
                    <th>تاريخ الطلب</th>
                    <th>المحفظة المستلمة</th>
                    <th>المبلغ المستلم</th>
                    <th>بيانات التسوية</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {settledOrders.map(order => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{order.customerName}</td>
                      <td className={styles.dateCol}>{order.addDate} - {order.addTime}</td>
                      <td>
                        <span style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}>
                          🏦 {order.settledWalletName || 'غير محددة'}
                        </span>
                      </td>
                      <td className={styles.amountCol}>{order.totalAmount.toLocaleString()} د.ع</td>
                      <td>
                        {(order.settlementStatementId || order.settlementAgent) ? (
                          <div className={styles.settlementTableBadge}>
                            {order.settlementStatementId && (
                              <div className={styles.badgeLine}>
                                <span className={styles.badgeLabel}>كشف:</span> {order.settlementStatementId}
                              </div>
                            )}
                            {order.settlementAgent && (
                              <div className={styles.badgeLine}>
                                <span className={styles.badgeLabel}>المندوب:</span> {order.settlementAgent}
                              </div>
                            )}
                            {order.settlementImages && order.settlementImages.length > 0 && (
                              <div className={styles.badgeLine} style={{ color: '#10b981', fontWeight: 'bold' }}>
                                📸 {order.settlementImages.length} مرفقات
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ opacity: 0.4 }}>---</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            padding: '4px'
                          }}
                          title="عرض تفاصيل الطلب"
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📭</div>
                <div>لا توجد تسويات مكتملة مسجلة بعد!</div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className={styles.modalOverlay} onClick={() => setShowWalletModal(false)}>
          <div className={styles.settlementModal} onClick={e => e.stopPropagation()}>
            <div className={styles.settlementModalHeader}>
              <h2 className={styles.modalTitle}>🧾 إتمام التسوية المالية للطلبات</h2>
              <button className={styles.closeBtnIcon} onClick={() => setShowWalletModal(false)}>×</button>
            </div>
            
            <div className={styles.settlementSummary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>عدد الطلبات المحددة</span>
                <span className={styles.summaryValue} style={{ color: '#10b981' }}>{selectedOrders.size} طلب</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>إجمالي المبلغ المستحق</span>
                <span className={styles.summaryValue} style={{ color: '#38bdf8' }}>{totalSelectedAmount.toLocaleString()} د.ع</span>
              </div>
            </div>

            <div className={styles.settlementModalBody}>
              <div className={styles.modalFormGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>رقم كشف الشركة (رقم الكشف الورقي)</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="أدخل رقم الكشف هنا..."
                    value={externalStatementId}
                    onChange={e => setExternalStatementId(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم/رقم المندوب المسلِّم</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="أدخل اسم أو رقم المندوب..."
                    value={deliveryAgent}
                    onChange={e => setDeliveryAgent(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>اختر المحفظة المستهدفة <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    className={styles.select}
                    value={selectedWalletId}
                    onChange={e => setSelectedWalletId(e.target.value)}
                    required
                  >
                    <option value="">اختر المحفظة التي سيودع بها المبلغ...</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                  <label className={styles.label}>ملاحظات / البيان</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="اكتب أي ملاحظات، تفاصيل أو استقطاعات مالية هنا..."
                    value={settlementNotes}
                    onChange={e => setSettlementNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Multiple Image Uploader Section */}
              <div className={styles.uploaderSection}>
                <label className={styles.label} style={{ marginBottom: '0.8rem', display: 'block' }}>
                  📸 مرفقات وصور الكشف الورقي
                </label>
                
                <div className={styles.uploadActions}>
                  <button 
                    type="button"
                    className={styles.uploadBtn}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📂 رفع من ملفات الجهاز
                  </button>
                  <button 
                    type="button"
                    className={styles.cameraBtn}
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    📷 التقاط بكاميرا الهاتف
                  </button>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                  />
                  <input
                    type="file"
                    ref={cameraInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                  />
                </div>

                {isCompressing && (
                  <div className={styles.compressionProgress}>
                    <span className={styles.loaderSmall}></span>
                    جاري ضغط ومعالجة الصور لتحسين المساحة...
                  </div>
                )}

                {uploadedImages.length > 0 && (
                  <div className={styles.thumbnailsContainer}>
                    <div className={styles.thumbnailsTitle}>
                      الصور المرفقة ({uploadedImages.length}):
                    </div>
                    <div className={styles.thumbnailsGrid}>
                      {uploadedImages.map(img => (
                        <div key={img.id} className={styles.thumbnailCard}>
                          <img src={img.dataUrl} alt={img.name} className={styles.thumbnailImg} />
                          <button 
                            type="button" 
                            className={styles.deleteThumbnailBtn}
                            onClick={() => removeImage(img.id)}
                            title="إزالة الصورة"
                          >
                            ❌
                          </button>
                          <div className={styles.thumbnailInfo}>
                            <span className={img.compressedSize > 200 * 1024 ? styles.thumbnailNameWarning : styles.thumbnailName} title={img.name}>{img.name}</span>
                            <span className={styles.thumbnailSizes}>
                              {(img.originalSize / 1024).toFixed(0)}KB ➡️ <strong style={{ color: '#10b981' }}>{(img.compressedSize / 1024).toFixed(0)}KB</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalActions} style={{ padding: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <button 
                className={styles.submitBtn} 
                onClick={handleConfirmSettlement}
                disabled={!selectedWalletId || isSettling || isCompressing}
              >
                {isSettling ? <span className={styles.loader}></span> : 'تأكيد التسوية وتعديل الحالة'}
              </button>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setShowWalletModal(false)}
                disabled={isSettling}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📄 تفاصيل الطلب <span style={{ color: '#10b981', fontSize: '1rem', marginRight: '0.5rem' }}>#{selectedOrder.id.slice(-6).toUpperCase()}</span></h2>
              <button className={styles.closeButton} onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              {/* Customer Information Grid */}
              <div className={styles.detailsGrid}>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>اسم الزبون</span>
                  <span className={styles.detailsValue}>{selectedOrder.customerName || '---'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>رقم الهاتف</span>
                  <span className={styles.detailsValue} style={{direction: 'ltr', textAlign: 'right'}}>{selectedOrder.customerPhone || '---'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>المحافظة</span>
                  <span className={styles.detailsValue}>{selectedOrder.governorate || '---'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>المنطقة</span>
                  <span className={styles.detailsValue}>{selectedOrder.region || '---'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>تاريخ ووقت الطلب</span>
                  <span className={styles.detailsValue}>{selectedOrder.addDate} - {selectedOrder.addTime}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>الموظف المسؤول</span>
                  <span className={styles.detailsValue}>
                    {selectedOrder.employeeName || '---'}
                    {selectedOrder.isPaidToStaff && (
                      <span style={{ color: '#10b981', fontSize: '0.8rem', marginRight: '0.5rem' }}>(✔️ تم دفع العمولة)</span>
                    )}
                  </span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>حالة الطلب / الشحن</span>
                  <span className={styles.detailsValue} style={{ color: '#fbbf24' }}>
                    {selectedOrder.status === 'delivered' ? 'مكتمل' : selectedOrder.status} ({selectedOrder.fulfillmentStatus || '---'})
                  </span>
                </div>
                {selectedOrder.shipmentCompany && (
                  <div className={styles.detailsItem}>
                    <span className={styles.detailsLabel}>شركة التوصيل</span>
                    <span className={styles.detailsValue}>{selectedOrder.shipmentCompany}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className={styles.itemsTableContainer}>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الصنف</th>
                      <th>الكمية</th>
                      <th>السعر المفرد</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold' }}>{item.productName || 'صنف غير معروف'}</td>
                          <td>{item.quantity}</td>
                          <td>{new Intl.NumberFormat('en-US').format(item.unitPrice || 0)} د.ع</td>
                          <td style={{ color: '#10B981', fontWeight: 'bold' }}>
                            {new Intl.NumberFormat('en-US').format((item.quantity || 0) * (item.unitPrice || 0))} د.ع
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>لا توجد أصناف في السلة لهذا الطلب</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Settlement Information (If Settled) */}
              {selectedOrder.is_settled && (
                <div className={styles.settlementDetailsSection}>
                  <h3 className={styles.sectionSubTitle}>📋 بيانات تسوية الطلب المالية</h3>
                  <div className={styles.settlementDetailsGrid}>
                    <div className={styles.detailsItem}>
                      <span className={styles.detailsLabel}>المحفظة المستلمة</span>
                      <span className={styles.detailsValue} style={{ color: '#10b981' }}>🏦 {selectedOrder.settledWalletName || 'غير محددة'}</span>
                    </div>
                    <div className={styles.detailsItem}>
                      <span className={styles.detailsLabel}>رقم الكشف الورقي / الشركة</span>
                      <span className={styles.detailsValue}>{selectedOrder.settlementStatementId || '---'}</span>
                    </div>
                    <div className={styles.detailsItem}>
                      <span className={styles.detailsLabel}>المندوب المسلِّم</span>
                      <span className={styles.detailsValue}>{selectedOrder.settlementAgent || '---'}</span>
                    </div>
                    <div className={styles.detailsItem} style={{ gridColumn: 'span 2' }}>
                      <span className={styles.detailsLabel}>ملاحظات التسوية</span>
                      <span className={styles.detailsValue} style={{ fontWeight: 'normal', fontSize: '0.9rem', lineHeight: '1.5' }}>
                        {selectedOrder.settlementNotes || <span style={{ opacity: 0.5 }}>لا توجد ملاحظات تسوية</span>}
                      </span>
                    </div>
                  </div>
                  
                  {selectedOrder.settlementImages && selectedOrder.settlementImages.length > 0 && (
                    <div className={styles.imagesSection}>
                      <span className={styles.detailsLabel} style={{ marginBottom: '0.8rem', display: 'block', fontWeight: 'bold' }}>
                        🖼️ المرفقات وصور الكشف ({selectedOrder.settlementImages.length})
                      </span>
                      <div className={styles.imageGallery}>
                        {selectedOrder.settlementImages.map((imgUrl, index) => (
                          <div 
                            key={index} 
                            className={styles.galleryImageCard}
                            onClick={() => setLightboxImage(imgUrl)}
                          >
                            <img src={imgUrl} alt={`مرفق كشف ${index + 1}`} className={styles.galleryImage} />
                            <div className={styles.galleryImageOverlay}>
                              <span>🔍 تكبير</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.modalFooterDetails}>
              <div className={styles.notesSection}>
                {selectedOrder.notes ? (
                  <><strong>ملاحظات:</strong> {selectedOrder.notes}</>
                ) : (
                  <span style={{opacity: 0.5}}>لا توجد ملاحظات</span>
                )}
              </div>
              <div className={styles.totalHighlight}>
                <span>المبلغ الكلي:</span>
                <span>{selectedOrder.totalAmount.toLocaleString()} د.ع</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxImage(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxImage(null)}>×</button>
          <div className={styles.lightboxContainer} onClick={e => e.stopPropagation()}>
            <img src={lightboxImage} alt="مرفق مكبر" className={styles.lightboxImg} />
          </div>
        </div>
      )}
    </div>
  );
}
