"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Barcode from 'react-barcode';
import styles from './page.module.css';
import DateRangePicker from '../../../components/DateRangePicker';
import { db, auth } from "../../../lib/firebase";
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, writeBatch, getDoc, serverTimestamp, limit, runTransaction } from 'firebase/firestore';
import { createJenniShipment } from '../../../lib/jenni-api';
import * as XLSX from 'xlsx';

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
  const [baseProducts, setBaseProducts] = useState<any[]>([]);
  const [compositeProductsData, setCompositeProductsData] = useState<any[]>([]);
  const [categoriesDb, setCategoriesDb] = useState<any[]>([]);
  const [pagesDb, setPagesDb] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  
  const [searchQueryEdit, setSearchQueryEdit] = useState('');
  const [showProductDropdownEdit, setShowProductDropdownEdit] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('all'); 
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBarcodeMode, setIsBarcodeMode] = useState(false);
  const [showReturnReceiptModal, setShowReturnReceiptModal] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Settlement states and wallets removed (Moved to Treasury Page)
  const [receiverEmployee, setReceiverEmployee] = useState('');
  const [deliveryAgent, setDeliveryAgent] = useState('');
  const [employeesList, setEmployeesList] = useState<string[]>([]);
  const [returnsArchive, setReturnsArchive] = useState<any[]>([]);
  const [selectedReturnBatch, setSelectedReturnBatch] = useState<any | null>(null);
  const [selectedReturnMonth, setSelectedReturnMonth] = useState<string | null>(null);
  const [selectedReturnDay, setSelectedReturnDay] = useState<string | null>(null);
  const [selectedBatchOrderIds, setSelectedBatchOrderIds] = useState<string[]>([]);
  const barcodeBufferRef = React.useRef('');

  const [showBulkDropdown, setShowBulkDropdown] = useState(false);
  const bulkActionsRef = React.useRef<HTMLDivElement>(null);
  const [showBulkSelectModal, setShowBulkSelectModal] = useState(false);
  const [bulkSelectText, setBulkSelectText] = useState('');

  const [showStatusFilterDropdown, setShowStatusFilterDropdown] = useState(false);
  const statusFilterRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bulkActionsRef.current && !bulkActionsRef.current.contains(event.target as Node)) {
        setShowBulkDropdown(false);
      }
      if (statusFilterRef.current && !statusFilterRef.current.contains(event.target as Node)) {
        setShowStatusFilterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


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
    notes: '',
    status: '',
    addDate: '',
    addTime: '',
    employeeName: '',
    shippingCompany: ''
  });

  useEffect(() => {
    setSelectedStatus('all');
    setShowOnlySelected(false);
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [globalSearch, columnFilters, activeTab, selectedStatus, showOnlySelected]);

  // Status Configuration
  const statusMap: Record<string, { label: string, color: string, bg: string }> = {
    'pending': { label: 'قيد الانتظار', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)' },
    'in_progress': { label: 'قيد التنفيذ', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    'backordered': { label: 'بانتظار المخزون', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    'processing': { label: 'جاري التجهيز', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
    'shipped': { label: 'تم الشحن', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
    'ofd': { label: 'قيد التوصيل', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    'delivered': { label: 'مكتمل', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    'cancelled': { label: 'ملغي', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    'returned': { label: 'راجع', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    'new': { label: 'جديد', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
    'postponed': { label: 'مؤجل', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' }
  };

  // Fetch Orders from Firestore
  useEffect(() => {
    // A simple query, assuming orders might not all have dates, we just order by client-side or we can order by date desc.
    // Ensure you have an index if using orderBy('date', 'desc'). For now, we fetch all and sort client-side.
    const q = process.env.NEXT_PUBLIC_REQUIRE_INDEX ? query(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders'), orderBy('date', 'desc')) : collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders');
    
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

  // Fetch products from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'), (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBaseProducts(pData);
    });
    return () => unsub();
  }, []);

  // Fetch composite products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'composite_products'), (snapshot) => {
      const cData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompositeProductsData(cData);
    });
    return () => unsub();
  }, []);

  // Fetch categories
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories'), (snapshot) => {
      setCategoriesDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch pages_stores
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'pages_stores'), (snapshot) => {
      setPagesDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const products = React.useMemo(() => {
    const merged = [...baseProducts];
    
    compositeProductsData.forEach(cp => {
      let minBundles = Infinity;
      if (cp.composition && cp.composition.length > 0) {
        for (const comp of cp.composition) {
          const prod = baseProducts.find(p => p.id === comp.itemId);
          if (!prod) { minBundles = 0; break; }
          
          let totalStock = 0;
          if (prod.stock) {
            for (const storeId in prod.stock) {
              totalStock += prod.stock[storeId].quantity || 0;
            }
          }
          const canMake = Math.floor(totalStock / comp.quantityNeeded);
          if (canMake < minBundles) minBundles = canMake;
        }
      } else {
        minBundles = 0;
      }
      if (minBundles === Infinity) minBundles = 0;

      merged.push({
        id: cp.id,
        name: cp.name,
        barcode: '',
        units: [{ selling: cp.sellingPrice || 0, type: 'بكج' }],
        stock: { 'virtual_store': { quantity: minBundles, unit: 'بكج' } },
        isComposite: true,
        composition: cp.composition || []
      });
    });
    
    return merged;
  }, [baseProducts, compositeProductsData]);

  // Fetch Returns Batches Archive
  useEffect(() => {
    const q = query(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'return_batches'), orderBy('timestamp', 'desc'), limit(100));
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
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'employees'), (snap) => {
      const names = snap.docs.map(d => d.data().name).filter(Boolean);
      setEmployeesList(names);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'shipping_companies'), (snap) => {
      const companies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setShippingCompanies(companies);
    });
    return () => unsub();
  }, []);

  // Barcode Scanner Logic for scanners without Enter key
  useEffect(() => {
    if (!isBarcodeMode || !globalSearch) return;
    
    const terms = globalSearch.split(',').map(t => t.trim().toLowerCase());
    const lastTerm = terms[terms.length - 1];
    
    if (lastTerm && lastTerm.length >= 4) {
      const found = orders.find(o => 
        o.id.toLowerCase() === lastTerm || 
        o.id.slice(-6).toLowerCase() === lastTerm
      );
      
      if (found) {
        setSelectedOrderIds(prev => {
          if (!prev.includes(found.id)) return [...prev, found.id];
          return prev;
        });
        
        // Auto-append comma for the next scan!
        if (!globalSearch.endsWith(', ')) {
          setGlobalSearch(prev => prev + ', ');
        }
      }
    }
  }, [globalSearch, isBarcodeMode, orders]);

  // Original Barcode Scanner Logic (for Enter key)
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
      setGlobalSearch(prev => {
        if (!prev) return scanned;
        const terms = prev.split(',').map(t => t.trim().toLowerCase());
        if (terms.includes(scanned.toLowerCase())) return prev;
        return `${prev}, ${scanned}`;
      });
      
      setSelectedOrderIds(prev => {
        if (!prev.includes(found.id)) return [...prev, found.id];
        return prev;
      });
      
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

  const handleBulkSelectSubmit = () => {
    if (!bulkSelectText.trim()) return;
    
    const searchIds = bulkSelectText
      .split(/[\n,\s]+/)
      .map(id => id.trim().toLowerCase())
      .filter(id => id.length > 0);

    if (searchIds.length === 0) return;

    const matchedOrders = orders.filter(order => {
      const orderIdStr = String(order.id).toLowerCase();
      const orderNumberStr = String(order.orderNumber || '').toLowerCase();
      const orderIdShortStr = String(order.id.slice(-6)).toLowerCase();
      return searchIds.some(searchId => 
        orderIdStr.includes(searchId) || 
        orderIdShortStr === searchId ||
        (orderNumberStr && orderNumberStr.includes(searchId))
      );
    });

    const matchedIds = matchedOrders.map(o => o.id);
    
    if (matchedIds.length > 0) {
      setSelectedOrderIds(prev => {
        const newSet = new Set([...prev, ...matchedIds]);
        return Array.from(newSet);
      });
      setNotificationModal({ show: true, message: `✅ تم العثور على وتحديد ${matchedIds.length} طلب بنجاح.` });
    } else {
      setNotificationModal({ show: true, message: `❌ لم يتم العثور على أي طلب يطابق الأرقام المدخلة.` });
    }
    
    setShowBulkSelectModal(false);
    setBulkSelectText('');
  };

  const handleBulkSelectInverse = () => {
    if (!bulkSelectText.trim()) return;
    
    const searchIds = bulkSelectText
      .split(/[\n,\s]+/)
      .map(id => id.trim().toLowerCase())
      .filter(id => id.length > 0);

    if (searchIds.length === 0) return;

    // Use filteredOrders here (which evaluates after render) to prevent selecting thousands of unrelated background orders
    const matchedIdsSet = new Set(
      orders.filter(order => {
        const orderIdStr = String(order.id).toLowerCase();
        const orderNumberStr = String(order.orderNumber || '').toLowerCase();
        const orderIdShortStr = String(order.id.slice(-6)).toLowerCase();
        const shipmentIdStr = String(order.shipmentId || '').toLowerCase();
        const jenniShipmentIdStr = String(order.jenniShipmentId || '').toLowerCase();
        const shipmentNumberStr = String(order.shipmentNumber || '').toLowerCase();
        const phoneStr = String(order.customerPhone || order.phone || '').toLowerCase();

        return searchIds.some(searchId => 
          orderIdStr.includes(searchId) || 
          orderIdShortStr === searchId ||
          (orderNumberStr && orderNumberStr.includes(searchId)) ||
          (shipmentIdStr && shipmentIdStr.includes(searchId)) ||
          (jenniShipmentIdStr && jenniShipmentIdStr.includes(searchId)) ||
          (shipmentNumberStr && shipmentNumberStr.includes(searchId)) ||
          (phoneStr && phoneStr.includes(searchId))
        );
      }).map(o => o.id)
    );

    // Get unmatched orders from the currently filtered list
    const unmatchedIds = filteredOrders
      .filter(order => !matchedIdsSet.has(order.id))
      .map(o => o.id);
    
    if (unmatchedIds.length > 0) {
      setSelectedOrderIds(unmatchedIds);
      setNotificationModal({ show: true, message: `✅ تم العثور على وتحديد ${unmatchedIds.length} طلب غير مطابق للقائمة (من الطلبات المعروضة).` });
    } else {
      setNotificationModal({ show: true, message: `❌ جميع الطلبات المعروضة مطابقة للقائمة.` });
    }
    
    setShowBulkSelectModal(false);
    setBulkSelectText('');
  };

  const handleBulkSelectAndShow = () => {
    if (!bulkSelectText.trim()) return;
    
    const searchIds = bulkSelectText
      .split(/[\n,\s]+/)
      .map(id => id.trim().toLowerCase())
      .filter(id => id.length > 0);

    if (searchIds.length === 0) return;

    const matchedOrders = orders.filter(order => {
      const orderIdStr = String(order.id).toLowerCase();
      const orderNumberStr = String(order.orderNumber || '').toLowerCase();
      const orderIdShortStr = String(order.id.slice(-6)).toLowerCase();
      const shipmentIdStr = String(order.shipmentId || '').toLowerCase();
      const jenniShipmentIdStr = String(order.jenniShipmentId || '').toLowerCase();
      const shipmentNumberStr = String(order.shipmentNumber || '').toLowerCase();
      const phoneStr = String(order.customerPhone || order.phone || '').toLowerCase();

      return searchIds.some(searchId => 
        orderIdStr.includes(searchId) || 
        orderIdShortStr === searchId ||
        (orderNumberStr && orderNumberStr.includes(searchId)) ||
        (shipmentIdStr && shipmentIdStr.includes(searchId)) ||
        (jenniShipmentIdStr && jenniShipmentIdStr.includes(searchId)) ||
        (shipmentNumberStr && shipmentNumberStr.includes(searchId)) ||
        (phoneStr && phoneStr.includes(searchId))
      );
    });

    const matchedIds = matchedOrders.map(o => o.id);
    
    if (matchedIds.length > 0) {
      setSelectedOrderIds(matchedIds);
      setShowOnlySelected(true);
      setNotificationModal({ show: true, message: `✅ تم تحديد وتصفية الشاشة لعرض ${matchedIds.length} طلب فقط.` });
    } else {
      setNotificationModal({ show: true, message: `❌ لم يتم العثور على أي طلب يطابق الأرقام المدخلة.` });
    }
    
    setShowBulkSelectModal(false);
    setBulkSelectText('');
  };

  // Group Return Batches by Month
  const groupedReturnBatches = React.useMemo(() => {
    return returnsArchive.reduce((acc, record) => {
      let dateObj = new Date();
      if (record.timestamp) {
         dateObj = record.timestamp instanceof Timestamp ? record.timestamp.toDate() : new Date(record.timestamp);
      }
      const monthKey = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(record);
      return acc;
    }, {} as Record<string, any[]>);
  }, [returnsArchive]);

  // Group Return Batches of selected month by Day
  const groupedReturnDays = React.useMemo(() => {
    if (!selectedReturnMonth) return {};
    const batches = groupedReturnBatches[selectedReturnMonth] || [];
    return batches.reduce((acc: Record<string, any[]>, record: any) => {
      let dateObj = new Date();
      if (record.timestamp) {
         dateObj = record.timestamp instanceof Timestamp ? record.timestamp.toDate() : new Date(record.timestamp);
      }
      const dayKey = dateObj.toLocaleDateString('en-GB'); // "dd/mm/yyyy"
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(record);
      return acc;
    }, {} as Record<string, any[]>);
  }, [selectedReturnMonth, groupedReturnBatches]);

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
  }).sort((a, b) => {
    const phA = (a.customerPhone || a.phone || '').trim();
    const phB = (b.customerPhone || b.phone || '').trim();
    return phA.localeCompare(phB);
  });

  const returnedOrdersList = activeOrders.filter(o => o.status === 'returned');

  const baseList = activeTab === 'archived' ? archivedOrdersList 
                 : activeTab === 'duplicates' ? duplicateOrdersList 
                 : activeTab === 'returned' ? returnedOrdersList
                 : activeOrders;

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const listToCount = showOnlySelected 
      ? orders.filter(o => selectedOrderIds.includes(o.id))
      : baseList;

    listToCount.forEach(order => {
      const status = order.status || 'pending';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [baseList, showOnlySelected, selectedOrderIds, orders]);

  const baseListAfterStatus = React.useMemo(() => {
    let list = baseList;
    if (selectedStatus === 'all') return list;
    return list.filter(o => (o.status || 'pending') === selectedStatus);
  }, [baseList, selectedStatus]);

  const filteredOrders = (showOnlySelected 
    ? orders.filter(o => selectedOrderIds.includes(o.id)).filter(o => selectedStatus === 'all' || (o.status || 'pending') === selectedStatus)
    : baseListAfterStatus).filter(order => {
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
    const shipComp = (order.shippingCompany || '').toLowerCase();

    // Column Filters
    const matchesColumn = (
      (displayId.includes(columnFilters.id.toLowerCase()) || idStr.includes(columnFilters.id.toLowerCase())) &&
      custName.includes(columnFilters.customerName.toLowerCase()) &&
      gov.includes(columnFilters.governorate.toLowerCase()) &&
      phone.includes(columnFilters.phone.toLowerCase()) &&
      (total.includes(columnFilters.totalAmount.toLowerCase()) || rawTotal.includes(columnFilters.totalAmount.toLowerCase())) &&
      notes.includes(columnFilters.notes.toLowerCase()) &&
      (columnFilters.status === '' || columnFilters.status.split(',').includes(statusKey)) &&
      aDate.includes(columnFilters.addDate.toLowerCase()) &&
      aTime.includes(columnFilters.addTime.toLowerCase()) &&
      empName.includes(columnFilters.employeeName.toLowerCase()) &&
      shipComp.includes((columnFilters.shippingCompany || '').toLowerCase())
    );

    // Global Filter
    const searchLower = globalSearch.toLowerCase().trim();
    const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Gather all item names if any, to search within cart products as well
    const productNames = (order.items || []).map((item: any) => normalizeStr(item.productName));
    
    const allFields = [
      idStr, displayId, custName, gov, region, phone, total, rawTotal, 
      statusKey, statusLabel, aDate, aTime, empName, notes, shipComp, ...productNames
    ].map(normalizeStr);

    let matchesGlobal = true;
    if (searchLower) {
      if (searchLower.includes(',')) {
        const terms = searchLower.split(',').map(t => t.trim()).filter(Boolean);
        matchesGlobal = terms.length === 0 || terms.some(term => 
          allFields.some(field => field.includes(term))
        );
      } else {
        const normalizedSearch = searchLower.replace(/\s+/g, ' ');
        matchesGlobal = allFields.some(field => field.includes(normalizedSearch));
      }
    }

    return matchesColumn && matchesGlobal;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  
  const paginatedOrders = filteredOrders.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  );

  const isAllSelected = paginatedOrders.length > 0 && paginatedOrders.every(order => selectedOrderIds.includes(order.id));

  const toggleAllSelection = () => {
    const paginatedIds = paginatedOrders.map(order => order.id);
    if (isAllSelected) {
      setSelectedOrderIds(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

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
          const shipmentId = response?.accepted_shipments?.[0]?.shipment_id || response?.shipment_id || response?.data?.shipment_id || response?.id || '';

          const batch = writeBatch(db);
          const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderData.id);
          
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
          if (err.message && err.message.includes('Too many requests')) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } finally {
          // تأخير إجباري بعد كل طلب لتجنب الحظر
          await new Promise(resolve => setTimeout(resolve, 1500));
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
        const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', id);
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
        const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', id);
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
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
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
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
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
    
    const isDeleteLocked = !orderToDelete.isArchived && (['shipped', 'delivered', 'returned', 'cancelled'].includes(orderToDelete.status) || orderToDelete.is_settled === true);
    if (isDeleteLocked) {
       alert("لا يمكن حذف طلب نشط تم تسليمه أو إرجاعه أو تسويته. يرجى أرشفة الطلب أولاً لحذفه نهائياً.");
       setOrderToDelete(null);
       return;
    }
    
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderToDelete.id);
      
      // If order is not cancelled or returned, we should return items to stock
      const isCancelled = orderToDelete.status === 'cancelled' || orderToDelete.status === 'returned';
      
      if (!isCancelled && orderToDelete.items && orderToDelete.items.length > 0) {
        for (const item of orderToDelete.items) {
          if (item.isComposite && item.composition) {
            for (const comp of item.composition) {
              const rawProdRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', comp.itemId);
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
            const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', item.productId);
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
         const isDeleteLocked = !o.isArchived && (['shipped', 'delivered', 'returned', 'cancelled'].includes(o.status) || o.is_settled === true);
         return !isDeleteLocked;
      });
      
      if (validOrdersToDelete.length === 0) {
         alert("لا توجد طلبات قابلة للحذف (مقفل بالكامل).");
         setIsUpdating(false);
         setShowBulkDeleteModal(false);
         return;
      }
      
      // Process each order for stock reversal
      for (const orderItem of validOrdersToDelete) {
        const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderItem.id);
        const isCancelled = orderItem.status === 'cancelled' || orderItem.status === 'returned';
        
        if (!isCancelled && orderItem.items && orderItem.items.length > 0) {
          for (const item of orderItem.items) {
            if (item.isComposite && item.composition) {
              for (const comp of item.composition) {
                const rawProdRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', comp.itemId);
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
              const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', item.productId);
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
  const [deliveryCompany, setDeliveryCompany] = useState('');
  const [customDeliveryCompany, setCustomDeliveryCompany] = useState('');

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
          const rawProdRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', comp.itemId);
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
        if (!item.productId) continue;
        const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', item.productId);
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

  const aggregateProductQuantities = (items: any[]) => {
    const productMap: Record<string, number> = {};
    for (const item of items) {
      if (item.isComposite && item.composition) {
        for (const comp of item.composition) {
          const id = comp.itemId;
          const qty = (Number(comp.quantityNeeded) || 0) * (Number(item.quantity) || 0);
          if (id) {
            productMap[id] = (productMap[id] || 0) + qty;
          }
        }
      } else {
        const id = item.productId;
        const qty = Number(item.quantity) || 0;
        if (id) {
          productMap[id] = (productMap[id] || 0) + qty;
        }
      }
    }
    return productMap;
  };

  const syncStockForOrderEdit = async (
    oldItems: any[],
    newItems: any[],
    oldStatus: string,
    newStatus: string,
    batch: any
  ) => {
    const oldState = getStockState(oldStatus);
    const newState = getStockState(newStatus);

    // 1. Aggregate quantities for each base product
    const aggregatedOld = aggregateProductQuantities(oldItems);
    const aggregatedNew = aggregateProductQuantities(newItems);

    // 2. Find all unique product IDs involved
    const allProductIds = Array.from(
      new Set([...Object.keys(aggregatedOld), ...Object.keys(aggregatedNew)])
    );

    if (allProductIds.length === 0) return;

    // 3. Fetch all product documents in parallel and build cache
    const productCache: Record<string, { ref: any; data: any; stock: any }> = {};
    const fetchPromises = allProductIds.map(async (productId) => {
      const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const prodData = prodSnap.data();
        productCache[productId] = {
          ref: prodRef,
          data: prodData,
          stock: JSON.parse(JSON.stringify(prodData.stock || {})) // deep copy
        };
      }
    });
    await Promise.all(fetchPromises);

    // 4. Process each product
    for (const productId of allProductIds) {
      const cached = productCache[productId];
      if (!cached) continue;

      const oldQty = aggregatedOld[productId] || 0;
      const newQty = aggregatedNew[productId] || 0;

      const defaultUnit = cached.data.units?.[0]?.type || 'قطعة';
      const stock = cached.stock;

      const changeReserved = (stockObj: any, amount: number) => {
        const firstStoreKey = Object.keys(stockObj)[0] || 'default_store';
        if (!stockObj[firstStoreKey]) {
          stockObj[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
        }
        stockObj[firstStoreKey].reserved = (stockObj[firstStoreKey].reserved || 0) + amount;
      };

      // 4a. Apply difference under old state
      if (oldState === 'SOFT_ALLOCATED') {
        changeReserved(stock, newQty - oldQty);
      }

      // 4b. Transition status on new quantity
      if (oldState !== newState) {
        applyStockTransition(stock, oldState, newState, newQty, defaultUnit);
      }

      // 4c. Recalculate totalBaseQuantity
      let newTotalBaseQuantity = 0;
      Object.values(stock).forEach((s: any) => {
        const uMul = cached.data.units?.find((u: any) => u.type === s.unit)?.count || 1;
        newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
      });

      // 4d. Queue database update
      batch.update(cached.ref, { stock, totalBaseQuantity: newTotalBaseQuantity });
    }
  };

  const handleInlineStatusChange = async (orderId: string, oldStatus: string, newStatus: string) => {
    if (oldStatus === newStatus) return;

    // Open the status modal so they can select shipping company or see warnings
    setBulkStatusValue(newStatus);
    setSelectedOrderIds([orderId]);
    setShowBulkStatusModal(true);
  };

  const handleCancelOrder = async (order: any) => {
    if (['cancelled', 'returned', 'delivered'].includes(order.status)) {
      alert("لا يمكن إلغاء طلب ملغي، راجع، أو مكتمل بالفعل.");
      return;
    }

    const hasJenniShipment = !!(order.jenniShipmentId || order.shipmentId || order.shipmentNumber || (order.status === 'shipped' && order.shipmentCompany === 'Jenni Logistics'));

    let cancelOnJenniSuccess = false;
    if (hasJenniShipment) {
      const confirmCancel = window.confirm(
        `الطلب يحتوي على شحنة لدى شركة التوصيل (Jenni Logistics).\nهل تريد إلغاء الشحنة من نظام شركة التوصيل وإلغاء الطلب في نظامك؟`
      );
      if (!confirmCancel) return;

      setIsUpdating(true);
      try {
        const res = await fetch('/api/orders/cancel-jenni', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            shipmentId: order.jenniShipmentId || order.shipmentId || order.shipmentNumber,
            skipDbUpdate: true
          })
        });
        const data = await res.json();
        if (data.success) {
          cancelOnJenniSuccess = true;
        } else {
          const forceLocal = window.confirm(
            `❌ فشل إلغاء الشحنة من شركة التوصيل: ${data.message || 'خطأ غير معروف'}.\n\nهل تريد إلغاء الطلب محلياً في نظامك فقط (دون إلغائه من شركة التوصيل)؟`
          );
          if (!forceLocal) {
            setIsUpdating(false);
            return;
          }
        }
      } catch (err) {
        console.error(err);
        const forceLocal = window.confirm(
          `❌ حدث خطأ أثناء الاتصال بشركة التوصيل.\n\nهل تريد إلغاء الطلب محلياً في نظامك فقط؟`
        );
        if (!forceLocal) {
          setIsUpdating(false);
          return;
        }
      }
    } else {
      const confirmCancel = window.confirm(`هل أنت متأكد أنك تريد إلغاء هذا الطلب وتعديل المخزون؟`);
      if (!confirmCancel) return;
      setIsUpdating(true);
    }

    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id);
      
      batch.update(orderRef, {
        status: 'cancelled',
        deliveryStatus: hasJenniShipment ? 'CANCELLED_API' : 'CANCELLED_LOCAL',
        updatedAt: serverTimestamp()
      });

      await syncStockForStatusChange(order.items || [], order.status || 'pending', 'cancelled', batch);

      await batch.commit();
      setNotificationModal({ show: true, message: '✅ تم إلغاء الطلب وإرجاع المنتجات للمخزن بنجاح' });
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      alert(`حدث خطأ أثناء إلغاء الطلب: ${error.message || error}`);
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
      
      const newStatus = bulkStatusValue;
      const newState = getStockState(newStatus);
      
      const productCache: Record<string, { ref: any; data: any; stock: any; isDirty: boolean }> = {};
      const productIdsToFetch = new Set<string>();

      // 1. Identify which orders are valid and which products we need
      const validOrders = [];
      for (const orderId of selectedOrderIds) {
        const orderToUpdate = orders.find(o => o.id === orderId);
        if (!orderToUpdate) continue;
        
        const isFullyLocked = false; 
        if (isFullyLocked) continue; // Unlocked shipped and delivered statuses
        
        const oldStatus = orderToUpdate.status || 'pending';
        if (oldStatus !== newStatus) {
          validOrders.push({ order: orderToUpdate, oldStatus, newStatus });
          for (const item of (orderToUpdate.items || [])) {
            if (item.isComposite && item.composition) {
              for (const comp of item.composition) {
                if (comp.itemId) productIdsToFetch.add(comp.itemId);
              }
            } else if (item.productId) {
              productIdsToFetch.add(item.productId);
            }
          }
        }
      }

      if (validOrders.length === 0) {
        setNotificationModal({ show: true, message: 'لم يتم تحديث أي طلب (جميع الطلبات المحددة مقفلة أو بنفس الحالة).' });
        setShowBulkStatusModal(false);
        setIsUpdating(false);
        return;
      }

      // 2. Fetch all products in parallel
      const fetchPromises = Array.from(productIdsToFetch).map(async (productId) => {
        const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data();
          productCache[productId] = {
            ref: prodRef,
            data: prodData,
            stock: JSON.parse(JSON.stringify(prodData.stock || {})),
            isDirty: false
          };
        }
      });
      await Promise.all(fetchPromises);

      // 3. Process each order and apply stock transitions in memory
      for (const { order, oldStatus, newStatus } of validOrders) {
        const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id);
        
        const finalDeliveryCompany = deliveryCompany === 'أخرى' ? customDeliveryCompany : deliveryCompany;
        const updateData: any = { status: newStatus };
        
        if (newStatus === 'delivered' && finalDeliveryCompany.trim() !== '') {
          updateData.shippingCompany = finalDeliveryCompany.trim();
          
          // Apply delivery cost deduction based on governorate
          const company = shippingCompanies.find(c => c.name === finalDeliveryCompany.trim());
          if (company && company.rates && order.governorate) {
            const cost = company.rates[order.governorate];
            if (cost > 0 && !order.deliveryCost) {
              updateData.deliveryCost = cost;
              const currentTotal = order.totalAmount || order.price || 0;
              updateData.totalAmount = currentTotal - cost;
            }
          }
        }
        
        batch.update(orderRef, updateData);
        updatedCount++;

        const oldState = getStockState(oldStatus);
        if (oldState === newState) continue;

        for (const item of (order.items || [])) {
          if (item.isComposite && item.composition) {
            for (const comp of item.composition) {
              const cached = productCache[comp.itemId];
              if (cached) {
                let qty = comp.quantityNeeded * item.quantity;
                applyStockTransition(cached.stock, oldState, newState, qty, cached.data.units?.[0]?.type || 'قطعة');
                cached.isDirty = true;
              }
            }
          } else if (item.productId) {
            const cached = productCache[item.productId];
            if (cached) {
              let qty = item.quantity;
              applyStockTransition(cached.stock, oldState, newState, qty, cached.data.units?.[0]?.type || 'قطعة');
              cached.isDirty = true;
            }
          }
        }
      }

      // 4. Update dirty products in batch
      for (const productId in productCache) {
        const cached = productCache[productId];
        if (cached.isDirty) {
          let newTotalBaseQuantity = 0;
          Object.values(cached.stock).forEach((s: any) => {
            const uMul = cached.data.units?.find((u: any) => u.type === s.unit)?.count || 1;
            newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
          });
          batch.update(cached.ref, { stock: cached.stock, totalBaseQuantity: newTotalBaseQuantity });
        }
      }

      await batch.commit();
      
      setNotificationModal({ show: true, message: `تم تحديث حالة ${updatedCount} طلبات بنجاح.` });
      setShowBulkStatusModal(false);
      setSelectedOrderIds([]);
      setDeliveryCompany('');
      setCustomDeliveryCompany('');
    } catch (error) {
      console.error("Error updating bulk order status:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء التحديث الجماعي' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Product Search for Edit Modal
  const filteredProductsEdit = React.useMemo(() => {
    return products.filter(p => {
      if (!searchQueryEdit) return false;
      const query = searchQueryEdit.toLowerCase();
      
      const pNameClean = p.name?.trim().toLowerCase();
      if (!pNameClean) return false;

      // Filter out Category, Subcategory or Page names so only real items (products) show up
      const isPageName = pagesDb.some(page => page.name?.trim().toLowerCase() === pNameClean);
      if (isPageName) return false;

      const isMainCatName = categoriesDb.some(cat => cat.name?.trim().toLowerCase() === pNameClean);
      if (isMainCatName) return false;

      const isSubCatName = categoriesDb.some(cat => 
        cat.subcategories?.some((sub: any) => sub.name?.trim().toLowerCase() === pNameClean)
      );
      if (isSubCatName) return false;

      const nameMatch = p.name?.toLowerCase().includes(query);
      const barcodeMatch = p.barcode?.toLowerCase() === query;
      return nameMatch || barcodeMatch;
    });
  }, [products, searchQueryEdit, pagesDb, categoriesDb]);

  const addProductToEditingOrder = (product: any) => {
    if (!editingOrder) return;
    const currentItems = editingOrder.items || [];
    const existing = currentItems.find((item: any) => item.productId === product.id);
    let newItems;
    if (existing) {
      newItems = currentItems.map((item: any) => 
        item.productId === product.id ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice } : item
      );
    } else {
      const price = (product.units && product.units.length > 0) ? product.units[0].selling : 0;
      newItems = [...currentItems, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: price,
        total: price,
        isComposite: product.isComposite || false,
        composition: product.composition || null
      }];
    }
    
    const newTotal = newItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    setEditingOrder({
      ...editingOrder,
      items: newItems,
      totalAmount: newTotal
    });
    setSearchQueryEdit('');
    setShowProductDropdownEdit(false);
  };

  const updateEditingOrderItemQuantity = (productId: string, newQty: number) => {
    if (!editingOrder || newQty < 1) return;
    const currentItems = editingOrder.items || [];
    const newItems = currentItems.map((item: any) => 
      item.productId === productId ? { ...item, quantity: newQty, total: newQty * item.unitPrice } : item
    );
    const newTotal = newItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    setEditingOrder({
      ...editingOrder,
      items: newItems,
      totalAmount: newTotal
    });
  };

  const updateEditingOrderItemPrice = (productId: string, newPrice: number) => {
    if (!editingOrder || newPrice < 0) return;
    const currentItems = editingOrder.items || [];
    const newItems = currentItems.map((item: any) => 
      item.productId === productId ? { ...item, unitPrice: newPrice, total: item.quantity * newPrice } : item
    );
    const newTotal = newItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    setEditingOrder({
      ...editingOrder,
      items: newItems,
      totalAmount: newTotal
    });
  };

  const removeProductFromEditingOrder = (productId: string) => {
    if (!editingOrder) return;
    const currentItems = editingOrder.items || [];
    const newItems = currentItems.filter((item: any) => item.productId !== productId);
    const newTotal = newItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    setEditingOrder({
      ...editingOrder,
      items: newItems,
      totalAmount: newTotal
    });
  };

  const saveOrderUpdates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    
    setIsUpdating(true);
    try {
      const oldOrder = orders.find(o => o.id === editingOrder.id);
      if (!oldOrder) return;
      
      const isFullyLocked = false; // TEMPORARILY UNLOCKED ['shipped', 'delivered', 'returned', 'cancelled'].includes(oldOrder.status) || oldOrder.isArchived || oldOrder.is_settled === true;
      if (isFullyLocked) {
        alert("🔒 إجراء مرفوض: الطلب مقفل بالكامل (مشحون، واصل، راجع، ملغى، أو متمت تسويته).");
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
      
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', editingOrder.id);
      const batch = writeBatch(db);

      batch.update(orderRef, {
        customerName: editingOrder.customerName || '',
        customerPhone: editingOrder.customerPhone || editingOrder.phone || '',
        governorate: editingOrder.governorate || '',
        region: editingOrder.region || '',
        notes: editingOrder.notes || '',
        status: editingOrder.status || 'pending',
        employeeName: editingOrder.employeeName || '',
        items: editingOrder.items || [],
        totalAmount: Number(editingOrder.totalAmount) || 0
      });

      // Handle Stock Logic for order edits (both items and status changes)
      await syncStockForOrderEdit(
        oldOrder.items || [],
        editingOrder.items || [],
        oldOrder.status,
        editingOrder.status,
        batch
      );

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



  const handleConfirmReturnReceipt = async () => {
    if (!receiverEmployee || !deliveryAgent || selectedOrderIds.length === 0) return;
    setIsUpdating(true);
    try {
      // 0. Generate Sequential Batch ID
      const counterRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'metadata', 'returnBatchCounter');
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
      const batchDocRef = doc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'return_batches'));
      
      const orderDetailsForBatch: any[] = [];

      for (const orderId of selectedOrderIds) {
        const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
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

  // Helper calculations for dynamic bulk action eligibility
  const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
  
  const canTransfer = selectedOrders.length > 0 && selectedOrders.every(o => 
    !['shipped', 'delivered', 'returned', 'cancelled'].includes(o.status) && 
    !o.isArchived && 
    o.paymentStatus !== 'settled' && 
    o.is_settled !== true
  );
  
  const canArchive = selectedOrders.length > 0 && selectedOrders.every(o => !o.isArchived);
  
  const canDelete = selectedOrders.length > 0 && selectedOrders.every(o => 
    !['shipped', 'delivered', 'returned', 'cancelled'].includes(o.status) && 
    !o.isArchived && 
    o.paymentStatus !== 'settled' && 
    o.is_settled !== true
  );

  const canConfirmReturn = selectedOrders.length > 0 && selectedOrders.every(o => o.status === 'returned');
  
  const canRestore = selectedOrders.length > 0 && selectedOrders.every(o => o.isArchived);
  const canDeletePermanent = selectedOrders.length > 0 && selectedOrders.every(o => o.isArchived);

  const hasAnyBulkAction = activeTab !== 'archived' 
    ? (canTransfer || canArchive || canDelete || (activeTab === 'returned' && canConfirmReturn))
    : (canRestore || canDeletePermanent);

  const handleExportExcel = () => {
    try {
      const ordersToExport = selectedOrders.length > 0 ? selectedOrders : filteredOrders;
      if (ordersToExport.length === 0) {
        setNotificationModal({ show: true, message: 'لا توجد طلبات للتصدير' });
        return;
      }
      const exportData = ordersToExport.map(order => {
        const itemsList = (order.items || []).map((item: any) => `${item.productName} (الكمية: ${item.quantity})`).join(' | ');
        const statusLabel = statusMap[order.status || 'pending']?.label || order.status;
        
        return {
          'رقم الطلب': order.id.slice(-6).toUpperCase(),
          'تاريخ الإضافة': order.addDate,
          'وقت الإضافة': order.addTime,
          'اسم العميل': order.customerName,
          'المحافظة': order.governorate,
          'المنطقة': order.region,
          'رقم الهاتف': order.customerPhone || order.phone,
          'المبلغ الكلي': order.formattedTotal,
          'المنتجات': itemsList,
          'الحالة': statusLabel,
          'اسم الموظف': order.employeeName,
          'ملاحظات': order.notes
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!dir'] = 'rtl';
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'الطلبات');
      XLSX.writeFile(workbook, 'Orders_Export.xlsx');
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء التصدير' });
    }
  };

  const handleExportZitaExcel = () => {
    try {
      const ordersToExport = selectedOrders.length > 0 ? selectedOrders : filteredOrders;
      if (ordersToExport.length === 0) {
        setNotificationModal({ show: true, message: 'لا توجد طلبات للتصدير' });
        return;
      }
      const exportData = ordersToExport.map(order => {
        const itemsList = (order.items || []).map((item: any) => `${item.productName}(${item.quantity || 1})`).join(' + ');
        const totalQuantity = (order.items || []).reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
        
        let formattedNotes = itemsList;
        if (order.notes) {
          formattedNotes += `\n\n*${order.notes}`;
        }

        let phone1 = order.customerPhone || order.phone || '';
        let phone2 = '';
        if (phone1.includes('-')) {
          const parts = phone1.split('-');
          phone1 = parts[0].trim();
          phone2 = parts[1].trim();
        } else if (phone1.includes('/')) {
          const parts = phone1.split('/');
          phone1 = parts[0].trim();
          phone2 = parts[1].trim();
        } else if (phone1.includes(',')) {
          const parts = phone1.split(',');
          phone1 = parts[0].trim();
          phone2 = parts[1].trim();
        }

        let zitaGov = (order.governorate || '').trim();
        if (zitaGov.includes('ميسان') || zitaGov.includes('العمارة')) zitaGov = 'العمارة';
        else if (zitaGov.includes('بابل') || zitaGov.includes('الحلة')) zitaGov = 'بابل';
        else if (zitaGov.includes('ذي قار') || zitaGov.includes('الناصرية')) zitaGov = 'الناصرية';
        else if (zitaGov.includes('واسط') || zitaGov.includes('الكوت')) zitaGov = 'واسط';
        else if (zitaGov.includes('المثنى') || zitaGov.includes('السماوة')) zitaGov = 'السماوة';
        else if (zitaGov.includes('القادسية') || zitaGov.includes('الديوانية')) zitaGov = 'الديوانية';
        else if (zitaGov.includes('نينوى') || zitaGov.includes('الموصل') || zitaGov.includes('موصل')) zitaGov = 'موصل';
        else if (zitaGov.includes('الأنبار') || zitaGov.includes('الرمادي') || zitaGov.includes('الانبار')) zitaGov = 'الانبار';
        else if (zitaGov.includes('ديالى') || zitaGov.includes('بعقوبة')) zitaGov = 'ديالى';
        else if (zitaGov.includes('صلاح الدين') || zitaGov.includes('تكريت')) zitaGov = 'صلاح الدين';
        else if (zitaGov.includes('أربيل') || zitaGov.includes('اربيل')) zitaGov = 'اربيل';
        // Fallback: if it still has parentheses, just take the first part
        if (zitaGov.includes('(')) {
          zitaGov = zitaGov.split('(')[0].trim();
        }

        return {
          'رقم الوصل': order.id.slice(-6).toUpperCase(),
          'اسم الزبون': order.customerName || '',
          'هاتف الزبون': phone1,
          'هاتف الزبون2': phone2,
          'المحافظة': zitaGov,
          'المنطقة': order.region || '',
          'المبلغ الكلي': order.totalAmount || order.price || 0,
          'نوع البضاعة': '',
          'العدد': totalQuantity,
          'الملاحظات': formattedNotes
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!dir'] = 'rtl';
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'زيطة');
      XLSX.writeFile(workbook, 'Zita_Orders_Export.xlsx');
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setNotificationModal({ show: true, message: 'حدث خطأ أثناء التصدير' });
    }
  };

  const handlePrintLabels = () => {
    const ordersToPrint = selectedOrders.length > 0 ? selectedOrders : filteredOrders;
    
    if (ordersToPrint.length === 0) {
      setNotificationModal({ show: true, message: 'لا يوجد طلبات للطباعة' });
      return;
    }

    const printContent = `
      <html dir="rtl">
      <head>
        <title>طباعة وصولات</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&display=swap');
          @page { size: 100mm 150mm portrait; margin: 0; }
          body { 
            font-family: 'Cairo', sans-serif; 
            margin: 0; 
            padding: 0; 
            background: #fff;
            color: #000;
          }
          .receipt { 
            width: 100mm; 
            height: 150mm;
            page-break-after: always; 
            padding: 8mm 5mm; 
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .header { text-align: center; margin-bottom: 5mm; }
          .header h3 { margin: 0; font-size: 14pt; font-weight: 800; color: #1a1a1a; display: flex; align-items: center; justify-content: center; gap: 5px;}
          .header-title { font-size: 20pt; font-weight: 800; margin-top: 5px; letter-spacing: 1px;}
          
          .content { display: flex; flex-grow: 1; align-items: flex-start; justify-content: space-between;}
          
          .right-side { width: 68%; font-size: 11pt; font-weight: 700; }
          .right-side table { width: 100%; border-collapse: collapse; }
          .right-side td { padding: 4px 0; vertical-align: top; border: none; }
          .right-side td:nth-child(1) { width: 30%; text-align: right; font-weight: 800; }
          .right-side td:nth-child(2) { width: 5%; text-align: center; font-weight: 800;}
          .right-side td:nth-child(3) { width: 65%; text-align: right; }
          
          .left-side { width: 30%; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 10px; }
          .big-gov { font-size: 18pt; font-weight: 800; margin: 0; line-height: 1.2; }
          .region { font-size: 11pt; font-weight: 800; margin: 5px 0 2px 0; }
          .price { font-size: 12pt; font-weight: 800; margin: 0 0 15px 0; direction: ltr; }
          .qr-code { width: 90px; height: 90px; margin-bottom: 5px; }
          .order-id { font-size: 10pt; font-weight: 800; margin-top: 5px; }
          
          .footer { text-align: center; margin-top: auto; font-size: 10pt; font-weight: 800; }
          .footer p { margin: 3px 0; }
          .footer-en { font-size: 9pt; font-weight: 600; font-family: sans-serif; }
          
          .receipt:last-child { page-break-after: auto; }
        </style>
      </head>
      <body>
        ${ordersToPrint.map((order, index) => {
          const totalQuantity = (order.items || []).reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
          const productNames = (order.items || []).map((item: any) => item.productName).join(' + ');
          let dateObj = new Date();
          if (order.date) {
            dateObj = order.date.toDate ? order.date.toDate() : (order.date.seconds ? new Date(order.date.seconds * 1000) : new Date(order.date));
          }
          const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getFullYear()}`;
          const orderId = order.orderNumber || order.id.slice(-10).toUpperCase();

          return `
            <div class="receipt">
              <div class="header">
                <h3>سستم تاجر برو 🛍️</h3>
                <div class="header-title">وصل الكتروني</div>
              </div>
              
              <div class="content">
                <div class="right-side">
                  <table>
                    <tr><td>المرسل</td><td>:</td><td>مارشميلو</td></tr>
                    <tr><td>رقم الطلب</td><td>:</td><td>${orderId}</td></tr>
                    <tr><td>الاسم</td><td>:</td><td>${order.customerName || ''}</td></tr>
                    <tr><td>المحافظة</td><td>:</td><td>${order.governorate || ''}</td></tr>
                    <tr><td>العنوان</td><td>:</td><td>${order.region || ''}</td></tr>
                    <tr><td>الهاتف</td><td>:</td><td dir="ltr" style="text-align: right;">${order.customerPhone || order.phone || ''}</td></tr>
                    <tr><td>العدد</td><td>:</td><td>${totalQuantity}</td></tr>
                    <tr><td>المبلغ الكلي</td><td>:</td><td dir="ltr" style="text-align: right;">${new Intl.NumberFormat('en-US').format(order.totalAmount || order.price || 0)} د.ع</td></tr>
                    <tr><td>تاريخ الطلب</td><td>:</td><td>${formattedDate}</td></tr>
                    <tr><td>الملاحظات</td><td>:</td><td>${order.notes || productNames}</td></tr>
                  </table>
                </div>
                
                <div class="left-side">
                  <p class="big-gov">${order.governorate || ''}</p>
                  <p class="region">${order.region || ''}</p>
                  <p class="price">${new Intl.NumberFormat('en-US').format(order.totalAmount || order.price || 0)} د.ع</p>
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${orderId}" class="qr-code" />
                  <p class="order-id">${orderId}</p>
                </div>
              </div>
              
              <div class="footer">
                <p>يرجى عدم اعطاء أي مبلغ للمندوب عدى المبلغ المذكور في الوصل</p>
                <p>page ${index + 1}</p>
                <p class="footer-en">This system is developed by Tajer Pro, www.tajerpro.com</p>
              </div>
            </div>
          `;
        }).join('')}
        <script>
          setTimeout(() => {
            window.print();
            window.close();
          }, 1000);
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(printContent);
      printWin.document.close();
      printWin.focus();
    }
  };

  const handlePrintManifest = () => {
    const ordersToPrint = selectedOrders.length > 0 ? selectedOrders : filteredOrders;
    
    if (ordersToPrint.length === 0) {
      setNotificationModal({ show: true, message: 'لا يوجد طلبات لطباعتها في الكشف' });
      return;
    }

    const todayDate = new Date().toLocaleDateString('en-GB');
    const randomListId = Math.floor(10000 + Math.random() * 90000);

    const printContent = `
      <html dir="rtl">
      <head>
        <title>كشف الطلبات (A4)</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&display=swap');
          @page { size: A4 portrait; margin: 10mm; }
          body { 
            font-family: 'Cairo', sans-serif; 
            margin: 0; 
            padding: 0; 
            background: #fff;
            color: #000;
            font-size: 10pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-grid {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            margin-bottom: 20px;
          }
          .header-info-box {
            border: 2px solid #000;
            display: flex;
            flex-direction: column;
            width: 220px;
            text-align: center;
            font-weight: bold;
          }
          .header-info-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-bottom: 2px solid #000;
          }
          .header-info-row:last-child {
            border-bottom: none;
          }
          .header-info-cell {
            padding: 8px 5px;
            border-left: 2px solid #000;
            font-size: 11pt;
          }
          .header-info-cell:last-child {
            border-left: none;
          }
          .logo-container {
            text-align: center;
          }
          .logo-circle {
            width: 110px;
            height: 110px;
            background: #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 800;
            font-size: 16pt;
            margin: 0 auto;
            text-align: center;
            line-height: 1.2;
          }
          .company-name {
            font-size: 16pt;
            font-weight: 800;
            margin-top: 10px;
          }
          table.manifest-table {
            width: 100%;
            border-collapse: collapse;
            text-align: center;
            font-weight: bold;
            font-size: 11pt;
          }
          table.manifest-table th, table.manifest-table td {
            border: 2px solid #000;
            padding: 8px 4px;
            vertical-align: middle;
          }
          table.manifest-table th {
            background-color: #f2f2f2;
            font-size: 12pt;
          }
          .barcode-img {
            width: 120px;
            height: 40px;
          }
        </style>
      </head>
      <body>
        <div class="header-grid">
          <div class="header-info-box" style="margin-right: auto;">
            <div class="header-info-row">
              <div class="header-info-cell">رقم القائمة</div>
              <div class="header-info-cell">${randomListId}</div>
            </div>
          </div>
          
          <div class="logo-container">
            <div class="logo-circle">سستم<br>تاجر برو</div>
            <div class="company-name">كشف تسليم الطلبات</div>
          </div>

          <div class="header-info-box" style="margin-left: auto;">
            <div class="header-info-row">
              <div class="header-info-cell">التاريخ</div>
              <div class="header-info-cell" style="direction: ltr;">${todayDate}</div>
            </div>
            <div class="header-info-row">
              <div class="header-info-cell">عدد الوصولات</div>
              <div class="header-info-cell">${ordersToPrint.length}</div>
            </div>
          </div>
        </div>

        <table class="manifest-table">
          <thead>
            <tr>
              <th style="width: 3%;">#</th>
              <th style="width: 13%;">الوصل</th>
              <th style="width: 10%;">الهاتف</th>
              <th style="width: 15%;">الملاحظات</th>
              <th style="width: 10%;">المنطقة</th>
              <th style="width: 19%;">الأصناف</th>
              <th style="width: 10%;">الموظفين</th>
              <th style="width: 10%;">المبلغ</th>
              <th style="width: 10%;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${ordersToPrint.map((order, idx) => {
              const orderId = order.orderNumber || order.id.slice(-10).toUpperCase();
              const itemsList = order.items && order.items.length > 0 
                ? order.items.map((item: any) => `<div style="text-align: right; margin-bottom: 2px;">- ${item.productName || 'صنف غير معروف'} (${item.quantity || 1})</div>`).join('') 
                : '---';
              const statusLabel = statusMap[order.status]?.label || 'قيد الانتظار';
              
              return `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <img src="https://barcode.tec-it.com/barcode.ashx?data=${orderId}&code=Code128&dpi=96" class="barcode-img" alt="${orderId}" style="width:100px;height:35px;"/>
                  <br>${orderId}
                </td>
                <td style="direction: ltr; font-size: 11pt;">${order.customerPhone || order.phone || ''}</td>
                <td style="font-size: 10pt;">${order.notes || '---'}</td>
                <td style="font-size: 10pt;">${order.governorate || ''}<br>${order.region || ''}</td>
                <td style="font-size: 10pt; padding-right: 5px;">${itemsList}</td>
                <td style="font-size: 9pt;">
                  <div>المدخل: <br/>${order.employeeName || '---'}</div>
                  <div style="margin-top:4px;">النازل: <br/>${order.deliveryAgent || '---'}</div>
                </td>
                <td style="direction: ltr; font-size: 11pt;">${new Intl.NumberFormat('en-US').format(order.totalAmount || order.price || 0)}</td>
                <td style="font-size: 11pt; font-weight: bold;">${statusLabel}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <script>
          setTimeout(() => {
            window.print();
            window.close();
          }, 1500);
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(printContent);
      printWin.document.close();
      printWin.focus();
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
          
          
          {selectedOrderIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', backgroundColor: '#2a2d3d', border: '1px solid rgba(255,255,255,0.15)', padding: '0.5rem 1rem', borderRadius: '0.6rem' }}>
              <span style={{color: '#ffffff', fontWeight: 'bold', fontSize: '1.1rem'}}>حالة الطلبات:</span>
              <select 
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', 
                  padding: '0.4rem 0.8rem', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem'
                }}
                value={bulkStatusValue}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setBulkStatusValue(newStatus);
                  setShowBulkStatusModal(true);
                }}
              >
                <option value="" disabled style={{color: '#ffffff', backgroundColor: '#1e1e2d', fontSize: '1.1rem', padding: '0.5rem'}}>اختر الحالة...</option>
                {Object.entries(statusMap).map(([key, info]) => (
                   <option key={key} value={key} style={{color: '#ffffff', backgroundColor: '#1e1e2d', fontSize: '1.1rem', padding: '0.5rem'}}>{info.label} ({key})</option>
                ))}
              </select>
            </div>
          )}

          {hasAnyBulkAction && (
            <div className={styles.dropdownContainer} ref={bulkActionsRef}>
              <button 
                className={styles.bulkTriggerButton} 
                onClick={() => setShowBulkDropdown(!showBulkDropdown)}
              >
                <span>⚡ العمليات الجماعية</span>
                <span className={styles.bulkBadge}>{selectedOrderIds.length}</span>
                <span className={styles.bulkArrow}>{showBulkDropdown ? '▲' : '▼'}</span>
              </button>
              
              {showBulkDropdown && (
                <div className={styles.bulkDropdownMenu}>
                  {activeTab !== 'archived' ? (
                    <>
                      {canTransfer && (
                        <button 
                          className={styles.bulkDropdownItem}
                          onClick={() => {
                            setShowBulkDropdown(false);
                            setShowCompanyModal(true);
                          }}
                        >
                          <span className={styles.itemIcon}>🚚</span>
                          <span>ترحيل الطلبات</span>
                        </button>
                      )}

                      {canArchive && (
                        <button 
                          className={styles.bulkDropdownItem}
                          onClick={() => {
                            setShowBulkDropdown(false);
                            handleArchiveSelected();
                          }}
                        >
                          <span className={styles.itemIcon}>📁</span>
                          <span>أرشفة المحددة</span>
                        </button>
                      )}

                      {activeTab === 'returned' && canConfirmReturn && (
                        <button 
                          className={styles.bulkDropdownItem}
                          onClick={() => {
                            setShowBulkDropdown(false);
                            setShowReturnReceiptModal(true);
                          }}
                        >
                          <span className={styles.itemIcon}>📝</span>
                          <span>تأكيد استلام المحددة</span>
                        </button>
                      )}

                      {(canTransfer || canArchive || (activeTab === 'returned' && canConfirmReturn)) && canDelete && (
                        <div className={styles.bulkDropdownDivider} />
                      )}

                      {canDelete && (
                        <button 
                          className={`${styles.bulkDropdownItem} ${styles.bulkDropdownItemDanger}`}
                          onClick={() => {
                            setShowBulkDropdown(false);
                            setShowBulkDeleteModal(true);
                          }}
                        >
                          <span className={styles.itemIcon}>❌</span>
                          <span>حذف المحددة</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {canRestore && (
                        <button 
                          className={styles.bulkDropdownItem}
                          onClick={() => {
                            setShowBulkDropdown(false);
                            handleRestoreSelected();
                          }}
                        >
                          <span className={styles.itemIcon}>🔄</span>
                          <span>استعادة الطلبات</span>
                        </button>
                      )}

                      {canRestore && canDeletePermanent && (
                        <div className={styles.bulkDropdownDivider} />
                      )}

                      {canDeletePermanent && (
                        <button 
                          className={`${styles.bulkDropdownItem} ${styles.bulkDropdownItemDanger}`}
                          onClick={() => {
                            setShowBulkDropdown(false);
                            setShowBulkDeleteModal(true);
                          }}
                        >
                          <span className={styles.itemIcon}>❌</span>
                          <span>حذف النهائي</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <Link href="/orders/entry" className={styles.addButton}>
            <span>إضافة طلب</span>
            <span style={{ fontSize: '1rem' }}>➕</span>
          </Link>
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

      {/* Status Filter Buttons Row */}
      {activeTab !== 'returns_archive' && (
        <div style={{
          display: 'flex',
          gap: '0.6rem',
          overflowX: 'auto',
          padding: '0.75rem 1rem',
          margin: '0.5rem 0 1rem 0',
          backgroundColor: '#1e1b2e',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.05)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          <button
            onClick={() => setSelectedStatus('all')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: selectedStatus === 'all' ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
              backgroundColor: selectedStatus === 'all' ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <span>📁 الكل</span>
            <span style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              padding: '0.1rem 0.4rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              color: '#fff'
            }}>
              {baseList.length}
            </span>
          </button>
          
          {Object.entries(statusMap).map(([statusKey, info]) => {
            const count = statusCounts[statusKey] || 0;
            const isActive = selectedStatus === statusKey;
            const emojiMap: Record<string, string> = {
              pending: '⏳', backordered: '📥', processing: '⚙️', shipped: '📦',
              ofd: '🚚', delivered: '✅', cancelled: '❌', returned: '↩️',
              new: '✨', postponed: '📅'
            };
            
            if (count === 0 && !isActive) return null;
            
            return (
              <button
                key={statusKey}
                onClick={() => setSelectedStatus(statusKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  border: isActive ? `2px solid ${info.color}` : '1px solid rgba(255,255,255,0.04)',
                  backgroundColor: isActive ? info.bg : 'rgba(255,255,255,0.02)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{emojiMap[statusKey] || '•'} {info.label}</span>
                <span style={{
                  backgroundColor: info.bg,
                  color: info.color,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showOnlySelected && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#fbbf24',
          padding: '0.6rem 1rem',
          borderRadius: '8px',
          margin: '0.5rem 0 1rem 0',
          fontWeight: 'bold',
          fontSize: '0.95rem'
        }}>
          <span>📌 يتم الآن عرض الطلبات المحددة بالقائمة فقط ({filteredOrders.length} طلب)</span>
          <button 
            onClick={() => setShowOnlySelected(false)}
            style={{
              backgroundColor: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '0.25rem 0.75rem',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontFamily: 'inherit'
            }}
          >
            إظهار كافة الطلبات ✖
          </button>
        </div>
      )}

      {/* Table Top Controls */}
      <div className={styles.tableControls}>
        <div className={styles.controlsLeft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginLeft: '1rem' }}>
            <span>أظهر</span>
            <select 
              value={itemsPerPage} 
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className={styles.colFilterInput}
              style={{ width: '70px', textAlign: 'center', padding: '0.3rem', backgroundColor: 'var(--surface)' }}
            >
              <option value={25}>25</option>
              <option value={100}>100</option>
              <option value={300}>300</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
            <span>مدخلات</span>
          </div>
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
            <button 
              onClick={() => setShowBulkSelectModal(true)}
              style={{
                position: 'absolute',
                left: '3rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                transition: 'all 0.3s ease'
              }}
              title="تحديد متعدد بالمعرفات (نسخ ولصق)"
            >
              📋
            </button>
          </div>
        </div>
        <div className={styles.controlsRight}>
          <button 
            className={styles.controlButton} 
            onClick={async () => {
              try {
                // Filter active orders from the local state
                const activeStatuses = ['shipped', 'ofd', 'postponed'];
                const activeOrders = orders.filter(o => activeStatuses.includes(o.status));
                
                if (activeOrders.length === 0) {
                  setNotificationModal({ show: true, message: 'ℹ️ لا توجد طلبات نشطة للمزامنة' });
                  return;
                }

                // Prepare shipment numbers and map
                const shipmentsToQuery = activeOrders.map(o => o.shipmentNumber || o.orderNumber || o.id).filter(Boolean);
                
                const res = await fetch('/api/orders/sync-jenni', { 
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    userId: auth.currentUser?.uid,
                    shipmentNumbers: shipmentsToQuery
                  })
                });
                const data = await res.json();
                if (!data.success) {
                  setNotificationModal({ show: true, message: `❌ فشل المزامنة: ${data.message}` });
                  return;
                }

                // Apply updates returned by the API on the client side
                if (data.updates && data.updates.length > 0) {
                  let updatedCount = 0;
                  const batch = writeBatch(db);
                  
                  for (const update of data.updates) {
                    const localOrder = activeOrders.find(o => (o.shipmentNumber || o.orderNumber || o.id) === update.shipmentNumber);
                    if (localOrder) {
                      // Compare to see if fields actually changed to avoid unnecessary Firestore writes
                      const targetStatus = update.newStatus || localOrder.status;
                      const statusChanged = localOrder.status !== targetStatus;
                      const missingIds = !localOrder.jenniShipmentId || !localOrder.shipmentId;
                      const detailsChanged = localOrder.deliveryStatus !== update.deliveryStatus || localOrder.deliveryNote !== (update.deliveryNote || '');

                      if (statusChanged || missingIds || detailsChanged) {
                        const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', localOrder.id);
                        batch.update(orderRef, {
                          status: targetStatus,
                          deliveryStatus: update.deliveryStatus,
                          deliveryNote: update.deliveryNote || '',
                          shipmentId: update.shipmentNumber || localOrder.id,
                          jenniShipmentId: update.jenniShipmentId,
                          updatedAt: new Date()
                        });
                        updatedCount++;
                      }
                    }
                  }
                  
                  if (updatedCount > 0) {
                    await batch.commit();
                  }
                  setNotificationModal({ show: true, message: `✅ تمت المزامنة وتحديث ${updatedCount} طلبات` });
                } else {
                  setNotificationModal({ show: true, message: '✅ جميع الحالات مطابقة ومحدثة بالفعل' });
                }
              } catch (err) {
                console.error("Sync error:", err);
                setNotificationModal({ show: true, message: '❌ حدث خطأ في الاتصال' });
              }
            }}
          >
            مزامنة الحالات 🔄
          </button>
          <button className={styles.controlButton} onClick={handlePrintManifest}>طباعة كشف (قائمة)</button>
          <button className={styles.controlButton} onClick={handlePrintLabels}>طباعة ملصق 100x150</button>
          <button className={styles.controlButton} onClick={handleExportZitaExcel}>تصدير Excel (زيطة)</button>
          <button className={styles.controlButton} onClick={handleExportExcel}>تصدير Excel</button>
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
                  <span>مستخدم النظام</span>
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
                  <span>الملاحظات</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.notes} onChange={(e) => handleFilterChange('notes', e.target.value)} />
                </div>
              </th>
              <th>
                <div className={styles.thContent}>
                  <span>الحالة</span>
                  <div style={{ position: 'relative', width: '100%' }} ref={statusFilterRef}>
                    <div 
                      className={styles.colFilterInput} 
                      style={{ padding: '0.4rem', cursor: 'pointer', backgroundColor: 'var(--surface)', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '32px', userSelect: 'none' }}
                      onClick={() => setShowStatusFilterDropdown(!showStatusFilterDropdown)}
                    >
                      <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {columnFilters.status === '' ? 'الكل' : `${columnFilters.status.split(',').length} محدد`}
                      </span>
                      <span style={{ fontSize: '0.6rem' }}>▼</span>
                    </div>
                    {showStatusFilterDropdown && (
                      <div style={{ 
                        position: 'absolute', top: '100%', right: 0, zIndex: 50, minWidth: '220px',
                        backgroundColor: 'var(--surface)', border: '1px solid var(--border)', 
                        borderRadius: '6px', marginTop: '4px', maxHeight: '300px', overflowY: 'auto',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem'
                      }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.3rem', borderRadius: '4px', backgroundColor: columnFilters.status === '' ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }} onClick={(e) => e.stopPropagation()}>
                           <input 
                              type="checkbox" 
                              checked={columnFilters.status === ''} 
                              onChange={() => handleFilterChange('status', '')} 
                              style={{ width: '16px', height: '16px', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 'bold' }}>تحديد الكل</span>
                        </label>
                        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0.2rem 0' }}></div>
                        {Object.entries(statusMap).map(([key, info]) => {
                          const isChecked = (columnFilters.status ? columnFilters.status.split(',') : []).includes(key);
                          return (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.3rem', borderRadius: '4px', backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }} onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={(e) => {
                                  const currentArr = columnFilters.status ? columnFilters.status.split(',') : [];
                                  let newArr;
                                  if (e.target.checked) {
                                    newArr = [...currentArr, key];
                                  } else {
                                    newArr = currentArr.filter(k => k !== key);
                                  }
                                  handleFilterChange('status', newArr.join(','));
                                }} 
                                style={{ width: '16px', height: '16px', accentColor: '#3b82f6', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{info.label} ({key})</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
                  <span>شركة الشحن</span>
                  <input type="text" className={styles.colFilterInput} placeholder="بحث..." value={columnFilters.shippingCompany || ''} onChange={(e) => handleFilterChange('shippingCompany', e.target.value)} />
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
            {paginatedOrders.length > 0 ? paginatedOrders.map((order) => {
              const isSelected = selectedOrderIds.includes(order.id);
              const isFullyLocked = false; // TEMPORARILY UNLOCKED ['shipped', 'delivered', 'returned', 'cancelled'].includes(order.status) || order.isArchived || order.is_settled === true;
              const isDeleteLocked = false; // UNLOCKED! !order.isArchived && (['shipped', 'delivered', 'returned', 'cancelled'].includes(order.status) || order.is_settled === true);
              
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
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                      <div style={{ display: 'inline-block', background: '#fff', padding: '2px', borderRadius: '4px', overflow: 'hidden' }}>
                        <Barcode value={order.id.slice(-6).toUpperCase()} width={1.2} height={25} displayValue={true} fontSize={11} margin={0} background="#ffffff" lineColor="#000000" />
                      </div>
                      {order.isArchived && (
                        <span style={{ backgroundColor: '#475569', color: '#f8fafc', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          📁 مؤرشف
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{order.customerName}</td>
                  <td>{order.governorate}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{order.customerPhone || order.phone}</td>
                  <td style={{ color: '#10B981', fontWeight: 'bold' }}>{order.formattedTotal} د.ع</td>
                  <td>{order.notes || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <select 
                        style={{ 
                          backgroundColor: statusMap[order.status || 'pending']?.bg || 'rgba(148, 163, 184, 0.15)', 
                          color: statusMap[order.status || 'pending']?.color || '#94a3b8', 
                          padding: '0.45rem 0.8rem', 
                          borderRadius: '1.5rem', 
                          fontSize: '1rem', 
                          fontWeight: 'bold',
                          border: '1px solid rgba(255,255,255,0.05)',
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
                          <option key={key} value={key} style={{color: '#ffffff', backgroundColor: '#1e1e2d', textAlign: 'right', fontSize: '1.1rem', padding: '0.5rem'}}>
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
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }} title="مُدخل الطلب">إ: {order.employeeName || '---'}</span>
                      <span style={{ color: '#60a5fa' }} title="موظف الحجز (النازل)">ح: {order.bookingEmployeeName || '---'}</span>
                    </div>
                  </td>
                  <td>{order.shippingCompany || '---'}</td>
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
                          if (!isDeleteLocked) setOrderToDelete(order);
                        }}
                        style={{ 
                          borderColor: isDeleteLocked ? '#475569' : '#ef4444', 
                          color: isDeleteLocked ? '#475569' : '#ef4444',
                          opacity: isDeleteLocked ? 0.5 : 1,
                          cursor: isDeleteLocked ? 'not-allowed' : 'pointer'
                        }}
                        disabled={isDeleteLocked}
                      >
                        🗑️
                      </button>
                      {!['cancelled', 'returned', 'delivered'].includes(order.status) && (
                        <button 
                          className={styles.actionButton} 
                          title="إلغاء الطلب"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelOrder(order);
                          }}
                          style={{ borderColor: '#f97316', color: '#f97316' }}
                        >
                          🚫
                        </button>
                      )}
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
        {filteredOrders.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              إظهار {(safeCurrentPage - 1) * itemsPerPage + 1} إلى {Math.min(safeCurrentPage * itemsPerPage, filteredOrders.length)} من أصل {filteredOrders.length} مدخل
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safeCurrentPage === 1}
                style={{ padding: '0.4rem 0.8rem', backgroundColor: safeCurrentPage === 1 ? 'transparent' : 'var(--surface-hover)', border: '1px solid var(--border)', color: safeCurrentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)', borderRadius: 'var(--radius-sm)', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                السابق
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontWeight: 'bold' }}>
                {safeCurrentPage} / {totalPages}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage === totalPages}
                style={{ padding: '0.4rem 0.8rem', backgroundColor: safeCurrentPage === totalPages ? 'transparent' : 'var(--surface-hover)', border: '1px solid var(--border)', color: safeCurrentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)', borderRadius: 'var(--radius-sm)', cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {activeTab === 'returns_archive' && (
        <div className={styles.tableWrapper}>
          {!selectedReturnMonth ? (
             <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '2rem' }}>
               {Object.keys(groupedReturnBatches).sort((a,b) => b.localeCompare(a)).map(monthKey => {
                 const [year, month] = monthKey.split('-');
                 return (
                   <div 
                     key={monthKey}
                     onClick={() => setSelectedReturnMonth(monthKey)}
                     style={{
                       background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
                       padding: '1.5rem', width: '200px', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s',
                       display: 'flex', flexDirection: 'column', alignItems: 'center'
                     }}
                     onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                     onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                   >
                     <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📁</div>
                     <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-primary)', fontSize: '1.1rem' }}>شهر {month}-{year}</h3>
                     <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                       {groupedReturnBatches[monthKey].length} كشوفات مستلمة
                     </p>
                   </div>
                 );
               })}
               {Object.keys(groupedReturnBatches).length === 0 && (
                 <div style={{ textAlign: 'center', width: '100%', padding: '3rem', color: 'var(--text-muted)' }}>
                   لا توجد كشوفات راجعات حالياً.
                 </div>
               )}
             </div>
          ) : !selectedReturnDay ? (
             <div style={{ padding: '1rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                 <h3 style={{ margin: 0, color: 'var(--accent-primary)' }}>أيام كشوفات شهر {selectedReturnMonth}</h3>
                 <button className={styles.cancelButton} onClick={() => { setSelectedReturnMonth(null); setSelectedReturnDay(null); }}>🔙 العودة للمجلدات</button>
               </div>
               <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '1.5rem 0' }}>
                 {Object.keys(groupedReturnDays).sort((a,b) => b.localeCompare(a)).map(dayKey => {
                   return (
                     <div 
                       key={dayKey}
                       onClick={() => setSelectedReturnDay(dayKey)}
                       style={{
                         background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
                         padding: '1.5rem', width: '200px', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s',
                         display: 'flex', flexDirection: 'column', alignItems: 'center'
                       }}
                       onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                       onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                     >
                       <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📅</div>
                       <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-primary)', fontSize: '1.1rem' }}>يوم {dayKey}</h3>
                       <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                         {groupedReturnDays[dayKey].length} كشوفات مستلمة
                       </p>
                     </div>
                   );
                 })}
                 {Object.keys(groupedReturnDays).length === 0 && (
                   <div style={{ textAlign: 'center', width: '100%', padding: '3rem', color: 'var(--text-muted)' }}>
                     لا توجد أيام مسجلة لهذا الشهر.
                   </div>
                 )}
               </div>
             </div>
          ) : (
             <div style={{ padding: '1rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                 <h3 style={{ margin: 0, color: 'var(--accent-primary)' }}>كشوفات يوم {selectedReturnDay}</h3>
                 <button className={styles.cancelButton} onClick={() => setSelectedReturnDay(null)}>🔙 العودة للأيام</button>
               </div>
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
                   {groupedReturnDays[selectedReturnDay]?.map((record: any) => (
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
                           onClick={() => { setSelectedReturnBatch(record); setSelectedBatchOrderIds([]); }}
                         >
                           👁️ عرض التفاصيل
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          )}
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
                  <span className={styles.detailsLabel}>مستخدم النظام</span>
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
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%', backgroundColor: '#1e1b2e' }}>
            <div className={styles.modalHeader}>
              <h2>✏️ تعديل الطلب <span style={{ color: 'var(--primary)', fontSize: '1rem', marginRight: '0.5rem' }}>#{editingOrder.id.slice(-6).toUpperCase()}</span></h2>
              <button className={styles.closeButton} onClick={() => setEditingOrder(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <form onSubmit={saveOrderUpdates} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  
                  {/* Right Column: Customer Details */}
                  <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem', borderInlineEnd: '1px solid rgba(255,255,255,0.08)', paddingInlineEnd: '1.5rem' }}>
                    <h3 style={{ color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>👤 بيانات مستخدم النظام</h3>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>مستخدم النظام</label>
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
                        <option value="in_progress">قيد التنفيذ (in_progress)</option>
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
                      <label className={styles.label}>شركة الشحن</label>
                      <input 
                        type="text" 
                        className={styles.input} 
                        value={editingOrder.shippingCompany || ''} 
                        onChange={e => setEditingOrder({...editingOrder, shippingCompany: e.target.value})} 
                        disabled={isPartiallyLocked}
                        style={lockedInputStyle}
                        placeholder="مثال: زاجل، جيني..."
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>الملاحظات</label>
                      <textarea className={styles.input} value={editingOrder.notes || ''} onChange={e => setEditingOrder({...editingOrder, notes: e.target.value})} rows={2}></textarea>
                    </div>
                  </div>

                  {/* Left Column: Cart / Items */}
                  <div style={{ flex: 1.2, minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ color: '#10b981', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🛒 سلة المشتريات</span>
                      <span style={{ fontSize: '1rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        المجموع: 
                        <input 
                          type="number" 
                          value={editingOrder.totalAmount || 0} 
                          onChange={(e) => setEditingOrder({...editingOrder, totalAmount: Number(e.target.value)})} 
                          style={{width: '90px', background: 'transparent', border: 'none', borderBottom: '1px dashed rgba(16,185,129,0.5)', color: '#10b981', outline: 'none', padding: '0.1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem'}}
                        /> 
                        د.ع
                      </span>
                    </h3>

                    {/* Product Search Input inside Modal */}
                    <div className={styles.formGroup} style={{ position: 'relative' }}>
                      <label className={styles.label}>إضافة منتجات للطلب</label>
                      <div className={styles.searchableSelectContainer}>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="ابحث بالاسم أو الباركود لإضافة منتج..."
                          value={searchQueryEdit}
                          onChange={e => {
                            setSearchQueryEdit(e.target.value);
                            setShowProductDropdownEdit(true);
                          }}
                          onFocus={() => setShowProductDropdownEdit(true)}
                          onBlur={() => setTimeout(() => setShowProductDropdownEdit(false), 250)}
                        />
                        {searchQueryEdit && (
                          <button
                            type="button"
                            onClick={() => { setSearchQueryEdit(''); setShowProductDropdownEdit(false); }}
                            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      {showProductDropdownEdit && searchQueryEdit.trim() !== '' && (
                        <ul className={styles.dropdownList} style={{ width: '100%' }}>
                          {filteredProductsEdit.map(product => (
                            <li
                              key={product.id}
                              className={styles.dropdownItem}
                              onClick={() => addProductToEditingOrder(product)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>{product.name}</span>
                                <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                                  {product.units && product.units.length > 0 ? `${product.units[0].selling} د.ع` : '---'}
                                </span>
                              </div>
                            </li>
                          ))}
                          {filteredProductsEdit.length === 0 && (
                            <li className={styles.noResults}>لا توجد نتائج تطابق بحثك</li>
                          )}
                        </ul>
                      )}
                    </div>

                    {/* Cart Items List */}
                    <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                      {(editingOrder.items || []).length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>السلة فارغة حالياً</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                              <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.85rem', color: '#94a3b8' }}>المنتج</th>
                              <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', width: '90px' }}>السعر</th>
                              <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', width: '100px' }}>الكمية</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.85rem', color: '#94a3b8', width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(editingOrder.items || []).map((item: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                                  <div style={{ fontWeight: 'bold' }}>{item.productName}</div>
                                </td>
                                <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    value={item.unitPrice || 0}
                                    onChange={e => updateEditingOrderItemPrice(item.productId, Number(e.target.value))}
                                    style={{
                                      width: '100%',
                                      backgroundColor: 'var(--background)',
                                      border: '1px solid var(--border)',
                                      color: '#ffffff',
                                      padding: '0.2rem',
                                      borderRadius: '4px',
                                      textAlign: 'center',
                                      fontSize: '0.85rem'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => updateEditingOrderItemQuantity(item.productId, item.quantity - 1)}
                                      style={{ width: '20px', height: '20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      value={item.quantity || 1}
                                      onChange={e => updateEditingOrderItemQuantity(item.productId, Number(e.target.value))}
                                      style={{
                                        width: '40px',
                                        backgroundColor: 'var(--background)',
                                        border: '1px solid var(--border)',
                                        color: '#ffffff',
                                        padding: '0.2rem',
                                        borderRadius: '4px',
                                        textAlign: 'center',
                                        fontSize: '0.85rem'
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateEditingOrderItemQuantity(item.productId, item.quantity + 1)}
                                      style={{ width: '20px', height: '20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => removeProductFromEditingOrder(item.productId)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}
                                    title="حذف المنتج"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
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
              {bulkStatusValue === 'delivered' && (
                <div style={{ marginTop: '1.5rem', textAlign: 'right', backgroundColor: 'var(--surface-hover)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>أي شركة توصيل سلمت هذا الطلب؟ (اختياري)</label>
                  <select 
                    className={styles.input} 
                    value={deliveryCompany} 
                    onChange={(e) => {
                      setDeliveryCompany(e.target.value);
                      if (e.target.value !== 'أخرى') setCustomDeliveryCompany('');
                    }}
                  >
                    <option value="">-- حدد الشركة لتسهيل الحسابات --</option>
                    {shippingCompanies.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="أخرى">أخرى...</option>
                  </select>
                  {deliveryCompany === 'أخرى' && (
                    <input 
                      type="text" 
                      className={styles.input} 
                      style={{ marginTop: '0.5rem' }} 
                      placeholder="اكتب اسم الشركة..." 
                      value={customDeliveryCompany}
                      onChange={(e) => setCustomDeliveryCompany(e.target.value)}
                    />
                  )}
                </div>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {selectedBatchOrderIds.length > 0 
                    ? `تم تحديد ${selectedBatchOrderIds.length} طلبات للطباعة`
                    : 'إذا لم تقم بتحديد أي طلب، ستتم طباعة كافة الطلبات في الكشف.'}
                </span>
                <button 
                  onClick={() => {
                    if (selectedBatchOrderIds.length === selectedReturnBatch.orders?.length) {
                      setSelectedBatchOrderIds([]);
                    } else {
                      setSelectedBatchOrderIds(selectedReturnBatch.orders?.map((o: any) => o.id) || []);
                    }
                  }}
                  style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {selectedBatchOrderIds.length === selectedReturnBatch.orders?.length ? 'إلغاء التحديد' : 'تحديد الكل'}
                </button>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr className={styles.trHead}>
                    <th style={{ width: '40px' }}>تحديد</th>
                    <th>المعرف</th>
                    <th>اسم الزبون</th>
                    <th>المبلغ</th>
                    <th>حالة الطلب</th>
                    <th style={{ width: '60px' }}>تفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReturnBatch.orders?.map((ord: any, idx: number) => {
                    const isSelected = selectedBatchOrderIds.includes(ord.id);
                    return (
                    <tr key={idx} className={styles.tr} style={isSelected ? { backgroundColor: 'var(--surface-hover)' } : {}} onClick={() => {
                      if (isSelected) {
                        setSelectedBatchOrderIds(prev => prev.filter(id => id !== ord.id));
                      } else {
                        setSelectedBatchOrderIds(prev => [...prev, ord.id]);
                      }
                    }}>
                      <td onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox} 
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedBatchOrderIds(prev => [...prev, ord.id]);
                            else setSelectedBatchOrderIds(prev => prev.filter(id => id !== ord.id));
                          }}
                        />
                      </td>
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
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            const fullOrder = orders.find(o => o.id === ord.id);
                            if (fullOrder) {
                              setSelectedOrder(fullOrder);
                            } else {
                              alert("لم يتم العثور على تفاصيل هذا الطلب.");
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            padding: '4px'
                          }}
                          title="عرض تفاصيل الطلب كاملة"
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.submitButton} 
                onClick={() => {
                  const ordersToPrint = selectedBatchOrderIds.length > 0 
                    ? selectedReturnBatch.orders.filter((o: any) => selectedBatchOrderIds.includes(o.id))
                    : selectedReturnBatch.orders;
                  
                  const printContent = `
                    <html dir="rtl">
                    <head>
                      <title>كشف المرتجعات المستلمة</title>
                      <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                        th { background-color: #f2f2f2; }
                        .header { text-align: center; margin-bottom: 20px; }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <h2>كشف مرتجعات مستلمة</h2>
                        <p><strong>رقم الكشف:</strong> ${selectedReturnBatch.batchId}</p>
                        <p><strong>المندوب المسلم:</strong> ${selectedReturnBatch.driverName} | <strong>الموظف المستلم:</strong> ${selectedReturnBatch.employeeName}</p>
                        <p><strong>التاريخ:</strong> ${selectedReturnBatch.formattedDate}</p>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th>المعرف</th>
                            <th>اسم الزبون</th>
                            <th>المبلغ</th>
                            <th>حالة الطلب</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${ordersToPrint.map((ord: any) => `
                            <tr>
                              <td>#${ord.id?.slice(-6).toUpperCase()}</td>
                              <td>${ord.customerName}</td>
                              <td>${new Intl.NumberFormat('en-US').format(ord.totalAmount)} د.ع</td>
                              <td>${statusMap[ord.status]?.label || ord.status}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </body>
                    </html>
                  `;
                  const printWin = window.open('', '_blank');
                  if (printWin) {
                    printWin.document.write(printContent);
                    printWin.document.close();
                    printWin.focus();
                    setTimeout(() => { printWin.print(); printWin.close(); }, 250);
                  }
                }} 
                style={{ backgroundColor: '#4b5563' }}
              >
                {selectedBatchOrderIds.length > 0 ? 'طباعة المحدد' : 'طباعة الكشف'}
              </button>
              <button className={styles.cancelButton} onClick={() => setSelectedReturnBatch(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {showBulkSelectModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBulkSelectModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <div className={styles.modalHeader}>
              <h3>📋 تحديد متعدد (لصق المعرفات)</h3>
              <button className={styles.closeButton} onClick={() => setShowBulkSelectModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                قم بلصق أرقام الطلبات أو المعرفات هنا (يمكنك نسخ عمود كامل من الإكسل ولصقه مباشرة).
              </p>
              <textarea
                value={bulkSelectText}
                onChange={(e) => setBulkSelectText(e.target.value)}
                placeholder="مثال:&#10;206061600027&#10;100209&#10;100208"
                style={{
                  width: '100%',
                  height: '200px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  fontSize: '1rem',
                  resize: 'vertical',
                  direction: 'ltr',
                  textAlign: 'left'
                }}
              />
            </div>
            <div className={styles.modalFooter} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className={styles.cancelButton} onClick={() => setShowBulkSelectModal(false)}>إلغاء</button>
              <button className={styles.submitButton} style={{ backgroundColor: '#ef4444', color: '#fff' }} onClick={handleBulkSelectInverse}>تحديد غير المطابق</button>
              <button className={styles.submitButton} style={{ backgroundColor: '#10b981', color: '#fff' }} onClick={handleBulkSelectAndShow}>إظهار الطلبات المحددة</button>
              <button className={styles.saveButton} onClick={handleBulkSelectSubmit}>تحديد الطلبات</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
