"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import DateRangePicker from '../../../components/DateRangePicker';
import { db } from '../../../lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, writeBatch, getDoc } from 'firebase/firestore';

export default function OrdersListPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('الكل'); // Modified to show All conceptually first
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Custom Modals
  const [notificationModal, setNotificationModal] = useState({ show: false, message: '' });
  
  // Details Modal State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showGovDropdownEdit, setShowGovDropdownEdit] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('all'); 
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);


  const governoratesList = [
    "بغداد", "البصرة", "نينوى (الموصل)", "أربيل", "النجف", "ذي قار (الناصرية)",
    "كركوك", "الأنبار (الرمادي)", "ديالى (بعقوبة)", "المثنى (السماوة)",
    "القادسية (الديوانية)", "ميسان (العمارة)", "واسط (الكوت)", "صلاح الدين (تكريت)",
    "دهوك", "السليمانية", "بابل (الحلة)", "كربلاء"
  ];

  // Column Filters State
  const [columnFilters, setColumnFilters] = useState({
    id: '',
    customerName: '',
    governorate: '',
    phone: '',
    totalAmount: '',
    status: '',
    addDate: '',
    addTime: '',
    employeeName: ''
  });

  // Status Configuration
  const statusMap: Record<string, { label: string, color: string, bg: string }> = {
    'pending': { label: 'قيد الانتظار', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)' },
    'processing': { label: 'جاري التجهيز', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
    'shipped': { label: 'تم الشحن', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
    'delivered': { label: 'مكتمل', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    'cancelled': { label: 'ملغي/مسترجع', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    'new': { label: 'جديد', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' }
  };

  // Fetch Orders from Firestore
  useEffect(() => {
    // A simple query, assuming orders might not all have dates, we just order by client-side or we can order by date desc.
    // Ensure you have an index if using orderBy('date', 'desc'). For now, we fetch all and sort client-side.
    const q = process.env.NEXT_PUBLIC_REQUIRE_INDEX ? query(collection(db, 'orders'), orderBy('date', 'desc')) : collection(db, 'orders');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbOrders: any[] = snapshot.docs.map(doc => {
        const data = doc.data();
        let addDate = '---';
        let addTime = '---';
        
        if (data.date) {
          const dateObj = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
          addDate = dateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
          addTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
        }

        // Handle POS array structure or legacy structure gracefully
        const totalAmount = data.totalAmount || data.price || 0;
        const formattedTotal = totalAmount ? new Intl.NumberFormat('en-US').format(totalAmount) : '0';

        return {
          id: doc.id,
          ...data,
          addDate,
          addTime,
          formattedTotal
        };
      });

      // Simple client-side sort if DB fetch was unordered
      dbOrders.sort((a, b) => {
         const tA = a.date instanceof Timestamp ? a.date.toMillis() : 0;
         const tB = b.date instanceof Timestamp ? b.date.toMillis() : 0;
         return tB - tA;
      });

      setOrders(dbOrders);
    });

    return () => unsubscribe();
  }, []);

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) 
        ? prev.filter(orderId => orderId !== id)
        : [...prev, id]
    );
  };

  const handleFilterChange = (column: keyof typeof columnFilters, value: string) => {
    setColumnFilters(prev => ({ ...prev, [column]: value }));
  };

  const activeOrders = orders.filter(o => !o.isArchived);
  const archivedOrdersList = orders.filter(o => o.isArchived);

  const phoneCounts = activeOrders.reduce((acc, order) => {
    const ph = (order.customerPhone || order.phone || '').trim();
    if (ph) acc[ph] = (acc[ph] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const duplicateOrdersList = activeOrders.filter(order => {
    const ph = (order.customerPhone || order.phone || '').trim();
    return ph && phoneCounts[ph] > 1;
  });

  const baseList = activeTab === 'archived' ? archivedOrdersList 
                 : activeTab === 'duplicates' ? duplicateOrdersList 
                 : activeOrders;

  const filteredOrders = baseList.filter(order => {
    // We slice the ID exactly how it's displayed to match the user's visual search
    const displayId = order.id.slice(-6).toLowerCase();
    const idStr = order.id.toLowerCase();
    const custName = (order.customerName || '').toLowerCase();
    const gov = (order.governorate || '').toLowerCase();
    const phone = (order.customerPhone || order.phone || '').toLowerCase();
    const total = (order.formattedTotal || '').toString().toLowerCase();
    const rawTotal = (order.totalAmount || order.price || '').toString().toLowerCase();
    const statusKey = (order.status || 'pending').toLowerCase();
    const statusLabel = statusMap[statusKey]?.label.toLowerCase() || statusKey;
    const aDate = (order.addDate || '').toLowerCase();
    const aTime = (order.addTime || '').toLowerCase();
    const region = (order.region || '').toLowerCase();
    const notes = (order.notes || '').toLowerCase();
    const empName = (order.employeeName || '').toLowerCase();

    // Column Filters
    const matchesColumn = (
      (displayId.includes(columnFilters.id.toLowerCase()) || idStr.includes(columnFilters.id.toLowerCase())) &&
      custName.includes(columnFilters.customerName.toLowerCase()) &&
      gov.includes(columnFilters.governorate.toLowerCase()) &&
      phone.includes(columnFilters.phone.toLowerCase()) &&
      (total.includes(columnFilters.totalAmount.toLowerCase()) || rawTotal.includes(columnFilters.totalAmount.toLowerCase())) &&
      (statusKey.includes(columnFilters.status.toLowerCase()) || statusLabel.includes(columnFilters.status.toLowerCase())) &&
      aDate.includes(columnFilters.addDate.toLowerCase()) &&
      aTime.includes(columnFilters.addTime.toLowerCase()) &&
      empName.includes(columnFilters.employeeName.toLowerCase())
    );

    // Global Filter
    const searchLower = globalSearch.toLowerCase();
    // Gather all item names if any, to search within cart products as well
    const productNames = (order.items || []).map((item: any) => (item.productName || '').toLowerCase());
    
    const matchesGlobal = searchLower === '' || [
      idStr, displayId, custName, gov, region, phone, total, rawTotal, 
      statusKey, statusLabel, aDate, aTime, empName, notes, ...productNames
    ].some(field => field.includes(searchLower));

    return matchesColumn && matchesGlobal;
  });

  const toggleAllSelection = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]); 
    } else {
      setSelectedOrderIds(filteredOrders.map(order => order.id)); 
    }
  };

  const isAllSelected = filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length;

  const handleCompanySelection = (companyName: string) => {
    // In a real app we'd batch update in Firestore here
    setNotificationModal({ show: true, message: `تم ترحيل ${selectedOrderIds.length} طلبات إلى شركة ${companyName} بنجاح!` });
    setShowCompanyModal(false);
    setSelectedOrderIds([]); // Clear selection after routing
  };

  const handleArchiveSelected = async () => {
    if (selectedOrderIds.length === 0) {
      setNotificationModal({ show: true, message: 'يرجى تحديد طلبات للأرشفة.' });
      return;
    }
    
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedOrderIds.forEach(id => {
        const orderRef = doc(db, 'orders', id);
        batch.update(orderRef, { isArchived: true });
      });
      await batch.commit();
      setSelectedOrderIds([]);
      setNotificationModal({ show: true, message: `تم أرشفة ${selectedOrderIds.length} طلبات بنجاح!` });
    } catch (error) {
       console.error("Error archiving orders:", error);
       setNotificationModal({ show: true, message: 'حدث خطأ أثناء الأرشفة.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedOrderIds.length === 0) {
      setNotificationModal({ show: true, message: 'يرجى تحديد طلبات للاستعادة.' });
      return;
    }
    
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedOrderIds.forEach(id => {
        const orderRef = doc(db, 'orders', id);
        batch.update(orderRef, { isArchived: false });
      });
      await batch.commit();
      setSelectedOrderIds([]);
      setNotificationModal({ show: true, message: `تم استعادة ${selectedOrderIds.length} طلبات بنجاح!` });
    } catch (error) {
       console.error("Error restoring orders:", error);
       setNotificationModal({ show: true, message: 'حدث خطأ أثناء الاستعادة الجماعية.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRestoreOrder = async (orderId: string) => {
    setIsUpdating(true);
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { isArchived: false });
      setNotificationModal({ show: true, message: 'تم استعادة الطلب بنجاح!' });
    } catch (error) {
      console.error("Error restoring order:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء الاستعادة.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', orderToDelete.id);
      
      // If order is not cancelled or returned, we should return items to stock
      const isCancelled = orderToDelete.status === 'cancelled' || orderToDelete.status === 'returned';
      
      if (!isCancelled && orderToDelete.items && orderToDelete.items.length > 0) {
        for (const item of orderToDelete.items) {
          if (item.isComposite && item.composition) {
            for (const comp of item.composition) {
              const rawProdRef = doc(db, 'products', comp.itemId);
              const rawSnap = await getDoc(rawProdRef);
              if (rawSnap.exists()) {
                const rawData = rawSnap.data();
                let stock = { ...rawData.stock };
                let qtyToAdd = comp.quantityNeeded * item.quantity;
                
                // Return stock to first available store
                const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                if (!stock[firstStoreKey]) {
                  stock[firstStoreKey] = { quantity: qtyToAdd, unit: rawData.units?.[0]?.type || 'قطعة' };
                } else {
                  stock[firstStoreKey].quantity += qtyToAdd;
                }

                // Update totalBaseQuantity
                let newTotalBaseQuantity = 0;
                Object.values(stock).forEach((s: any) => {
                  const uMul = rawData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                  newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
                });

                batch.update(rawProdRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
              }
            }
          } else if (item.productId) {
            const prodRef = doc(db, 'products', item.productId);
            const prodSnap = await getDoc(prodRef);
            if (prodSnap.exists()) {
              const prodData = prodSnap.data();
              let stock = { ...prodData.stock };
              let qtyToAdd = item.quantity;

              const firstStoreKey = Object.keys(stock)[0] || 'default_store';
              if (!stock[firstStoreKey]) {
                stock[firstStoreKey] = { quantity: qtyToAdd, unit: prodData.units?.[0]?.type || 'قطعة' };
              } else {
                stock[firstStoreKey].quantity += qtyToAdd;
              }

              // Update totalBaseQuantity
              let newTotalBaseQuantity = 0;
              Object.values(stock).forEach((s: any) => {
                const uMul = prodData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
              });

              batch.update(prodRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
            }
          }
        }
      }

      // Delete the order document
      batch.delete(orderRef);
      await batch.commit();
      
      setOrderToDelete(null);
      setNotificationModal({ show: true, message: 'تم حذف الطلب وإعادة المواد للمخزن (إن وجدت) بنجاح!' });
    } catch (error) {
      console.error("Error deleting order:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء حذف الطلب.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      const selectedOrdersData = orders.filter(o => selectedOrderIds.includes(o.id));
      
      // Process each order for stock reversal
      for (const orderItem of selectedOrdersData) {
        const orderRef = doc(db, 'orders', orderItem.id);
        const isCancelled = orderItem.status === 'cancelled' || orderItem.status === 'returned';
        
        if (!isCancelled && orderItem.items && orderItem.items.length > 0) {
          for (const item of orderItem.items) {
            if (item.isComposite && item.composition) {
              for (const comp of item.composition) {
                const rawProdRef = doc(db, 'products', comp.itemId);
                const rawSnap = await getDoc(rawProdRef);
                if (rawSnap.exists()) {
                  const rawData = rawSnap.data();
                  let stock = { ...rawData.stock };
                  let qtyToAdd = comp.quantityNeeded * item.quantity;
                  
                  const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                  if (!stock[firstStoreKey]) {
                    stock[firstStoreKey] = { quantity: qtyToAdd, unit: rawData.units?.[0]?.type || 'قطعة' };
                  } else {
                    stock[firstStoreKey].quantity += qtyToAdd;
                  }

                  let newTotalBaseQuantity = 0;
                  Object.values(stock).forEach((s: any) => {
                    const uMul = rawData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                    newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
                  });

                  batch.update(rawProdRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
                }
              }
            } else if (item.productId) {
              const prodRef = doc(db, 'products', item.productId);
              const prodSnap = await getDoc(prodRef);
              if (prodSnap.exists()) {
                const prodData = prodSnap.data();
                let stock = { ...prodData.stock };
                let qtyToAdd = item.quantity;

                const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                if (!stock[firstStoreKey]) {
                  stock[firstStoreKey] = { quantity: qtyToAdd, unit: prodData.units?.[0]?.type || 'قطعة' };
                } else {
                  stock[firstStoreKey].quantity += qtyToAdd;
                }

                let newTotalBaseQuantity = 0;
                Object.values(stock).forEach((s: any) => {
                  const uMul = prodData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                  newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
                });

                batch.update(prodRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
              }
            }
          }
        }
        batch.delete(orderRef);
      }
      
      await batch.commit();
      setSelectedOrderIds([]);
      setShowBulkDeleteModal(false);
      setNotificationModal({ show: true, message: `تم حذف ${selectedOrdersData.length} طلبات بنجاح وإعادة المواد للمخزن.` });
    } catch (error) {
      console.error("Bulk delete error:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء الحذف الجماعي.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const saveOrderUpdates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setIsUpdating(true);
    try {
      const oldOrder = orders.find(o => o.id === editingOrder.id);
      const orderRef = doc(db, 'orders', editingOrder.id);
      const batch = writeBatch(db);

      batch.update(orderRef, {
        customerName: editingOrder.customerName || '',
        customerPhone: editingOrder.customerPhone || editingOrder.phone || '',
        governorate: editingOrder.governorate || '',
        region: editingOrder.region || '',
        notes: editingOrder.notes || '',
        status: editingOrder.status || 'pending'
      });

      // Handle Stock Logic if status changed
      if (oldOrder && oldOrder.status !== editingOrder.status) {
        const isNowCancelled = editingOrder.status === 'cancelled' || editingOrder.status === 'returned';
        const wasCancelled = oldOrder.status === 'cancelled' || oldOrder.status === 'returned';

        const updateStockForOrderItems = async (items: any[], operation: 'add' | 'subtract') => {
          for (const item of items) {
            if (item.isComposite && item.composition) {
              for (const comp of item.composition) {
                const rawProdRef = doc(db, 'products', comp.itemId);
                const rawSnap = await getDoc(rawProdRef);
                if (rawSnap.exists()) {
                  const rawData = rawSnap.data();
                  let stock = { ...rawData.stock };
                  let qtyToChange = comp.quantityNeeded * item.quantity;
                  
                  if (operation === 'add') {
                    const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                    if (!stock[firstStoreKey]) {
                       stock[firstStoreKey] = { quantity: qtyToChange, unit: rawData.units?.[0]?.type || 'قطعة' };
                    } else {
                       stock[firstStoreKey].quantity += qtyToChange;
                    }
                  } else { // subtract
                    let remainingToDeduct = qtyToChange;
                    for (const storeId in stock) {
                      if (remainingToDeduct <= 0) break;
                      if (stock[storeId].quantity > 0) {
                        const deductAmount = Math.min(stock[storeId].quantity, remainingToDeduct);
                        stock[storeId].quantity -= deductAmount;
                        remainingToDeduct -= deductAmount;
                      }
                    }
                    if (remainingToDeduct > 0) {
                      const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                      if (!stock[firstStoreKey]) {
                        stock[firstStoreKey] = { quantity: -remainingToDeduct, unit: rawData.units?.[0]?.type || 'قطعة' };
                      } else {
                        stock[firstStoreKey].quantity -= remainingToDeduct;
                      }
                    }
                  }
                  
                  // Update totalBaseQuantity
                  let newTotalBaseQuantity = 0;
                  Object.values(stock).forEach((s: any) => {
                    const uMul = rawData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                    newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
                  });

                  batch.update(rawProdRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
                }
              }
            } else {
              const prodRef = doc(db, 'products', item.productId);
              const prodSnap = await getDoc(prodRef);
              if (prodSnap.exists()) {
                const prodData = prodSnap.data();
                let stock = { ...prodData.stock };
                let qtyToChange = item.quantity;

                if (operation === 'add') {
                  const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                  if (!stock[firstStoreKey]) {
                     stock[firstStoreKey] = { quantity: qtyToChange, unit: prodData.units?.[0]?.type || 'قطعة' };
                  } else {
                     stock[firstStoreKey].quantity += qtyToChange;
                  }
                } else { // subtract
                  let remainingToDeduct = qtyToChange;
                  for (const storeId in stock) {
                    if (remainingToDeduct <= 0) break;
                    if (stock[storeId].quantity > 0) {
                      const deductAmount = Math.min(stock[storeId].quantity, remainingToDeduct);
                      stock[storeId].quantity -= deductAmount;
                      remainingToDeduct -= deductAmount;
                    }
                  }
                  if (remainingToDeduct > 0) {
                    const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                    if (!stock[firstStoreKey]) {
                      stock[firstStoreKey] = { quantity: -remainingToDeduct, unit: prodData.units?.[0]?.type || 'قطعة' };
                    } else {
                      stock[firstStoreKey].quantity -= remainingToDeduct;
                    }
                  }
                }

                // Update totalBaseQuantity
                let newTotalBaseQuantity = 0;
                Object.values(stock).forEach((s: any) => {
                  const uMul = prodData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                  newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
                });

                batch.update(prodRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
              }
            }
          }
        };

        if (isNowCancelled && !wasCancelled) {
          // Action: RESTOCK (+ quantity)
          await updateStockForOrderItems(oldOrder.items || [], 'add');
        } else if (!isNowCancelled && wasCancelled) {
          // Action: DEDUCT (- quantity)
          await updateStockForOrderItems(oldOrder.items || [], 'subtract');
        }
      }

      await batch.commit();
      setNotificationModal({ show: true, message: 'تم تحديث بيانات الطلب والمخزون بنجاح' });
      setEditingOrder(null);
    } catch (error) {
      console.error("Error updating order:", error);
      alert("حدث خطأ أثناء التحديث");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Area */}
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>📦</span>
          الطلبات
        </div>
        
        <div className={styles.headerActions}>
          <DateRangePicker 
            initialPreset={dateFilter} 
            onApply={(val: string) => setDateFilter(val)} 
          />
          
          {activeTab !== 'archived' ? (
            <>
              <button className={styles.routeButton} onClick={() => {
                if (selectedOrderIds.length === 0) {
                  setNotificationModal({ show: true, message: 'يرجى تحديد طلب واحد على الأقل لترحيله.' });
                  return;
                }
                setShowCompanyModal(true);
              }}>
                <span>ترحيل الطلبات</span>
                <span style={{ fontSize: '0.9rem' }}>({selectedOrderIds.length})</span>
              </button>

              <button 
                className={styles.routeButton} 
                onClick={handleArchiveSelected}
                style={{ backgroundColor: '#64748b', boxShadow: '0 4px 12px rgba(100, 116, 139, 0.3)' }}
              >
                <span>أرشفة المحددة</span>
                <span style={{ fontSize: '0.9rem' }}>({selectedOrderIds.length})</span>
              </button>

              {selectedOrderIds.length > 0 && (
                <button 
                  className={styles.routeButton} 
                  onClick={() => setShowBulkDeleteModal(true)}
                  style={{ backgroundColor: '#ef4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                >
                  <span>حذف المحددة</span>
                  <span style={{ fontSize: '0.9rem' }}>({selectedOrderIds.length})</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                className={styles.routeButton} 
                onClick={handleRestoreSelected}
                style={{ backgroundColor: '#10b981', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
              >
                <span>استعادة الطلبات</span>
                <span style={{ fontSize: '0.9rem' }}>({selectedOrderIds.length})</span>
              </button>

              {selectedOrderIds.length > 0 && (
                <button 
                  className={styles.routeButton} 
                  onClick={() => setShowBulkDeleteModal(true)}
                  style={{ backgroundColor: '#ef4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                >
                  <span>حذف النهائي</span>
                  <span style={{ fontSize: '0.9rem' }}>({selectedOrderIds.length})</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs Section */}
      <div className={styles.tabsContainer}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'all' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('all')}
        >
          📦 كافة الطلبات
          {activeOrders.length > 0 && (
            <span className={styles.badgeGreen}>{activeOrders.length}</span>
          )}
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'duplicates' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('duplicates')}
        >
          ⚠️ الطلبات المكررة
          {duplicateOrdersList.length > 0 && (
            <span className={styles.badge}>{duplicateOrdersList.length}</span>
          )}
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'archived' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('archived')}
        >
          📁 الطلبات المؤرشفة
        </button>
      </div>

      {/* Table Top Controls */}
      <div className={styles.tableControls}>
        <div className={styles.controlsLeft}>
          <div className={styles.neonSearchContainer}>
            <svg className={styles.neonSearchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="البحث في كل الحقول..." 
              className={styles.neonSearchInput} 
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.controlsRight}>
          <button className={styles.controlButton}>طباعة</button>
          <button className={styles.controlButton}>تصدير Excel</button>
        </div>
      </div>

      {/* Data Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '50px', verticalAlign: 'top' }}>
                <div className={styles.checkboxContainer} style={{ marginTop: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    className={styles.checkbox}
                    checked={isAllSelected}
                    onChange={toggleAllSelection}
                  />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>المعرف</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.id} onChange={(e) => handleFilterChange('id', e.target.value)} />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>الزبون</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.customerName} onChange={(e) => handleFilterChange('customerName', e.target.value)} />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>المحافظة</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.governorate} onChange={(e) => handleFilterChange('governorate', e.target.value)} />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>الهاتف</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.phone} onChange={(e) => handleFilterChange('phone', e.target.value)} />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>المبلغ الكلي</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.totalAmount} onChange={(e) => handleFilterChange('totalAmount', e.target.value)} />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>الحالة</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.status} onChange={(e) => handleFilterChange('status', e.target.value)} />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>تاريخ الإضافة</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.addDate} onChange={(e) => handleFilterChange('addDate', e.target.value)} />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>الموظف</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.employeeName} onChange={(e) => handleFilterChange('employeeName', e.target.value)} />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>الإجراءات</span>
                  <input type="text" className={styles.colFilterInput} disabled style={{ visibility: 'hidden' }} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length > 0 ? filteredOrders.map((order) => {
              const isSelected = selectedOrderIds.includes(order.id);
              
              return (
                <tr 
                  key={order.id} 
                  className={styles.tr}
                  style={isSelected ? { backgroundColor: 'var(--surface-hover)' } : {}}
                  onClick={() => toggleOrderSelection(order.id)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                     <div className={styles.checkboxContainer}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={isSelected}
                        onChange={() => toggleOrderSelection(order.id)}
                      />
                    </div>
                  </td>
                  <td>{order.id.slice(-6).toUpperCase()}</td>
                  <td>{order.customerName}</td>
                  <td>{order.governorate}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{order.customerPhone || order.phone}</td>
                  <td style={{ color: '#10B981', fontWeight: 'bold' }}>{order.formattedTotal} د.ع</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ 
                        backgroundColor: statusMap[order.status || 'pending']?.bg || 'rgba(148, 163, 184, 0.15)', 
                        color: statusMap[order.status || 'pending']?.color || '#94a3b8', 
                        padding: '0.35rem 1rem', borderRadius: '1.5rem', fontSize: '0.85rem', fontWeight: 'bold'
                      }}>
                        {statusMap[order.status || 'pending']?.label || 'جديد'}
                      </span>
                      {order.isPaidToStaff && (
                        <span style={{ 
                          backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                          color: '#10b981', 
                          padding: '0.2rem 0.6rem', 
                          borderRadius: '0.5rem', 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          ✔️ مدفوع للصافي
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem' }}>
                      <span>{order.addDate}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{order.addTime}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{order.employeeName || '---'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className={styles.actionButton} 
                        title="عرض التفاصيل"
                        onClick={() => setSelectedOrder(order)}
                      >
                        👁️
                      </button>
                      <button 
                        className={styles.actionButton} 
                        title="تعديل"
                        onClick={() => setEditingOrder({ ...order })}
                        style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                      >
                        ✏️
                      </button>
                      <button 
                        className={styles.actionButton} 
                        title="حذف الطلب"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderToDelete(order);
                        }}
                        style={{ borderColor: '#ef4444', color: '#ef4444' }}
                      >
                        🗑️
                      </button>
                      {activeTab === 'archived' && (
                        <button 
                           className={styles.actionButton} 
                           title="استعادة الطلب"
                           onClick={(e) => {
                             e.stopPropagation();
                             handleRestoreOrder(order.id);
                           }}
                           style={{ borderColor: '#10b981', color: '#10b981' }}
                         >
                           🔄
                         </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  لا توجد طلبات تطابق الفلتر الحالي.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order Details Modal (Newly added for POS structure) */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📄 تفاصيل الطلب <span style={{ color: 'var(--primary)', fontSize: '1rem', marginRight: '0.5rem' }}>#{selectedOrder.id.slice(-6).toUpperCase()}</span></h2>
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
                  <span className={styles.detailsValue} style={{direction: 'ltr', textAlign: 'right'}}>{selectedOrder.customerPhone || selectedOrder.phone || '---'}</span>
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
                  <span className={styles.detailsLabel}>تاريخ وتوقت الطلب</span>
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
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد أصناف في السلة لهذا الطلب</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.notesSection}>
                {selectedOrder.notes ? (
                  <><strong>ملاحظات:</strong> {selectedOrder.notes}</>
                ) : (
                  <span style={{opacity: 0.5}}>لا توجد ملاحظات</span>
                )}
              </div>
              <div className={styles.totalHighlight}>
                <span>المبلغ الكلي:</span>
                <span>{selectedOrder.formattedTotal} د.ع</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optional: Edit Order Modal */}
      {editingOrder && (
        <div className={styles.modalOverlay} onClick={() => setEditingOrder(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h2>✏️ تعديل الطلب <span style={{ color: 'var(--primary)', fontSize: '1rem', marginRight: '0.5rem' }}>#{editingOrder.id.slice(-6).toUpperCase()}</span></h2>
              <button className={styles.closeButton} onClick={() => setEditingOrder(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <form onSubmit={saveOrderUpdates} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم الزبون</label>
                  <input type="text" className={styles.input} value={editingOrder.customerName || ''} onChange={e => setEditingOrder({...editingOrder, customerName: e.target.value})} required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>رقم الهاتف</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={editingOrder.customerPhone || editingOrder.phone || ''} 
                    onChange={e => setEditingOrder({...editingOrder, customerPhone: e.target.value, phone: e.target.value})} 
                    required 
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className={styles.formGroup} style={{ flex: 1, position: 'relative' }}>
                    <label className={styles.label}>المحافظة</label>
                    <div className={styles.searchableSelectContainer}>
                      <input 
                        type="text" 
                        className={styles.input} 
                        placeholder="اختر المحافظة أو اكتب للبحث"
                        value={editingOrder.governorate || ''} 
                        onChange={e => setEditingOrder({...editingOrder, governorate: e.target.value})} 
                        onFocus={() => setShowGovDropdownEdit(true)}
                        onBlur={() => setTimeout(() => setShowGovDropdownEdit(false), 200)}
                      />
                      <div className={styles.selectArrow}>▼</div>
                    </div>
                    {showGovDropdownEdit && (
                      <ul className={styles.dropdownList}>
                        {governoratesList
                          .filter(g => g.includes(editingOrder.governorate || ''))
                          .map((gov, idx) => (
                            <li 
                              key={idx} 
                              className={styles.dropdownItem}
                              onClick={() => {
                                setEditingOrder({...editingOrder, governorate: gov});
                                setShowGovDropdownEdit(false);
                              }}
                            >
                              {gov}
                            </li>
                          ))
                        }
                        {governoratesList.filter(g => g.includes(editingOrder.governorate || '')).length === 0 && (
                          <li className={styles.noResults}>لا توجد نتائج تطابق بحثك</li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label className={styles.label}>المنطقة</label>
                    <input type="text" className={styles.input} value={editingOrder.region || ''} onChange={e => setEditingOrder({...editingOrder, region: e.target.value})} />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>الحالة</label>
                  <select className={styles.input} value={editingOrder.status} onChange={e => setEditingOrder({...editingOrder, status: e.target.value})}>
                    <option value="pending">قيد الانتظار (pending)</option>
                    <option value="processing">جاري التجهيز (processing)</option>
                    <option value="shipped">مشحون (shipped)</option>
                    <option value="delivered">مكتمل (delivered)</option>
                    <option value="cancelled">ملغي/مسترجع (cancelled/returned)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>الملاحظات</label>
                  <textarea className={styles.input} value={editingOrder.notes || ''} onChange={e => setEditingOrder({...editingOrder, notes: e.target.value})} rows={3}></textarea>
                </div>
                
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button type="button" className={styles.controlButton} onClick={() => setEditingOrder(null)}>إلغاء</button>
                  <button type="submit" className={styles.routeButton} disabled={isUpdating}>
                    {isUpdating ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Basic Notifications & Modals */}
      {notificationModal.show && (
        <div className={styles.modalOverlay}>
          <div className={styles.notificationModal}>
            <div className={styles.notificationContent}>
              <p>{notificationModal.message}</p>
              <button 
                className={styles.notificationBtn} 
                onClick={() => setNotificationModal({ show: false, message: '' })}
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Company Selection Modal */}
      {showCompanyModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCompanyModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>اختيار شركة الشحن</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setShowCompanyModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.companyList}>
                {/* Simulated Companies */}
                <div className={styles.companyCard} onClick={() => handleCompanySelection('زاجل')}>
                  <div className={styles.companyInfo}>
                    <div className={styles.companyIcon}>🚚</div>
                    <div className={styles.companyDetails}>
                      <span className={styles.companyName}>شركة زاجل للشحن</span>
                      <span className={styles.companyDesc}>توصيل سريع لكل المحافظات</span>
                    </div>
                  </div>
                  <div className={styles.routeIcon}>➔</div>
                </div>

                <div className={styles.companyCard} onClick={() => handleCompanySelection('أرامكس')}>
                  <div className={styles.companyInfo}>
                    <div className={styles.companyIcon}>✈️</div>
                    <div className={styles.companyDetails}>
                      <span className={styles.companyName}>أرامكس (Aramex)</span>
                      <span className={styles.companyDesc}>شحن دولي ومحلي</span>
                    </div>
                  </div>
                  <div className={styles.routeIcon}>➔</div>
                </div>

                <div className={styles.companyCard} onClick={() => handleCompanySelection('البريد العراقي')}>
                  <div className={styles.companyInfo}>
                    <div className={styles.companyIcon}>📮</div>
                    <div className={styles.companyDetails}>
                      <span className={styles.companyName}>البريد العراقي</span>
                      <span className={styles.companyDesc}>أسعار اقتصادية</span>
                    </div>
                  </div>
                  <div className={styles.routeIcon}>➔</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className={styles.modalOverlay} style={{ zIndex: 1200 }}>
          <div className={styles.modal} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: '#ef4444' }}>⚠️ تأكيد الحذف</h2>
              <button className={styles.closeButton} onClick={() => setOrderToDelete(null)}>×</button>
            </div>
            <div className={styles.modalBody} style={{ padding: '2rem' }}>
              <p>هل أنت متأكد من رغبتك في حذف الطلب رقم:</p>
              <h3 style={{ margin: '1rem 0', color: 'var(--accent-primary)' }}>#{orderToDelete.id.slice(-6).toUpperCase()}</h3>
              <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>باسم الزبون: <strong>{orderToDelete.customerName}</strong></p>
              <p style={{ marginTop: '1rem', color: '#fbbf24', fontSize: '0.85rem' }}>
                سيتم إعادة المواد المرتبطة بهذا الطلب إلى المخزن تلقائياً.
              </p>
            </div>
            <div className={styles.modalFooter} style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className={styles.submitButton} 
                style={{ background: '#ef4444' }}
                onClick={confirmDeleteOrder}
                disabled={isUpdating}
              >
                {isUpdating ? 'جاري الحذف...' : 'نعم، حذف'}
              </button>
              <button 
                className={styles.cancelButton} 
                onClick={() => setOrderToDelete(null)}
                disabled={isUpdating}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className={styles.modalOverlay} style={{ zIndex: 1200 }}>
          <div className={styles.modal} style={{ maxWidth: '450px', textAlign: 'center' }}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: '#ef4444' }}>🔴 تأكيد الحذف الجماعي</h2>
              <button className={styles.closeButton} onClick={() => setShowBulkDeleteModal(false)}>×</button>
            </div>
            <div className={styles.modalBody} style={{ padding: '2rem' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>هل أنت متأكد من رغبتك في حذف:</p>
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                padding: '1.5rem', 
                borderRadius: '12px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                marginBottom: '1.5rem'
              }}>
                <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ef4444' }}>{selectedOrderIds.length}</span>
                <p style={{ fontWeight: 'bold', marginTop: '0.5rem' }}>طلبات محددة</p>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#fbbf24' }}>
                سيتم حذف هذه الطلبات نهائياً من النظام وإعادة جميع المواد المرتبطة بها إلى المخزن تلقائياً. هذه العملية لا يمكن التراجع عنها.
              </p>
            </div>
            <div className={styles.modalFooter} style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className={styles.submitButton} 
                style={{ background: '#ef4444', flex: 1 }}
                onClick={confirmBulkDelete}
                disabled={isUpdating}
              >
                {isUpdating ? 'جاري الحذف...' : 'نعم، احذف الكل'}
              </button>
              <button 
                className={styles.cancelButton} 
                style={{ flex: 1 }}
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isUpdating}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
