"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import DateRangePicker from '../../../components/DateRangePicker';
import { db } from '../../../lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, writeBatch, getDoc, serverTimestamp, limit, runTransaction } from 'firebase/firestore';
import { createJenniShipment } from '../../../lib/jenni-api';

export default function OrdersListPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('الكل'); // Modified to show All conceptually first
  const [globalSearch, setGlobalSearch] = useState('');
  
  const [isSendingToDelivery, setIsSendingToDelivery] = useState(false);
  const currentUserId = 'default_tenant';
  
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
  const [isBarcodeMode, setIsBarcodeMode] = useState(false);
  const [showReturnReceiptModal, setShowReturnReceiptModal] = useState(false);
  
  // Wallets & Settlement State
  const [wallets, setWallets] = useState<any[]>([]);
  const [settlementModal, setSettlementModal] = useState<{show: boolean, type: 'inline' | 'bulk' | 'edit', orderIds: string[], oldStatus: string, selectedWalletId: string, editingOrderData?: any}>({ show: false, type: 'inline', orderIds: [], oldStatus: '', selectedWalletId: '' });
  const [receiverEmployee, setReceiverEmployee] = useState('');
  const [deliveryAgent, setDeliveryAgent] = useState('');
  const [employeesList, setEmployeesList] = useState<string[]>([]);
  const [returnsArchive, setReturnsArchive] = useState<any[]>([]);
  const [selectedReturnBatch, setSelectedReturnBatch] = useState<any | null>(null);
  const barcodeBufferRef = React.useRef('');


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
    'backordered': { label: 'بانتظار المخزون', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    'processing': { label: 'جاري التجهيز', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
    'shipped': { label: 'تم الشحن', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
    'delivered': { label: 'مكتمل', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    'cancelled': { label: 'ملغي', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    'returned': { label: 'راجع', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
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

  // Fetch Returns Batches Archive
  useEffect(() => {
    const q = query(collection(db, 'return_batches'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        let formattedDate = '---';
        if (data.timestamp) {
          const dateObj = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp);
          formattedDate = dateObj.toLocaleString('en-GB');
        }
        return { id: doc.id, ...data, formattedDate };
      });
      setReturnsArchive(docs);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Employees List for Returns Documentation
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employees'), (snap) => {
      const names = snap.docs.map(d => d.data().name).filter(Boolean);
      setEmployeesList(names);
    });
    return () => unsub();
  }, []);

  // Fetch Wallets for Settlement
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'wallets'), snap => setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  // Barcode Scanner Logic
  useEffect(() => {
    if (!isBarcodeMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If we are in barcode mode, we want to capture the input
      // However, we should be careful not to break normal typing if the user is intentionally typing in the search box
      // Barcode scanners usually type very fast.
      
      if (e.key === 'Enter') {
        const scanned = barcodeBufferRef.current.trim();
        if (scanned) {
          e.preventDefault();
          handleBarcodeScan(scanned);
        }
        barcodeBufferRef.current = '';
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBarcodeMode, orders, activeTab]);

  const handleBarcodeScan = (scanned: string) => {
    const found = orders.find(o => 
      o.id.toLowerCase() === scanned.toLowerCase() || 
      o.id.slice(-6).toLowerCase() === scanned.toLowerCase()
    );

    if (found) {
      setGlobalSearch(scanned); // Filter the table
      if (!selectedOrderIds.includes(found.id)) {
        setSelectedOrderIds(prev => [...prev, found.id]);
      }
      
      // If we are in the returns tab, maybe give visual feedback or show the quick confirm
      if (activeTab === 'returned') {
        setNotificationModal({ show: true, message: `✅ تم العثور على الطلب #${found.id.slice(-6).toUpperCase()}` });
      }
    } else {
      setNotificationModal({ show: true, message: `❌ لم يتم العثور على طلب برقم: ${scanned}` });
    }
  };


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

  const returnedOrdersList = activeOrders.filter(o => o.status === 'returned');

  const baseList = activeTab === 'archived' ? archivedOrdersList 
                 : activeTab === 'duplicates' ? duplicateOrdersList 
                 : activeTab === 'returned' ? returnedOrdersList
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

  const handleCompanySelection = async (companyName: string) => {
    if (selectedOrderIds.length === 0) return;
    
    setIsSendingToDelivery(true);
    try {
      const selectedOrdersData = orders.filter(o => selectedOrderIds.includes(o.id));
      let successCount = 0;
      let failCount = 0;
      let lastError = '';

      for (const orderData of selectedOrdersData) {
        if (orderData.status === 'shipped' || orderData.status === 'delivered') {
           failCount++;
           lastError = 'الطلب مشحون أو مكتمل مسبقاً';
           continue;
        }

        try {
          const response = await createJenniShipment(orderData, currentUserId);
          const shipmentId = response?.shipment_id || response?.data?.shipment_id || response?.id || '';

          const batch = writeBatch(db);
          const orderRef = doc(db, 'orders', orderData.id);
          
          batch.update(orderRef, {
             status: 'shipped',
             shipmentCompany: companyName,
             jenniShipmentId: shipmentId,
             updatedAt: serverTimestamp()
          });

          await syncStockForStatusChange(orderData.items || [], orderData.status, 'shipped', batch);
          await batch.commit();
          successCount++;
        } catch (err: any) {
          console.error("Failed to send order", orderData.id, err);
          failCount++;
          lastError = err.message;
        }
      }

      setShowCompanyModal(false);
      setSelectedOrderIds([]);
      
      if (failCount === 0) {
        setNotificationModal({ show: true, message: '✅ تم إرسال الطلب لشركة التوصيل بنجاح!' });
      } else if (successCount > 0) {
        setNotificationModal({ show: true, message: `✅ تم إرسال ${successCount} بنجاح. ❌ فشل ${failCount}. السبب: ${lastError}` });
      } else {
        setNotificationModal({ show: true, message: `❌ فشل الإرسال: ${lastError}` });
      }

    } catch (error: any) {
      console.error(error);
      setNotificationModal({ show: true, message: `❌ حدث خطأ: ${error.message || 'فشل الاتصال'}` });
    } finally {
      setIsSendingToDelivery(false);
    }
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

  const handleReturnStatusToggle = async (orderId: string, currentStatus: string) => {
    setIsUpdating(true);
    try {
      const newStatus = currentStatus === 'in_warehouse' ? 'with_delivery' : 'in_warehouse';
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { returnStatus: newStatus });
      setNotificationModal({ show: true, message: 'تم تحديث موقف البضاعة بنجاح!' });
    } catch (error) {
      console.error("Error updating return status:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء التحديث.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    const isFullyLocked = orderToDelete.status === 'delivered' || orderToDelete.status === 'returned' || orderToDelete.is_settled === true;
    if (isFullyLocked) {
       alert("لا يمكن حذف طلب تم تسليمه أو إرجاعه أو تسويته.");
       setOrderToDelete(null);
       return;
    }
    
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
      const validOrdersToDelete = selectedOrdersData.filter(o => {
         const isFullyLocked = o.status === 'delivered' || o.status === 'returned' || o.is_settled === true;
         return !isFullyLocked;
      });
      
      if (validOrdersToDelete.length === 0) {
         alert("لا توجد طلبات قابلة للحذف (مقفل بالكامل).");
         setIsUpdating(false);
         setShowBulkDeleteModal(false);
         return;
      }
      
      // Process each order for stock reversal
      for (const orderItem of validOrdersToDelete) {
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

  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('pending');

  const getStockState = (status: string) => {
    if (['shipped', 'delivered'].includes(status)) return 'HARD_DEDUCTED';
    if (['cancelled', 'returned'].includes(status)) return 'FREE';
    return 'SOFT_ALLOCATED'; // pending, processing, backordered, new
  };

  const applyStockTransition = (stock: any, oldState: string, newState: string, qty: number, defaultUnit: string) => {
      const changeReserved = (amount: number) => {
         const firstStoreKey = Object.keys(stock)[0] || 'default_store';
         if (!stock[firstStoreKey]) stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
         stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + amount;
      };

      const changeQuantity = (amount: number) => {
         if (amount > 0) {
           const firstStoreKey = Object.keys(stock)[0] || 'default_store';
           if (!stock[firstStoreKey]) stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
           stock[firstStoreKey].quantity += amount;
         } else {
           let remaining = Math.abs(amount);
           for (const storeId in stock) {
             if (remaining <= 0) break;
             if (stock[storeId].quantity > 0) {
               const deduct = Math.min(stock[storeId].quantity, remaining);
               stock[storeId].quantity -= deduct;
               remaining -= deduct;
             }
           }
           if (remaining > 0) {
             const firstStoreKey = Object.keys(stock)[0] || 'default_store';
             if (!stock[firstStoreKey]) stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
             stock[firstStoreKey].quantity -= remaining;
           }
         }
      };

      if (oldState === 'SOFT_ALLOCATED' && newState === 'HARD_DEDUCTED') {
         changeReserved(-qty);
         changeQuantity(-qty);
      } else if (oldState === 'SOFT_ALLOCATED' && newState === 'FREE') {
         changeReserved(-qty);
      } else if (oldState === 'HARD_DEDUCTED' && newState === 'FREE') {
         changeQuantity(qty);
      } else if (oldState === 'FREE' && newState === 'SOFT_ALLOCATED') {
         changeReserved(qty);
      } else if (oldState === 'FREE' && newState === 'HARD_DEDUCTED') {
         changeQuantity(-qty);
      } else if (oldState === 'HARD_DEDUCTED' && newState === 'SOFT_ALLOCATED') {
         changeQuantity(qty);
         changeReserved(qty);
      }
  };

  const syncStockForStatusChange = async (items: any[], oldStatus: string, newStatus: string, batch: any) => {
    const oldState = getStockState(oldStatus);
    const newState = getStockState(newStatus);
    
    if (oldState === newState) return; // No stock changes needed

    for (const item of items) {
      if (item.isComposite && item.composition) {
        for (const comp of item.composition) {
          const rawProdRef = doc(db, 'products', comp.itemId);
          const rawSnap = await getDoc(rawProdRef);
          if (rawSnap.exists()) {
            const rawData = rawSnap.data();
            let stock = { ...rawData.stock };
            let qty = comp.quantityNeeded * item.quantity;
            
            applyStockTransition(stock, oldState, newState, qty, rawData.units?.[0]?.type || 'قطعة');
            
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
          let qty = item.quantity;

          applyStockTransition(stock, oldState, newState, qty, prodData.units?.[0]?.type || 'قطعة');

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

  const handleInlineStatusChange = async (orderId: string, oldStatus: string, newStatus: string) => {
    if (oldStatus === newStatus) return;

    setIsUpdating(true);
    try {
      const orderToUpdate = orders.find(o => o.id === orderId);
      if (!orderToUpdate) return;
      
      const isFullyLocked = orderToUpdate.status === 'delivered' || orderToUpdate.status === 'returned' || orderToUpdate.is_settled === true;
      if (isFullyLocked) {
        alert("🔒 إجراء مرفوض: لا يمكن تغيير حالة طلب تم تسليمه، إرجاعه، أو تسويته مالياً.");
        setIsUpdating(false);
        return;
      }
      if (oldStatus === 'shipped') {
         alert("🔒 إجراء مرفوض: لا يمكن تغيير حالة طلب مشحون مباشرة من هنا (حماية محاسبية).");
         setIsUpdating(false);
         return;
      }

      const orderRef = doc(db, 'orders', orderId);
      const batch = writeBatch(db);

      batch.update(orderRef, { status: newStatus });

      await syncStockForStatusChange(orderToUpdate.items || [], oldStatus, newStatus, batch);

      await batch.commit();
      setNotificationModal({ show: true, message: 'تم تحديث حالة الطلب بنجاح' });
    } catch (error) {
      console.error("Error updating inline order status:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء تحديث الحالة' });
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmBulkStatusChange = async () => {
    if (selectedOrderIds.length === 0) return;

    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      let updatedCount = 0;
      for (const orderId of selectedOrderIds) {
        const orderToUpdate = orders.find(o => o.id === orderId);
        if (!orderToUpdate) continue;
        
        const isFullyLocked = orderToUpdate.status === 'delivered' || orderToUpdate.status === 'returned' || orderToUpdate.is_settled === true;
        if (isFullyLocked || orderToUpdate.status === 'shipped') continue; // Skip locked or shipped orders
        
        const oldStatus = orderToUpdate.status || 'pending';
        const newStatus = bulkStatusValue;
        
        if (oldStatus !== newStatus) {
          updatedCount++;
          const orderRef = doc(db, 'orders', orderId);
          batch.update(orderRef, { status: newStatus });

          await syncStockForStatusChange(orderToUpdate.items || [], oldStatus, newStatus, batch);
        }
      }
      
      if (updatedCount > 0) {
        await batch.commit();
        setNotificationModal({ show: true, message: `تم تحديث حالة ${updatedCount} طلبات بنجاح. تم تجاهل الطلبات المقفلة.` });
      } else {
        setNotificationModal({ show: true, message: 'لم يتم تحديث أي طلب (جميع الطلبات المحددة مقفلة).' });
      }
      setShowBulkStatusModal(false);
      setSelectedOrderIds([]);
    } catch (error) {
      console.error("Error updating bulk order status:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء التحديث الجماعي' });
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
      if (!oldOrder) return;
      
      const isFullyLocked = oldOrder.status === 'delivered' || oldOrder.status === 'returned' || oldOrder.is_settled === true;
      if (isFullyLocked) {
        alert("🔒 إجراء مرفوض: لا يمكن تعديل طلب تم تسليمه، إرجاعه، أو تسويته مالياً.");
        setIsUpdating(false);
        setEditingOrder(null);
        return;
      }
      
      const isPartiallyLocked = oldOrder.status === 'shipped';
      if (isPartiallyLocked) {
        // Force reset locked fields to old values
        editingOrder.customerName = oldOrder.customerName;
        editingOrder.region = oldOrder.region;
        editingOrder.status = oldOrder.status;
        editingOrder.employeeName = oldOrder.employeeName;
      }
      
      const orderRef = doc(db, 'orders', editingOrder.id);
      const batch = writeBatch(db);

      batch.update(orderRef, {
        customerName: editingOrder.customerName || '',
        customerPhone: editingOrder.customerPhone || editingOrder.phone || '',
        governorate: editingOrder.governorate || '',
        region: editingOrder.region || '',
        notes: editingOrder.notes || '',
        status: editingOrder.status || 'pending',
        employeeName: editingOrder.employeeName || ''
      });

      // Handle Stock Logic if status changed
      if (oldOrder && oldOrder.status !== editingOrder.status) {
        await syncStockForStatusChange(oldOrder.items || [], oldOrder.status, editingOrder.status, batch);
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

  const confirmSettlement = async () => {
    if (!settlementModal.selectedWalletId) {
      setNotificationModal({ show: true, message: 'الرجاء اختيار المحفظة للإيداع.' });
      return;
    }
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      let totalAmountToDeposit = 0;
      const walletId = settlementModal.selectedWalletId;
      const selectedWallet = wallets.find(w => w.id === walletId);
      const walletName = selectedWallet?.name || 'محفظة غير معروفة';
      
      const ordersToUpdate = orders.filter(o => settlementModal.orderIds.includes(o.id));

      for (const orderToUpdate of ordersToUpdate) {
        const orderRef = doc(db, 'orders', orderToUpdate.id);
        
        batch.update(orderRef, { 
          paymentStatus: 'settled',
          settledWalletId: walletId,
          settledWalletName: walletName
        });
        
        const amt = Number(orderToUpdate.totalAmount || orderToUpdate.price || 0);
        totalAmountToDeposit += amt;
      }

      if (totalAmountToDeposit > 0) {
        const treasuryRef = doc(collection(db, 'treasury_transactions'));
        const now = new Date();
        const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const date = now.toISOString().split('T')[0];
        
        let details = '';
        if (settlementModal.type === 'bulk') {
          details = `إيداع آلي لتسوية مجمعة لـ ${settlementModal.orderIds.length} طلبات`;
        } else {
          const o = ordersToUpdate[0];
          details = `إيداع آلي لتسوية الطلب #${o.id.slice(-6).toUpperCase()} (${o.customerName || ''})`;
        }

        batch.set(treasuryRef, {
          type: 'deposit',
          walletId: walletId,
          amount: totalAmountToDeposit,
          currency: 'IQD',
          date: date,
          time: time,
          details: details,
          createdAt: serverTimestamp(),
          isAutomated: true,
          settledOrderIds: settlementModal.orderIds
        });
      }

      await batch.commit();
      
      if (settlementModal.type === 'bulk') {
         setSelectedOrderIds([]); 
      }
      if (settlementModal.type === 'edit') {
         setEditingOrder(null);
      }
      
      setSettlementModal({ ...settlementModal, show: false });
      setNotificationModal({ show: true, message: `✅ تم تسوية ${settlementModal.orderIds.length} طلب/طلبات وإيداع المبلغ بنجاح!` });
    } catch (err) {
      console.error("Error during settlement:", err);
      setNotificationModal({ show: true, message: '❌ حدث خطأ أثناء عملية التسوية.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmReturnReceipt = async () => {
    if (!receiverEmployee || !deliveryAgent || selectedOrderIds.length === 0) return;
    setIsUpdating(true);
    try {
      // 0. Generate Sequential Batch ID
      const counterRef = doc(db, 'metadata', 'returnBatchCounter');
      const batchId = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let currentId = 1000;
        if (counterSnap.exists()) {
          currentId = counterSnap.data().lastId;
        }
        const newId = currentId + 1;
        transaction.set(counterRef, { lastId: newId }, { merge: true });
        return `BATCH-${newId}`;
      });

      const batch = writeBatch(db);
      const batchDocRef = doc(collection(db, 'return_batches'));
      
      const orderDetailsForBatch: any[] = [];

      for (const orderId of selectedOrderIds) {
        const orderRef = doc(db, 'orders', orderId);
        const orderData = orders.find(o => o.id === orderId);
        
        // 1. Update internal Return Status AND Archive it
        batch.update(orderRef, { 
          returnStatus: 'in_warehouse',
          isArchived: true,
          archivedAt: serverTimestamp()
        });

        if (orderData) {
          orderDetailsForBatch.push({
            id: orderId,
            customerName: orderData.customerName || 'غير معروف',
            totalAmount: orderData.totalAmount || 0,
            status: orderData.status
          });
        }
      }

      // 2. Create the Batch Document
      batch.set(batchDocRef, {
        batchId: batchId,
        driverName: deliveryAgent,
        employeeName: receiverEmployee,
        timestamp: serverTimestamp(),
        totalOrders: selectedOrderIds.length,
        orderIds: selectedOrderIds,
        orders: orderDetailsForBatch // Storing basic info for easy preview
      });

      await batch.commit();
      setShowReturnReceiptModal(false);
      setSelectedOrderIds([]);
      setNotificationModal({ show: true, message: `✅ تم إنشاء كشف المرتجعات رقم ${batchId} بنجاح` });
    } catch (error) {
      console.error("Error confirming return receipt batch:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء إنشاء الكشف' });
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
              {selectedOrderIds.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#2a2d3d', border: '1px solid rgba(255,255,255,0.1)', padding: '0.3rem 0.8rem', borderRadius: '0.5rem' }}>
                  <span style={{color: '#ffffff', fontWeight: 'bold', fontSize: '1rem'}}>حالة الطلبات:</span>
                  <select 
                    style={{
                      backgroundColor: 'transparent', color: '#ffffff', border: 'none', 
                      padding: '0.2rem', outline: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem'
                    }}
                    value={bulkStatusValue}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      setBulkStatusValue(newStatus);
                      setShowBulkStatusModal(true);
                    }}
                  >
                    <option value="" disabled style={{color: '#ffffff', backgroundColor: '#1e1e2d'}}>اختر الحالة...</option>
                    {Object.entries(statusMap).map(([key, info]) => (
                       <option key={key} value={key} style={{color: '#ffffff', backgroundColor: '#1e1e2d'}}>{info.label} ({key})</option>
                    ))}
                  </select>
                </div>
              )}

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

              {activeTab === 'returned' && selectedOrderIds.length > 0 && (
                <button 
                  className={styles.routeButton} 
                  onClick={() => setShowReturnReceiptModal(true)}
                  style={{ backgroundColor: '#f97316', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)' }}
                >
                  <span>📝 تأكيد استلام الطلبات المحددة</span>
                </button>
              )}

              {selectedOrderIds.length > 0 && (
                <button 
                  className={styles.routeButton} 
                  onClick={() => {
                    const selectedOrdersData = orders.filter(o => selectedOrderIds.includes(o.id));
                    const allValid = selectedOrdersData.every(o => o.status === 'delivered' && o.paymentStatus !== 'settled');
                    if (!allValid) {
                      setNotificationModal({ show: true, message: 'التسوية متاحة فقط للطلبات المكتملة التي لم تتم تسويتها مسبقاً.' });
                      return;
                    }
                    setSettlementModal({ show: true, type: 'bulk', orderIds: selectedOrderIds, oldStatus: '', selectedWalletId: '' });
                  }}
                  style={{ backgroundColor: '#10b981', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                >
                  <span>💰 تسوية المحددة</span>
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
          className={`${styles.tabButton} ${activeTab === 'returned' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('returned')}
        >
          ↩️ تأكيد استلام الراجعات
          {returnedOrdersList.length > 0 && (
            <span className={styles.badge} style={{ backgroundColor: '#f97316' }}>{returnedOrdersList.length}</span>
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
        <button 
          className={`${styles.tabButton} ${activeTab === 'returns_archive' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('returns_archive')}
          style={{ backgroundColor: activeTab === 'returns_archive' ? '#8b5cf6' : 'transparent', color: activeTab === 'returns_archive' ? '#fff' : 'var(--text-muted)' }}
        >
          📜 سجل استلام الراجعات
        </button>
      </div>

      {/* Table Top Controls */}
      <div className={styles.tableControls}>
        <div className={styles.controlsLeft}>
          <div className={styles.neonSearchContainer} style={{ position: 'relative', flex: 1 }}>
            <svg className={styles.neonSearchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="البحث في كل الحقول..." 
              className={styles.neonSearchInput} 
              style={{ paddingLeft: '3.5rem', paddingRight: '1rem' }}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
            <button 
              onClick={() => {
                setIsBarcodeMode(!isBarcodeMode);
                if (!isBarcodeMode) {
                  setNotificationModal({ show: true, message: '⚡ تم تفعيل وضع الباركود' });
                }
              }}
              style={{
                position: 'absolute',
                left: '0.8rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isBarcodeMode ? '#10b981' : '#64748b',
                filter: isBarcodeMode ? 'drop-shadow(0 0 5px rgba(16, 185, 129, 0.5))' : 'none',
                transition: 'all 0.3s ease'
              }}
              title={isBarcodeMode ? "إيقاف الباركود" : "تفعيل الباركود"}
            >
              🏷️
            </button>
          </div>
        </div>
        <div className={styles.controlsRight}>
          <button className={styles.controlButton}>طباعة</button>
          <button className={styles.controlButton}>تصدير Excel</button>
        </div>
      </div>

      {/* Data Table */}
      {activeTab !== 'returns_archive' && (
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
              {activeTab === 'returned' && (
                <th style={{ width: '180px' }}>
                  <div className={styles.thContent}>
                    <span>موقف البضاعة</span>
                  </div>
                </th>
              )}
              <th style={{ width: '160px' }}>
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
              const isFullyLocked = order.status === 'delivered' || order.status === 'returned' || order.is_settled === true;
              
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
                      <select 
                        style={{ 
                          backgroundColor: statusMap[order.status || 'pending']?.bg || 'rgba(148, 163, 184, 0.15)', 
                          color: statusMap[order.status || 'pending']?.color || '#94a3b8', 
                          padding: '0.35rem 0.5rem', 
                          borderRadius: '1.5rem', 
                          fontSize: '0.85rem', 
                          fontWeight: 'bold',
                          border: 'none',
                          outline: 'none',
                          cursor: 'pointer',
                          appearance: 'none',
                          textAlign: 'center'
                        }}
                        value={order.status || 'pending'}
                        onChange={(e) => handleInlineStatusChange(order.id, order.status || 'pending', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {Object.entries(statusMap).map(([key, info]) => (
                          <option key={key} value={key} style={{color: '#ffffff', backgroundColor: '#1e1e2d', textAlign: 'right'}}>
                            {info.label} ({key})
                          </option>
                        ))}
                      </select>
                      {order.paymentStatus === 'settled' && (
                        <span style={{ 
                          backgroundColor: '#10b981', 
                          color: '#fff', 
                          padding: '0.2rem 0.4rem', 
                          borderRadius: '0.4rem', 
                          fontSize: '0.65rem', 
                          fontWeight: 'bold'
                        }}>
                          [تمت التسوية]
                        </span>
                      )}
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
                        {order.isPaidToStaff ? '✔️ عمولة مدفوعة' : '⏳ بانتظار الدفع'}
                      </span>
                      )}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem' }}>
                      <span>{order.addDate}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{order.addTime}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{order.employeeName || '---'}</td>
                  {activeTab === 'returned' && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleReturnStatusToggle(order.id, order.returnStatus)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.85rem',
                          backgroundColor: order.returnStatus === 'in_warehouse' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                          color: order.returnStatus === 'in_warehouse' ? '#10b981' : '#f97316',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {order.returnStatus === 'in_warehouse' ? '✅ تم الاستلام بالمخزن' : '🚚 بذمة المندوب'}
                      </button>
                    </td>
                  )}
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {order.status === 'delivered' && order.paymentStatus !== 'settled' && (
                        <button 
                          className={styles.actionButton} 
                          title="تسوية مالية"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSettlementModal({ show: true, type: 'inline', orderIds: [order.id], oldStatus: order.status, selectedWalletId: '' });
                          }}
                          style={{ borderColor: '#10b981', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)' }}
                        >
                          💰
                        </button>
                      )}
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
                        onClick={() => !isFullyLocked && setEditingOrder({ ...order })}
                        style={{ 
                          borderColor: isFullyLocked ? '#475569' : '#3b82f6', 
                          color: isFullyLocked ? '#475569' : '#3b82f6',
                          opacity: isFullyLocked ? 0.5 : 1,
                          cursor: isFullyLocked ? 'not-allowed' : 'pointer'
                        }}
                        disabled={isFullyLocked}
                      >
                        ✏️
                      </button>
                      <button 
                        className={styles.actionButton} 
                        title="حذف الطلب"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isFullyLocked) setOrderToDelete(order);
                        }}
                        style={{ 
                          borderColor: isFullyLocked ? '#475569' : '#ef4444', 
                          color: isFullyLocked ? '#475569' : '#ef4444',
                          opacity: isFullyLocked ? 0.5 : 1,
                          cursor: isFullyLocked ? 'not-allowed' : 'pointer'
                        }}
                        disabled={isFullyLocked}
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
      )}

      {activeTab === 'returns_archive' && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.trHead}>
                <th>رقم الكشف</th>
                <th>المندوب المسلم</th>
                <th>الموظف المستلم</th>
                <th>عدد الطلبات</th>
                <th>التاريخ</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {returnsArchive.map((record) => (
                <tr key={record.id} className={styles.tr}>
                  <td style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{record.batchId}</td>
                  <td style={{ color: '#f97316', fontWeight: 'bold' }}>🚚 {record.driverName}</td>
                  <td style={{ color: '#10b981', fontWeight: 'bold' }}>👤 {record.employeeName}</td>
                  <td>
                    <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontWeight: 'bold' }}>
                      {record.totalOrders} طلبات
                    </span>
                  </td>
                  <td>{record.formattedDate}</td>
                  <td>
                    <button 
                      className={styles.actionButton} 
                      title="عرض الطلبات"
                      onClick={() => setSelectedReturnBatch(record)}
                    >
                      👁️ عرض التفاصيل
                    </button>
                  </td>
                </tr>
              ))}
              {returnsArchive.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    لا توجد كشوفات راجعات مستلمة حالياً.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
                {selectedOrder.paymentStatus === 'settled' && (
                  <div className={styles.detailsItem}>
                    <span className={styles.detailsLabel} style={{ color: '#10b981' }}>تم استلام المبلغ إلى</span>
                    <span className={styles.detailsValue} style={{ color: '#10b981', fontWeight: 'bold' }}>
                      💰 الخزينة {selectedOrder.settledWalletName ? `(${selectedOrder.settledWalletName})` : ''}
                    </span>
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
      {editingOrder && (() => {
        const originalOrder = orders.find(o => o.id === editingOrder.id);
        const isPartiallyLocked = originalOrder?.status === 'shipped';
        const lockedInputStyle = isPartiallyLocked ? { backgroundColor: '#1e293b', color: '#94a3b8', cursor: 'not-allowed' } : {};
        
        return (
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
                  <input type="text" className={styles.input} value={editingOrder.customerName || ''} onChange={e => setEditingOrder({...editingOrder, customerName: e.target.value})} required disabled={isPartiallyLocked} style={lockedInputStyle} />
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
                    <input type="text" className={styles.input} value={editingOrder.region || ''} onChange={e => setEditingOrder({...editingOrder, region: e.target.value})} disabled={isPartiallyLocked} style={lockedInputStyle} />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>الحالة</label>
                  <select className={styles.input} value={editingOrder.status} onChange={e => setEditingOrder({...editingOrder, status: e.target.value})} disabled={isPartiallyLocked} style={lockedInputStyle}>
                    <option value="pending">قيد الانتظار (pending)</option>
                    <option value="backordered">بانتظار المخزون (backordered)</option>
                    <option value="processing">جاري التجهيز (processing)</option>
                    <option value="shipped">مشحون (shipped)</option>
                    <option value="delivered">مكتمل (delivered)</option>
                    <option value="cancelled">ملغي (cancelled)</option>
                    <option value="returned">راجع (returned)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم الموظف</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={editingOrder.employeeName || ''} 
                    onChange={e => setEditingOrder({...editingOrder, employeeName: e.target.value})} 
                    disabled={isPartiallyLocked}
                    style={lockedInputStyle}
                  />
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
        );
      })()}

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
                <button 
                  className={styles.companyCard} 
                  onClick={() => handleCompanySelection('Jenni Logistics')}
                  disabled={isSendingToDelivery}
                  style={{ 
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', 
                    cursor: isSendingToDelivery ? 'not-allowed' : 'pointer', 
                    width: '100%', textAlign: 'right', display: 'flex', 
                    justifyContent: 'space-between', alignItems: 'center', 
                    opacity: isSendingToDelivery ? 0.5 : 1, padding: '1rem', borderRadius: '12px',
                    fontFamily: 'inherit'
                  }}
                >
                  <div className={styles.companyInfo} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className={styles.companyIcon} style={{ fontSize: '1.8rem' }}>🚚</div>
                    <div className={styles.companyDetails} style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className={styles.companyName} style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#fff' }}>Jenni Logistics (نظام قسورة)</span>
                      <span className={styles.companyDesc} style={{ fontSize: '0.85rem', color: '#10b981' }}>إرسال تلقائي عبر API</span>
                    </div>
                  </div>
                  {isSendingToDelivery ? (
                    <div style={{ width: '20px', height: '20px', border: '2px solid #10b981', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  ) : (
                    <div className={styles.routeIcon} style={{ color: '#fff' }}>➔</div>
                  )}
                </button>

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

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBulkDeleteModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>⚠️ تأكيد الحذف الجماعي</h2>
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
      {/* Bulk Status Update Modal */}
      {showBulkStatusModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBulkStatusModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>🔄 تأكيد التحديث الجماعي للحالة</h2>
              <button className={styles.closeButton} onClick={() => setShowBulkStatusModal(false)}>×</button>
            </div>
            <div className={styles.modalBody} style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                هل أنت متأكد من تغيير حالة <strong>{selectedOrderIds.length}</strong> طلبات إلى <br/>
                <span style={{ 
                  display: 'inline-block',
                  marginTop: '1rem',
                  padding: '0.5rem 1.5rem', 
                  borderRadius: '2rem', 
                  backgroundColor: statusMap[bulkStatusValue]?.bg || '#f1f5f9',
                  color: statusMap[bulkStatusValue]?.color || '#333',
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}>
                  {statusMap[bulkStatusValue]?.label}
                </span>
                ؟
              </p>
              {(bulkStatusValue === 'cancelled' || bulkStatusValue === 'returned') && (
                <p style={{ color: '#fbbf24', fontSize: '0.9rem', marginTop: '1rem' }}>
                  ملاحظة: سيتم إرجاع المواد للمخزن تلقائياً.
                </p>
              )}
            </div>
            <div className={styles.modalFooter} style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className={styles.submitButton} 
                onClick={confirmBulkStatusChange}
                disabled={isUpdating}
                style={{ flex: 1 }}
              >
                {isUpdating ? 'جاري التحديث...' : 'نعم، تحديث الحالة'}
              </button>
              <button 
                className={styles.cancelButton} 
                onClick={() => setShowBulkStatusModal(false)}
                disabled={isUpdating}
                style={{ flex: 1 }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Receipt Documentation Modal */}
      {showReturnReceiptModal && (
        <div className={styles.modalOverlay} onClick={() => setShowReturnReceiptModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h2>📝 توثيق استلام المرجوعات</h2>
              <button className={styles.closeButton} onClick={() => setShowReturnReceiptModal(false)}>×</button>
            </div>
            <div className={styles.modalBody} style={{ padding: '2rem' }}>
              <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                أنت على وشك تأكيد استلام <strong>{selectedOrderIds.length}</strong> طلبات. يرجى إدخال بيانات التسليم للتوثيق.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم الموظف المستلم <span style={{color: 'red'}}>*</span></label>
                  <select 
                    className={styles.input} 
                    value={receiverEmployee} 
                    onChange={e => setReceiverEmployee(e.target.value)}
                    required
                  >
                    <option value="">اختر الموظف...</option>
                    {employeesList.map((name, idx) => (
                      <option key={idx} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم/رقم المندوب المُسلّم <span style={{color: 'red'}}>*</span></label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="مثال: علي المندوب أو 077..." 
                    value={deliveryAgent}
                    onChange={e => setDeliveryAgent(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter} style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className={styles.submitButton} 
                onClick={handleConfirmReturnReceipt}
                disabled={isUpdating || !receiverEmployee || !deliveryAgent}
                style={{ flex: 1, backgroundColor: '#f97316' }}
              >
                {isUpdating ? 'جاري الحفظ...' : 'تأكيد وحفظ الكشف'}
              </button>
              <button 
                className={styles.cancelButton} 
                onClick={() => setShowReturnReceiptModal(false)}
                style={{ flex: 1 }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Batch Details Modal */}
      {selectedReturnBatch && (
        <div className={styles.modalOverlay} onClick={() => setSelectedReturnBatch(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <h2>📦 تفاصيل كشف المرتجعات <span style={{ color: 'var(--primary)', fontSize: '1rem', marginRight: '0.5rem' }}>{selectedReturnBatch.batchId}</span></h2>
              <button className={styles.closeButton} onClick={() => setSelectedReturnBatch(null)}>×</button>
            </div>
            <div className={styles.modalBody} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', background: 'var(--surface)', padding: '1rem', borderRadius: '8px' }}>
                <div><strong>الموظف المستلم:</strong> {selectedReturnBatch.employeeName}</div>
                <div><strong>المندوب المسلم:</strong> {selectedReturnBatch.driverName}</div>
                <div><strong>تاريخ الكشف:</strong> {selectedReturnBatch.formattedDate}</div>
                <div><strong>إجمالي الطلبات:</strong> {selectedReturnBatch.totalOrders}</div>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr className={styles.trHead}>
                    <th>المعرف</th>
                    <th>اسم الزبون</th>
                    <th>المبلغ</th>
                    <th>حالة الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReturnBatch.orders?.map((ord: any, idx: number) => (
                    <tr key={idx} className={styles.tr}>
                      <td style={{ fontWeight: 'bold' }}>#{ord.id?.slice(-6).toUpperCase()}</td>
                      <td>{ord.customerName}</td>
                      <td>{new Intl.NumberFormat('en-US').format(ord.totalAmount)} د.ع</td>
                      <td>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '1rem', 
                          backgroundColor: statusMap[ord.status]?.bg || '#f1f5f9',
                          color: statusMap[ord.status]?.color || '#333',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {statusMap[ord.status]?.label || ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.submitButton} onClick={() => window.print()} style={{ backgroundColor: '#4b5563' }}>طباعة الكشف</button>
              <button className={styles.cancelButton} onClick={() => setSelectedReturnBatch(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {settlementModal.show && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.modalIcon}>💰</div>
            <h3 className={styles.modalTitle}>تسوية الطلبات وإيداع المبلغ</h3>
            <p className={styles.modalText}>
              لقد اخترت تحويل {settlementModal.orderIds.length} طلب/طلبات إلى حالة "مكتمل".<br/>
              الرجاء اختيار المحفظة لإيداع مبالغ الطلبات (المجموع الكلي).
            </p>
            <div style={{ marginTop: '1rem', width: '100%', textAlign: 'right' }}>
               <label className={styles.modalLabel} style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>المحفظة (إلزامي)</label>
               <select 
                 className={styles.modalInput} 
                 style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '1rem' }}
                 value={settlementModal.selectedWalletId} 
                 onChange={e => setSettlementModal({...settlementModal, selectedWalletId: e.target.value})}
               >
                 <option value="">-- اختر المحفظة --</option>
                 {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
               </select>
            </div>
            <div className={styles.modalActions} style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button 
                className={styles.confirmDeleteBtn} 
                style={{ backgroundColor: '#10b981', borderColor: '#10b981', flex: 1, padding: '0.75rem', borderRadius: '8px', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                onClick={confirmSettlement}
                disabled={isUpdating}
              >
                {isUpdating ? 'جاري التسوية...' : 'تأكيد التسوية والإيداع'}
              </button>
              <button 
                className={styles.cancelDeleteBtn} 
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                onClick={() => setSettlementModal({ ...settlementModal, show: false })}
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
