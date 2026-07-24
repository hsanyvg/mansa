"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getDoc, 
  setDoc,
  query as fsQuery, 
  where, 
  getDocs,
  limit,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  name: string;
  barcode: string;
  units: any[];
  stock: Record<string, { quantity: number; unit: string }>;
}

interface CartItem {
  id: string; // unique cart item id (usually product id)
  product: Product;
  quantity: number;
  unitPrice: number;
}

export default function OrderEntryPage() {
  // Form Data (Right side)
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerPhone2: '',
    governorate: '',
    region: '',
    notes: '',
    paymentMethod: 'كاش عند التوصيل',
    fbLoginId: ''
  });
  
  const [manualTotal, setManualTotal] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<string>('pending');
  const [importDeductStock, setImportDeductStock] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const [showQuickSaleModal, setShowQuickSaleModal] = useState<boolean>(false);
  const [quickProdId, setQuickProdId] = useState<string>('');
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickTotalAmount, setQuickTotalAmount] = useState<string>('');
  const [quickDate, setQuickDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [quickDeductStock, setQuickDeductStock] = useState<boolean>(true);
  const [quickSettleFinance, setQuickSettleFinance] = useState<boolean>(true);
  const [isSavingQuick, setIsSavingQuick] = useState<boolean>(false);

  const [customerHistory, setCustomerHistory] = useState<{
    count: number;
    totalSpent: number;
    returns: number;
    deliveredCount: number;
    lastProfile?: any;
  } | null>(null);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [ordersMatches, setOrdersMatches] = useState<any[]>([]);

  const [customersDb, setCustomersDb] = useState<any[]>([]);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);

  const [showGovDropdown, setShowGovDropdown] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [notificationModal, setNotificationModal] = useState({ show: false, message: '' });

  const [baseProducts, setBaseProducts] = useState<Product[]>([]);
  const [compositeProductsData, setCompositeProductsData] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedBookingEmployeeId, setSelectedBookingEmployeeId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [categoriesDb, setCategoriesDb] = useState<any[]>([]);
  const [pagesDb, setPagesDb] = useState<any[]>([]);

  const governoratesList = [
    "بغداد", "البصرة", "نينوى (الموصل)", "أربيل", "النجف", "ذي قار (الناصرية)",
    "كركوك", "الأنبار (الرمادي)", "ديالى (بعقوبة)", "المثنى (السماوة)",
    "القادسية (الديوانية)", "ميسان (العمارة)", "واسط (الكوت)", "صلاح الدين (تكريت)",
    "دهوك", "السليمانية", "بابل (الحلة)", "كربلاء"
  ];

  // Fetch products from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'), (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setBaseProducts(pData);
    });
    return () => unsub();
  }, []);

  // Fetch employees
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'employees'), (snapshot) => {
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(empData.filter((e: any) => e.isActive));
    });
    const savedEmpId = localStorage.getItem('selectedEmployeeId');
    if (savedEmpId) setSelectedEmployeeId(savedEmpId);
    const savedBookingEmpId = localStorage.getItem('selectedBookingEmployeeId');
    if (savedBookingEmpId) setSelectedBookingEmployeeId(savedBookingEmpId);
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

  // Fetch customers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'customers'), (snapshot) => {
      setCustomersDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch categories to filter search results
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories'), (snapshot) => {
      setCategoriesDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch pages_stores to filter search results
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'pages_stores'), (snapshot) => {
      setPagesDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch customer history when phone is 11 digits
  useEffect(() => {
    const phone = formData.customerPhone.trim();
    const name = formData.customerName.trim().toLowerCase();
    
    // Smart Lookup: If name matches an official record exactly, we treat it as identifying the customer.
    const officialMatch = customersDb.find(c => c.name.toLowerCase() === name);
    const searchPhone = officialMatch ? officialMatch.phone : (phone.length >= 10 ? phone : null);

    if (searchPhone) {
      const fetchHistory = async () => {
        setIsSearchingHistory(true);
        try {
          // 1. Query Orders
          const qOrders = fsQuery(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders'), where('customerPhone', '==', searchPhone));
          const snapOrders = await getDocs(qOrders);
          
          let count = 0;
          let totalSpent = 0;
          let returns = 0;
          let deliveredCount = 0;

          snapOrders.forEach(doc => {
            const data = doc.data();
            count++;
            if (data.status === 'delivered' || data.status === 'partial') {
              totalSpent += (data.totalAmount || 0);
              deliveredCount++;
            }
            if (data.status === 'cancelled' || data.status === 'returned') {
              returns++;
            }
          });

          // 2. Query Profile
          const qCust = fsQuery(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'customers'), where('phone', '==', searchPhone));
          const snapCust = await getDocs(qCust);
          let lastProfile = null;
          if (!snapCust.empty) {
            lastProfile = snapCust.docs[0].data();
          }

          setCustomerHistory({ count, totalSpent, returns, deliveredCount, lastProfile });
        } catch (err) {
          console.error("Error fetching history:", err);
        } finally {
          setIsSearchingHistory(false);
        }
      };
      fetchHistory();
    } else {
      setCustomerHistory(null);
    }
  }, [formData.customerPhone, customersDb]);

  useEffect(() => {
    const phoneQuery = formData.customerPhone.trim();

    if (phoneQuery.length < 10) {
      setOrdersMatches([]);
      return;
    }

    const searchOrders = async () => {
      try {
        const matches: any[] = [];
        
        // Search by Phone ONLY
        const qPhone = fsQuery(
          collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders'), 
          where('customerPhone', '>=', phoneQuery), 
          where('customerPhone', '<=', phoneQuery + '\uf8ff'),
          limit(5)
        );
        const snapPhone = await getDocs(qPhone);
        snapPhone.forEach(doc => {
          const d = doc.data();
          matches.push({
            id: 'ord-' + doc.id,
            name: d.customerName,
            phone: d.customerPhone,
            province: d.governorate,
            area: d.region,
            source: 'order'
          });
        });

        setOrdersMatches(matches);
      } catch (err) {
        console.error("Phone search error:", err);
      }
    };

    const timer = setTimeout(searchOrders, 300); // Simple debounce
    return () => clearTimeout(timer);
  }, [formData.customerPhone]);

  // Merge products and dynamically calculate available bundles
  const products = React.useMemo(() => {
    const merged = [...baseProducts];
    
    compositeProductsData.forEach(cp => {
      // Calculate max available bundles
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
        barcode: '', // Currently composite products might not have barcodes
        units: [{ selling: cp.sellingPrice || 0, type: 'بكج' }],
        stock: { 'virtual_store': { quantity: minBundles, unit: 'بكج' } },
        isComposite: true,
        composition: cp.composition || []
      } as any);
    });
    
    return merged;
  }, [baseProducts, compositeProductsData]);

  // Form Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'customerPhone') {
      setShowPhoneDropdown(true);
    }
  };

  const handleSelectCustomer = (customer: any) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone,
      governorate: customer.province || '',
      region: customer.area || '',
      notes: customer.notes || prev.notes
    }));
    setShowPhoneDropdown(false);
    // History Effect will trigger automatically because phone matches
  };

  const handleAddReplaceNote = () => {
    setFormData(prev => {
      const tag = "استبدال هذا الطلب";
      const currentNotes = prev.notes || "";
      if (currentNotes.includes(tag)) return prev; // Avoid duplicates
      return {
        ...prev,
        notes: currentNotes ? `${currentNotes}\n${tag}` : tag
      };
    });
  };

  const applyHistoricalData = () => {
    if (customerHistory?.lastProfile) {
      const p = customerHistory.lastProfile;
      setFormData(prev => ({
        ...prev,
        customerName: p.name || prev.customerName,
        governorate: p.province || prev.governorate,
        region: p.area || prev.region,
        notes: p.notes || prev.notes
      }));
    } else if (customerHistory?.count && customerHistory.count > 0) {
       // If no profile in 'customers' collection, try to find an order with the same phone to get Name/Address
       // This is a fallback if the customer wasn't explicitly saved to the 'customers' collection.
       // However, the user mainly wants auto-fill from recognized data.
    }
  };



  const filteredCustomersByPhone = React.useMemo(() => {
    const phoneQuery = (formData.customerPhone || '').trim();
    if (phoneQuery.length < 10) return [];

    const list: any[] = [];
    const customersMatched = customersDb
      .filter(c => c.phone.includes(phoneQuery))
      .map(c => ({ ...c, source: 'customer' }));
    list.push(...customersMatched);

    ordersMatches.forEach(om => {
      if (om.phone.includes(phoneQuery) && !list.find(item => item.phone === om.phone)) {
        list.push(om);
      }
    });

    return list;
  }, [customersDb, ordersMatches, formData.customerPhone]);

  const isValidPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\s+/g, '');
    return /^(\+?\d{10,15})$/.test(cleaned);
  };

  const isPhoneInvalid = (formData.customerPhone.length > 0 && !isValidPhoneNumber(formData.customerPhone)) || 
                         (hasAttemptedSubmit && !isValidPhoneNumber(formData.customerPhone));

  const isFieldInvalid = (fieldName: keyof typeof formData) => {
    if (!hasAttemptedSubmit) return false;
    if (fieldName === 'notes') return false; // Optional
    if (fieldName === 'customerPhone') return isPhoneInvalid;
    return formData[fieldName].trim() === '';
  };

  const getInputClass = (fieldName: keyof typeof formData) => {
    return `${styles.input} ${isFieldInvalid(fieldName) ? styles.inputError : ''}`;
  };

  const hasGlobalError = hasAttemptedSubmit && (
    isFieldInvalid('customerName') ||
    isPhoneInvalid ||
    isFieldInvalid('governorate') ||
    isFieldInvalid('region')
  );

  // Cart Functions
  const calculatedTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalAmount = manualTotal !== '' ? Number(manualTotal) : calculatedTotal;

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        // Price strategy: use first unit selling price if available, else 0
        const price = (product.units && product.units.length > 0) ? product.units[0].selling : 0;
        return [...prev, { id: product.id, product, quantity: 1, unitPrice: price }];
      }
    });
    setSearchQuery('');
    setShowProductDropdown(false);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const updateQuantity = (id: string, newQty: number) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
  };

  const updateUnitPrice = (id: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, unitPrice: newPrice } : item));
  };

  const updateItemTotal = (id: string, newTotal: number) => {
    if (newTotal < 0) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, unitPrice: newTotal / item.quantity } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Search logic
  const filteredProducts = products.filter(p => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = e.currentTarget.value;
      if (!query) return;

      const exactMatch = products.find(p => p.barcode === query);
      if (exactMatch) {
         addToCart(exactMatch);
      } else {
         const validProducts = products.filter(p => {
           const pNameClean = p.name?.trim().toLowerCase();
           if (!pNameClean) return false;
           const isPageName = pagesDb.some(page => page.name?.trim().toLowerCase() === pNameClean);
           const isMainCatName = categoriesDb.some(cat => cat.name?.trim().toLowerCase() === pNameClean);
           if (isPageName || isMainCatName) return false;
           return p.name?.toLowerCase().includes(query.toLowerCase()) || p.barcode === query;
         });
         
         if (validProducts.length === 1) {
           addToCart(validProducts[0]);
         }
      }
    }
  };

  const handleKeyDownForm = (e: React.KeyboardEvent<HTMLInputElement>, nextFieldId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextField = document.getElementById(nextFieldId);
      if (nextField) nextField.focus();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsed = data.map((row: any, idx: number) => {
        const custName = (row['اسم الزبون'] || row['الزبون'] || row['الاسم'] || row['customerName'] || row['name'] || 'زبون بدون اسم').toString().trim();
        const custPhone = (row['هاتف الزبون'] || row['رقم الهاتف'] || row['الموبايل'] || row['الهاتف'] || row['رقم الموبايل'] || row['customerPhone'] || row['phone'] || '').toString().trim();
        const custPhone2 = (row['هاتف ثاني'] || row['هاتف 2'] || row['رقم ثاني'] || row['customerPhone2'] || '').toString().trim();
        const gov = (row['المحافظة'] || row['محافظة'] || row['governorate'] || 'بغداد').toString().trim();
        const reg = (row['المنطقة'] || row['العنوان'] || row['المنطقه'] || row['region'] || row['address'] || '').toString().trim();
        const notes = (row['الملاحظات'] || row['ملاحظات'] || row['ملاحظة'] || row['notes'] || '').toString().trim();
        
        const prodStr = (row['المنتج'] || row['اسم المنتج'] || row['الصنف'] || row['المادة'] || row['productName'] || row['product'] || 'منتج عام').toString().trim();
        const matchedProd = products.find(p => p.name && p.name.trim().toLowerCase() === prodStr.toLowerCase()) || products.find(p => p.barcode && p.barcode.toString() === prodStr);

        const qty = Number(row['الكمية'] || row['العدد'] || row['quantity'] || 1) || 1;
        const itemTotal = Number(row['السعر'] || row['المبلغ'] || row['السعر الكلي'] || row['الاجمالي'] || row['totalAmount'] || row['price'] || 0);
        const unitPrice = qty > 0 ? itemTotal / qty : itemTotal;

        const rowDateVal = row['التاريخ'] || row['تاريخ الطلب'] || row['date'] || null;

        return {
          id: idx + 1,
          customerName: custName,
          customerPhone: custPhone,
          customerPhone2: custPhone2,
          governorate: gov,
          region: reg,
          notes: notes,
          productName: matchedProd ? matchedProd.name : prodStr,
          productId: matchedProd ? matchedProd.id : 'imported_' + Math.random().toString(36).substring(2, 9),
          matchedProd: matchedProd || null,
          quantity: qty,
          unitPrice: unitPrice,
          totalAmount: itemTotal,
          rawDate: rowDateVal
        };
      });

      setImportedRows(parsed);
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveImportedOrders = async () => {
    if (importedRows.length === 0) return;
    if (!selectedEmployeeId || !selectedBookingEmployeeId) {
      alert("يرجى اختيار موظف الإدخال وموظف الحجز من أعلى الصفحة أولاً!");
      return;
    }

    setIsImporting(true);
    try {
      const batch = writeBatch(db);
      const ordersColl = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders');
      const emp = employees.find(e => e.id === selectedEmployeeId);
      const bookingEmp = employees.find(e => e.id === selectedBookingEmployeeId);

      for (const row of importedRows) {
        const newRef = doc(ordersColl);
        
        let orderDate: any;
        if (!row.rawDate) {
          const todayStr = new Date().toISOString().split('T')[0];
          orderDate = customDate === todayStr ? serverTimestamp() : Timestamp.fromDate(new Date(customDate + 'T12:00:00'));
        } else if (typeof row.rawDate === 'number') {
          const date = new Date(Math.round((row.rawDate - 25569) * 86400 * 1000));
          orderDate = Timestamp.fromDate(date);
        } else {
          const d = new Date(row.rawDate);
          orderDate = !isNaN(d.getTime()) ? Timestamp.fromDate(d) : Timestamp.fromDate(new Date(customDate + 'T12:00:00'));
        }

        const orderData = {
          employeeId: selectedEmployeeId,
          employeeName: emp?.name || 'مجهول',
          bookingEmployeeId: selectedBookingEmployeeId,
          bookingEmployeeName: bookingEmp?.name || 'مجهول',
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          customerPhone2: row.customerPhone2 || '',
          governorate: row.governorate,
          region: row.region || '',
          notes: row.notes || 'تم الاستيراد من ملف إكسل',
          paymentMethod: 'كاش عند التوصيل',
          totalAmount: row.totalAmount,
          items: [{
            productId: row.productId,
            productName: row.productName,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            total: row.totalAmount,
            isComposite: row.matchedProd?.isComposite || false,
            composition: row.matchedProd?.composition || null
          }],
          date: orderDate,
          status: importStatus, // 'pending' or 'delivered'
          is_settled: false
        };

        batch.set(newRef, orderData);

        // Deduct stock if delivered and option checked
        if (importStatus === 'delivered' && importDeductStock && row.matchedProd && row.matchedProd.stock) {
          const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', row.matchedProd.id);
          const currentStock = { ...row.matchedProd.stock };
          let remainingQty = row.quantity;
          
          for (const storeId in currentStock) {
            if (remainingQty <= 0) break;
            const available = currentStock[storeId].quantity || 0;
            if (available > 0) {
              const deduct = Math.min(available, remainingQty);
              currentStock[storeId].quantity -= deduct;
              remainingQty -= deduct;
            }
          }
          batch.update(prodRef, { stock: currentStock });
        }
      }

      await batch.commit();
      alert(`تم استيراد وحفظ ${importedRows.length} طلب بنجاح! 🎉`);
      setShowExcelModal(false);
      setImportedRows([]);
    } catch (err) {
      console.error("Error importing orders:", err);
      alert("حدث خطأ أثناء استيراد الطلبات.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveQuickSale = async () => {
    if (!quickProdId) {
      alert("يرجى اختيار المنتج أو الصنف المباع أولاً.");
      return;
    }
    if (!selectedEmployeeId || !selectedBookingEmployeeId) {
      alert("يرجى اختيار موظف الإدخال وموظف الحجز من أعلى الصفحة أولاً.");
      return;
    }
    const qty = Number(quickQty) || 0;
    const total = parseFloat(quickTotalAmount) || 0;
    if (qty <= 0) {
      alert("يرجى إدخال عدد قطع صحيح أكبر من صفر.");
      return;
    }
    if (total < 0) {
      alert("يرجى إدخال مبلغ صحيح.");
      return;
    }

    setIsSavingQuick(true);
    try {
      const prod = products.find(p => p.id === quickProdId);
      if (!prod) {
        alert("المنتج غير موجود.");
        return;
      }

      const batch = writeBatch(db);
      const ordersColl = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders');
      const emp = employees.find(e => e.id === selectedEmployeeId);
      const bookingEmp = employees.find(e => e.id === selectedBookingEmployeeId);

      const todayStr = new Date().toISOString().split('T')[0];
      const orderDate = quickDate === todayStr ? serverTimestamp() : Timestamp.fromDate(new Date(quickDate + 'T12:00:00'));

      const unitPrice = qty > 0 ? total / qty : total;

      const newRef = doc(ordersColl);
      const orderData = {
        employeeId: selectedEmployeeId,
        employeeName: emp?.name || 'مجهول',
        bookingEmployeeId: selectedBookingEmployeeId,
        bookingEmployeeName: bookingEmp?.name || 'مجهول',
        customerName: 'مبيعات واصلة سريعة (فاتورة مجمعة)',
        customerPhone: '07000000000',
        customerPhone2: '',
        governorate: 'بغداد',
        region: 'مبيعات مباشر / مجمع',
        notes: `فاتورة مبيعات واصلة سريعة بدون تفاصيل زبائن - منتج: ${prod.name} (عدد ${qty} قطعة)`,
        paymentMethod: 'كاش عند التوصيل',
        totalAmount: total,
        items: [{
          productId: prod.id,
          productName: prod.name,
          quantity: qty,
          unitPrice: unitPrice,
          total: total,
          isComposite: (prod as any).isComposite || false,
          composition: (prod as any).composition || null
        }],
        date: orderDate,
        status: 'delivered',
        is_settled: quickSettleFinance,
        isQuickSale: true
      };

      batch.set(newRef, orderData);

      // Deduct stock if checked
      if (quickDeductStock && prod.stock) {
        const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', prod.id);
        const currentStock = { ...prod.stock };
        let remainingQty = qty;
        for (const storeId in currentStock) {
          if (remainingQty <= 0) break;
          const available = currentStock[storeId].quantity || 0;
          if (available > 0) {
            const deduct = Math.min(available, remainingQty);
            currentStock[storeId].quantity -= deduct;
            remainingQty -= deduct;
          }
        }
        batch.update(prodRef, { stock: currentStock });
      }

      await batch.commit();
      alert(`تم تسجيل وحفظ ${qty} قطعة من (${prod.name}) كمبيعات واصلة بنجاح! 🟢🎉`);
      setShowQuickSaleModal(false);
      setQuickQty(1);
      setQuickTotalAmount('');
      setQuickProdId('');
    } catch (err) {
      console.error("Error saving quick sale:", err);
      alert("حدث خطأ أثناء حفظ الفاتورة السريعة.");
    } finally {
      setIsSavingQuick(false);
    }
  };

  // Submit Logic with Batch Write
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    
    // Validation
    if (!selectedEmployeeId || !selectedBookingEmployeeId) {
      alert("يرجى اختيار الموظف مُدخل الطلب وموظف الحجز أولاً.");
      return;
    }

    if (
      formData.customerName.trim() === '' ||
      !isValidPhoneNumber(formData.customerPhone) ||
      formData.governorate.trim() === '' ||
      formData.region.trim() === ''
    ) {
      alert("يرجى التأكد من ملء جميع الحقول الإلزامية في بيانات الزبون.");
      return; 
    }

    if (cart.length === 0) {
      alert("سلة المشتريات فارغة!");
      return;
    }

    try {
      // 0. Generate Numeric Sequential ID
      const counterRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'metadata', 'orderCounter');
      const nextId = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let currentId = 100000; // Start numeric IDs from 100,000
        if (counterSnap.exists()) {
          currentId = counterSnap.data().lastId;
        }
        const newId = currentId + 1;
        transaction.set(counterRef, { lastId: newId }, { merge: true });
        return newId;
      });

      const batch = writeBatch(db);
      const newOrderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', nextId.toString());

      const emp = employees.find(e => e.id === selectedEmployeeId);
      const bookingEmp = employees.find(e => e.id === selectedBookingEmployeeId);

      let isOrderBackordered = false;

      // 1. Determine if order is backordered
      for (const item of cart) {
        const productData = item.product as any;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let totalAvailable = 0;
              Object.values(rawData.stock || {}).forEach((s: any) => {
                 const uMul = rawData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                 totalAvailable += ((Number(s.quantity) || 0) - (Number(s.reserved) || 0)) * uMul;
              });
              if (totalAvailable < component.quantityNeeded * item.quantity) {
                 isOrderBackordered = true;
              }
            }
          }
        } else {
           const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', item.product.id);
           const prodSnap = await getDoc(prodRef);
           if (prodSnap.exists()) {
              const prodData = prodSnap.data();
              let totalAvailable = 0;
              Object.values(prodData.stock || {}).forEach((s: any) => {
                 const uMul = prodData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                 totalAvailable += ((Number(s.quantity) || 0) - (Number(s.reserved) || 0)) * uMul;
              });
              if (totalAvailable < item.quantity) {
                 isOrderBackordered = true;
              }
           }
        }
      }

      // 2. Save Order Document
      const todayStr = new Date().toISOString().split('T')[0];
      const isToday = customDate === todayStr || !customDate;
      const orderDate = isToday ? serverTimestamp() : Timestamp.fromDate(new Date(customDate + 'T12:00:00'));

      const orderData = {
        employeeId: selectedEmployeeId,
        employeeName: emp?.name || 'مجهول',
        bookingEmployeeId: selectedBookingEmployeeId,
        bookingEmployeeName: bookingEmp?.name || 'مجهول',
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerPhone2: formData.customerPhone2,
        governorate: formData.governorate,
        region: formData.region,
        notes: formData.notes,
        paymentMethod: formData.paymentMethod,
        fbLoginId: formData.fbLoginId,
        totalAmount: totalAmount,
        items: cart.map(item => {
          const p = item.product as any;
          return {
            productId: item.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            isComposite: p.isComposite || false,
            composition: p.composition || null
          };
        }),
        date: serverTimestamp(),
        status: isOrderBackordered ? 'backordered' : 'pending',

        is_settled: false
      };

      batch.set(newOrderRef, orderData);

      // 3. Reserve Stock for Products
      for (const item of cart) {
        const productData = item.product as any;

        // --- Handle Composite Products (BOM) ---
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let stock = { ...rawData.stock };
              let remainingToReserve = component.quantityNeeded * item.quantity;
              
              const firstStoreKey = Object.keys(stock)[0] || 'default_store';
              if (!stock[firstStoreKey]) {
                 stock[firstStoreKey] = { quantity: 0, reserved: remainingToReserve, unit: rawData.units?.[0]?.type || 'قطعة' };
              } else {
                 stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + remainingToReserve;
              }

              batch.update(rawProdRef, { stock });
            }
          }
        } 
        // --- Handle Regular Products ---
        else {
          const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', item.product.id);
          const prodSnap = await getDoc(prodRef);
          
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let stock = { ...prodData.stock };
            let remainingToReserve = item.quantity;

            const firstStoreKey = Object.keys(stock)[0] || 'default_store';
            if (!stock[firstStoreKey]) {
               stock[firstStoreKey] = { quantity: 0, reserved: remainingToReserve, unit: prodData.units?.[0]?.type || 'قطعة' };
            } else {
               stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + remainingToReserve;
            }

            batch.update(prodRef, { stock });
          }
        }
      }

      // Commit Batch
      await batch.commit();

      // --- Trigger Meta & TikTok Pixels for each item in the order ---
      try {
        const baseUrl = window.location.origin;
        const orderId = newOrderRef.id;
        for (const item of cart) {
          const pixelPayload = {
            orderId: orderId,
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            value: item.unitPrice * item.quantity,
            currency: 'IQD',
            email: '',
            phone: formData.customerPhone,
            firstName: formData.customerName,
            state: formData.governorate,
            userId: auth.currentUser?.uid || 'anonymous',
            client_ip: '127.0.0.1',
            user_agent: window.navigator.userAgent,
            event_source_url: window.location.href
          };

          // Trigger Meta Pixel
          fetch(`${baseUrl}/api/webhooks/meta-purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pixelPayload)
          }).catch(e => console.error("Meta API error:", e));

          // Trigger TikTok Pixel
          fetch(`${baseUrl}/api/webhooks/tiktok-purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pixelPayload)
          }).catch(e => console.error("TikTok API error:", e));
        }
      } catch (pixelErr) {
        console.error("Failed to trigger Pixels:", pixelErr);
      }

      setNotificationModal({ show: true, message: 'تم حفظ الطلب وتحديث المخزون بنجاح!' });
      
      // Reset State
      setHasAttemptedSubmit(false);
      setFormData({
        customerName: '', 
        customerPhone: '', 
        customerPhone2: '', 
        governorate: '', 
        region: '', 
        notes: '',
        paymentMethod: 'كاش عند التوصيل',
        fbLoginId: ''
      });
      setCart([]);
      setSearchQuery('');
      
    } catch (error) {
      console.error("Error creating order: ", error);
      alert("حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى.");
    }
  };

  return (
    <div className={styles.container}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'rgba(15, 23, 42, 0.8)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', fontWeight: 'bold' }}>✍️ إدخال الطلبات والمبيعات</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>اختر بين الإدخال الفردي المفصل للزبائن، أو تسجيل المبيعات الواصلة السريعة دفعة واحدة</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={() => setShowQuickSaleModal(true)}
            style={{ padding: '0.7rem 1.25rem', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.35)', fontSize: '0.95rem' }}
          >
            <span>⚡ مبيعات واصلة سريعة (بدون أسماء)</span>
          </button>
          <button 
            type="button"
            onClick={() => setShowExcelModal(true)}
            style={{ padding: '0.7rem 1.1rem', background: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', fontWeight: 'bold', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}
          >
            <span>📥 استيراد Excel</span>
          </button>
        </div>
      </div>

      <div className={styles.contentWrapper}>
      <div className={styles.mainLayout}>
        <div className={`${styles.formSection} ${hasGlobalError ? styles.formWrapperError : ''}`}>
          <form onSubmit={handleSubmit}>
          
          {/* Compact Integrated Date Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 'bold' }}>📅 تاريخ تسجيل الطلب (لإحصائيات الأيام السابقة):</span>
              <input 
                type="date"
                className={styles.input}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={{ width: 'auto', padding: '0.35rem 0.7rem', borderColor: customDate === new Date().toISOString().split('T')[0] ? 'rgba(255,255,255,0.15)' : '#10b981', background: 'rgba(0,0,0,0.4)', color: customDate === new Date().toISOString().split('T')[0] ? '#fff' : '#10b981', fontWeight: 'bold', borderRadius: '6px', fontSize: '0.85rem' }}
              />
              {customDate !== new Date().toISOString().split('T')[0] && (
                <span style={{ color: '#fbbf24', fontSize: '0.8rem', background: 'rgba(251, 191, 36, 0.15)', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                  ⚠️ أثر رجعي ({customDate})
                </span>
              )}
            </div>
            {customDate !== new Date().toISOString().split('T')[0] && (
              <button 
                type="button"
                onClick={() => setCustomDate(new Date().toISOString().split('T')[0])}
                style={{ padding: '0.35rem 0.75rem', background: '#10b981', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                تاريخ اليوم 🟢
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(139, 92, 246, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <div className={styles.formGroup} style={{ flex: 1, marginBottom: 0 }}>
              <label className={styles.label} style={{ color: '#c4b5fd' }}>مُدخل الطلب (عنده النظام) *</label>
              <select 
                className={styles.input}
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  localStorage.setItem('selectedEmployeeId', e.target.value);
                }}
                required
              >
                <option value="">-- اختر موظف الإدخال --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup} style={{ flex: 1, marginBottom: 0 }}>
              <label className={styles.label} style={{ color: '#60a5fa' }}>موظف الحجز (منزل الطلب) *</label>
              <select 
                className={styles.input}
                value={selectedBookingEmployeeId}
                onChange={(e) => {
                  setSelectedBookingEmployeeId(e.target.value);
                  localStorage.setItem('selectedBookingEmployeeId', e.target.value);
                }}
                required
              >
                <option value="">-- اختر موظف الحجز --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>اسم الزبون</label>
            <input 
              id="customerName"
              type="text" 
              name="customerName"
              className={getInputClass('customerName')}
              value={formData.customerName}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDownForm(e, 'customerPhone')}
              autoComplete="off"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>هاتف الزبون</label>
            <div className={styles.searchableSelectContainer}>
              <div className={styles.inputWrapper}>
                <input 
                  id="customerPhone"
                  type="text" 
                  name="customerPhone"
                  className={getInputClass('customerPhone')} 
                  value={formData.customerPhone}
                  onChange={handleChange}
                  onFocus={() => setShowPhoneDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPhoneDropdown(false), 200)}
                  onKeyDown={(e) => handleKeyDownForm(e, 'customerPhone2')}
                  autoComplete="off"
                />
                {isPhoneInvalid && (
                  <span className={styles.errorMessage}>يجب أن يتكون رقم الهاتف من 10 إلى 15 رقماً</span>
                )}
              </div>
              {showPhoneDropdown && formData.customerPhone.trim().length >= 10 && filteredCustomersByPhone.length > 0 && (
                <ul className={styles.dropdownList}>
                  {filteredCustomersByPhone.length > 0 ? (
                    filteredCustomersByPhone.map((customer: any) => (
                    <li 
                      key={customer.id} 
                      className={styles.dropdownItem}
                      onPointerDown={(e) => { e.preventDefault(); handleSelectCustomer(customer); }}
                    >
                      <div className={styles.customerRow}>
                        <div className={styles.customerMain}>
                          <span className={styles.custName}>{customer.name}</span>
                          <span className={styles.custPhone}>{customer.phone}</span>
                        </div>
                        <div className={styles.customerBadges}>
                          {customer.source === 'customer' ? (
                            <span className={`${styles.sourceBadge} ${styles.badgeRecord}`}>سجل</span>
                          ) : (
                            <span className={`${styles.sourceBadge} ${styles.badgeOrder}`}>أرشيف</span>
                          )}
                          {customer.tag && <span className={styles.custTag}>({customer.tag})</span>}
                        </div>
                      </div>
                    </li>
                    ))
                  ) : (
                    <li className={styles.dropdownItem} style={{ color: 'var(--text-muted)' }}>لا توجد نتائج مطابقة في سجل العملاء</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>رقم هاتف ثاني للزبون (اختياري)</label>
            <input 
              id="customerPhone2"
              type="text" 
              name="customerPhone2"
              className={styles.input} 
              value={formData.customerPhone2}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDownForm(e, 'governorate')}
              placeholder="أدخل الهاتف الثاني إذا توفر..."
              autoComplete="off"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>المحافظة</label>
            <div className={styles.searchableSelectContainer}>
              <input 
                id="governorate"
                type="text" 
                name="governorate"
                className={getInputClass('governorate')} 
                value={formData.governorate}
                onChange={(e) => {
                  handleChange(e);
                  setShowGovDropdown(true);
                }}
                onFocus={() => setShowGovDropdown(true)}
                onBlur={() => setTimeout(() => setShowGovDropdown(false), 200)}
                onKeyDown={(e) => handleKeyDownForm(e, 'region')}
                placeholder="اختر المحافظة أو اكتب للبحث"
                autoComplete="off"
              />
              <span className={styles.selectArrow}>▼</span>
              
              {showGovDropdown && (
                <ul className={styles.dropdownList}>
                  {governoratesList
                    .filter(gov => gov.includes(formData.governorate))
                    .map((gov, index) => (
                      <li 
                        key={index} 
                        className={styles.dropdownItem}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          setFormData(prev => ({ ...prev, governorate: gov }));
                          setShowGovDropdown(false);
                        }}
                      >
                        {gov}
                      </li>
                    ))}
                  {governoratesList.filter(gov => gov.includes(formData.governorate)).length === 0 && (
                    <li className={styles.dropdownItem} style={{ color: 'var(--text-muted)' }}>لا توجد نتائج مطابقة</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>المنطقة</label>
            <input 
              id="region"
              type="text" 
              name="region"
              className={getInputClass('region')} 
              value={formData.region}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDownForm(e, 'notes')}
            />
          </div>

          {/* Editable Total Amount */}
          <div className={styles.formGroup}>
            <label className={styles.label}>المبلغ الكلي (دينار)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <input 
                type="text" 
                inputMode="numeric"
                dir="ltr"
                className={styles.input} 
                style={{ border: 'none', background: 'transparent', flex: 1, color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'right', fontFamily: 'system-ui, sans-serif' }}
                value={manualTotal !== '' ? new Intl.NumberFormat('en-US').format(Number(manualTotal)) : new Intl.NumberFormat('en-US').format(calculatedTotal)}
                onChange={(e) => {
                  const val = e.target.value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                  const numericVal = val.replace(/[^0-9]/g, '');
                  setManualTotal(numericVal);
                }}
                placeholder="تلقائي..."
              />
              <span style={{ color: '#10b981', fontWeight: 'bold', padding: '0 1rem' }}>د.ع</span>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>طريقة الدفع</label>
            <select 
              name="paymentMethod"
              className={styles.input}
              value={formData.paymentMethod}
              onChange={handleChange}
            >
              <option value="كاش عند التوصيل">كاش عند التوصيل</option>
              <option value="حوالة زين كاش">حوالة زين كاش</option>
              <option value="حوالة بنكية">حوالة بنكية</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelWithAction}>
              <label className={styles.label}>ملاحظات الطلب</label>
              <button 
                type="button" 
                className={styles.replaceBtn}
                onClick={handleAddReplaceNote}
              >
                🔄 استبدال
              </button>
            </div>
            <textarea 
              id="notes"
              name="notes"
              className={styles.textarea} 
              value={formData.notes}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div className={styles.submitBtnContainer}>
            <button type="submit" className={styles.submitBtn}>
              حفظ الطلب
            </button>
            <Link href="/orders/list" className={styles.secondaryBtn}>
              جميع الطلبات
            </Link>
          </div>

          </form>
        </div>

        {/* Customer Info Card (Left of the form) */}
        {customerHistory && (
          <div className={styles.customerInfoCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>👤</span>
              <h3>معلومات الزبون</h3>
            </div>
            
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)' }}>📦</span>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>إجمالي الطلبات</span>
                  <span className={styles.statValue}>{customerHistory.count}</span>
                </div>
              </div>

              <div className={styles.statItem}>
                <span className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)' }}>✅</span>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>ناجحة</span>
                  <span className={`${styles.statValue} ${styles.successText}`}>{customerHistory.deliveredCount}</span>
                </div>
              </div>
              
              <div className={styles.statItem}>
                <span className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.1)' }}>❌</span>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>راجعة</span>
                  <span className={`${styles.statValue} ${styles.failText}`}>{customerHistory.returns}</span>
                </div>
              </div>

              <div className={styles.statItem}>
                <span className={styles.statIcon} style={{ background: 'rgba(251, 191, 36, 0.1)' }}>📈</span>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>نسبة الاستلام</span>
                  <span className={styles.statValue} style={{ color: '#fbbf24' }}>
                    {customerHistory.count > 0 
                      ? Math.round((customerHistory.deliveredCount / customerHistory.count) * 100) 
                      : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.totalSpentSection}>
               <span className={styles.statLabel}>إجمالي الإنفاق (المستلم)</span>
               <span className={styles.totalSpentValue}>{new Intl.NumberFormat('en-US').format(customerHistory.totalSpent)} د.ع</span>
            </div>

            {customerHistory.returns > 0 && (
              <div className={styles.returnWarning}>
                <span className={styles.warningIcon}>⚠️</span>
                <span>تحذير: لديه {customerHistory.returns} طلبات مرتجعة سابقاً!</span>
              </div>
            )}

            {customerHistory.lastProfile && (
              <div className={styles.autoFillPrompt}>
                <p>هل تود تعبئة البيانات تلقائياً؟</p>
                <button 
                  type="button" 
                  className={styles.autoFillBtn}
                  onClick={applyHistoricalData}
                >
                  نعم، تعبئة الآن ✨
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LEFT COLUMN: CART (POS UI) */}
      <div className={styles.cartSection}>
        <div className={styles.cartHeaderContainer}>
          <div className={styles.cartTitleBg}>سلة الزبون</div>
        </div>

        <div className={styles.productSearchContainer}>
          <input 
            type="text" 
            ref={searchInputRef}
            className={styles.productSearchInput}
            placeholder="ابحث عن صنف أو امسح الباركود..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
          />
          <span className={styles.searchIcon}>🔍</span>

          {showProductDropdown && searchQuery && (
            <ul className={styles.dropdownList} style={{ top: 'calc(100% - 1.5rem)', left: '1.5rem', right: '1.5rem' }}>
              {filteredProducts.map(p => (
                <li key={p.id} className={styles.dropdownItem} onPointerDown={(e) => { e.preventDefault(); addToCart(p); }}>
                  <strong>{p.name}</strong> {p.barcode && <small style={{color: 'var(--text-muted)'}}>({p.barcode})</small>}
                </li>
              ))}
              {filteredProducts.length === 0 && (
                <li className={styles.dropdownItem} style={{ color: 'var(--text-muted)' }}>لا توجد منتجات مطابقة</li>
              )}
            </ul>
          )}
        </div>

        <div className={styles.cartItemsContainer}>
          {cart.length > 0 ? (
            <table className={styles.cartTable}>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>السعر المفرد</th>
                  <th>الإجمالي</th>
                  <th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold' }}>{item.product.name}</td>
                    <td>
                      <div className={styles.qtyControl}>
                        <button type="button" className={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                        <input 
                          type="number" 
                          className={styles.qtyInput} 
                          value={item.quantity} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            updateQuantity(item.id, val);
                          }}
                        />
                        <button type="button" className={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                      </div>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className={styles.priceInput} 
                        value={new Intl.NumberFormat('en-US').format(item.unitPrice)} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                          updateUnitPrice(item.id, val);
                        }}
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className={styles.priceInput} 
                        value={`${new Intl.NumberFormat('en-US').format(item.quantity * item.unitPrice)} د.ع`} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/,/g, '').replace(' د.ع', '')) || 0;
                          updateItemTotal(item.id, val);
                        }}
                        style={{ color: '#10B981', fontWeight: 'bold' }}
                      />
                    </td>
                    <td>
                      <button type="button" className={styles.deleteBtn} onClick={() => removeFromCart(item.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyCart}>
              <div className={styles.emptyCartIcon}>🛒</div>
              <p>السلة فارغة. ابحث عن أصناف لإضافتها.</p>
            </div>
          )}
        </div>
      </div>
      </div>

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

      {showExcelModal && (
        <div className={styles.modalOverlay} style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '16px', width: '90%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📥 استيراد طلبات من ملف Excel دفعة واحدة</span>
              </h2>
              <button 
                type="button"
                onClick={() => { setShowExcelModal(false); setImportedRows([]); }}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              
              {/* Instructions and File Input */}
              <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px dashed rgba(139, 92, 246, 0.4)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                <p style={{ margin: '0 0 1rem 0', color: '#c4b5fd', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  يرجى التأكد من اختيار موظف الإدخال وموظف الحجز من أعلى الصفحة أولاً. <br />
                  يمكن أن يحتوي شيت الإكسل على أعمدة مثل: (اسم الزبون، هاتف الزبون، المحافظة، المنطقة، المنتج، الكمية، السعر، التاريخ).
                </p>
                <label style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: '#fff', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}>
                  <span>📂 اختر ملف Excel (.xlsx / .xls / .csv)</span>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {/* Status & Options Selection */}
              {importedRows.length > 0 && (
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <label style={{ display: 'block', color: '#10b981', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.95rem' }}>
                      🎯 حالة الطلبات المستوردة عند الحفظ:
                    </label>
                    <select 
                      value={importStatus}
                      onChange={(e) => setImportStatus(e.target.value)}
                      style={{ padding: '0.6rem 1rem', background: '#0f172a', color: '#fff', border: '1px solid #10b981', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem' }}
                    >
                      <option value="pending">⏳ قيد الانتظار (طلب جديد عادي)</option>
                      <option value="delivered">🟢 واصل ومكتمل (طلبات قديمة واصلة)</option>
                    </select>
                  </div>

                  {importStatus === 'delivered' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', background: 'rgba(0,0,0,0.3)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <input 
                        type="checkbox" 
                        checked={importDeductStock} 
                        onChange={(e) => setImportDeductStock(e.target.checked)} 
                        style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                      />
                      <span>☑ خصم كميات المنتجات المباعة من رصيد المخزون تلقائياً</span>
                    </label>
                  )}
                </div>
              )}

              {/* Preview Table */}
              {importedRows.length > 0 ? (
                <div>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>👀 معاينة الطلبات المستخرجة من الملف ({importedRows.length} طلب):</span>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'normal' }}>تأكد من مطابقة أسماء المنتجات مع المخزن</span>
                  </h3>
                  <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem', color: '#e2e8f0' }}>
                      <thead style={{ background: 'rgba(255, 255, 255, 0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                          <th style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>#</th>
                          <th style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>الزبون</th>
                          <th style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>الهاتف</th>
                          <th style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>المحافظة / المنطقة</th>
                          <th style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>المنتج بالمخزن</th>
                          <th style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>الكمية</th>
                          <th style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>المبلغ الكلي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importedRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '8px 10px' }}>{r.id}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{r.customerName}</td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.customerPhone}</td>
                            <td style={{ padding: '8px 10px' }}>{r.governorate} {r.region && `- ${r.region}`}</td>
                            <td style={{ padding: '8px 10px' }}>
                              {r.matchedProd ? (
                                <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '3px 8px', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold' }}>
                                  ✔ {r.matchedProd.name}
                                </span>
                              ) : (
                                <span style={{ color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', padding: '3px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                  ⚠️ {r.productName} (غير مدرج)
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{r.quantity}</td>
                            <td style={{ padding: '8px 10px', color: '#38bdf8', fontWeight: 'bold' }}>{new Intl.NumberFormat('en-US').format(r.totalAmount)} د.ع</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                  <p style={{ margin: 0 }}>لم يتم اختيار ملف بعد. اختر ملف Excel لعرض ومعاينة الطلبات هنا.</p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)' }}>
              <button 
                type="button"
                onClick={() => { setShowExcelModal(false); setImportedRows([]); }}
                style={{ padding: '0.75rem 1.5rem', background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                إلغاء
              </button>
              <button 
                type="button"
                disabled={importedRows.length === 0 || isImporting}
                onClick={handleSaveImportedOrders}
                style={{ padding: '0.75rem 2rem', background: importedRows.length === 0 ? '#475569' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: importedRows.length === 0 ? 'not-allowed' : 'pointer', boxShadow: importedRows.length > 0 ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none' }}
              >
                {isImporting ? '⏳ جاري حفظ الطلبات...' : `🚀 تأكيد وحفظ (${importedRows.length}) طلب`}
              </button>
            </div>

          </div>
        </div>
      )}

      {showQuickSaleModal && (
        <div className={styles.modalOverlay} style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '16px', width: '90%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)' }}>
              <h2 style={{ margin: 0, color: '#f59e0b', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                <span>⚡ تسجيل مبيعات واصلة سريعة (فاتورة مجمعة)</span>
              </h2>
              <button 
                type="button"
                onClick={() => setShowQuickSaleModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'right' }}>
              
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px dashed rgba(245, 158, 11, 0.4)', borderRadius: '10px', padding: '1rem', color: '#fde68a', fontSize: '0.9rem', lineHeight: '1.6' }}>
                💡 <strong>هذه الميزة مخصصة للسرعة والراحة:</strong> تُسجل الطلبات القديمة الواصلة دفعة واحدة لضبط جرد المخزن، وأرباح الفئة والبيج، ورصيد الخزينة <strong>بدون إدخال أسماء الزبائن أو عناوينهم نهائياً!</strong>
              </div>

              {/* Date & Product Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.9rem' }}>
                    📅 تاريخ المبيعات القديم:
                  </label>
                  <input 
                    type="date"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    style={{ width: '100%', padding: '0.7rem 1rem', background: '#1e293b', color: '#fff', border: '1px solid #f59e0b', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.9rem' }}>
                    📦 المنتج أو الصنف المباع *:
                  </label>
                  <select 
                    value={quickProdId}
                    onChange={(e) => setQuickProdId(e.target.value)}
                    style={{ width: '100%', padding: '0.7rem 1rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem' }}
                  >
                    <option value="">-- اختر المنتج من المخزن --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.stock ? `(المتوفر: ${Object.values(p.stock).reduce((s: number, st: any) => s + (st.quantity || 0), 0)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity & Total Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.9rem' }}>
                    🔢 العدد الكلي المباع والواصل *:
                  </label>
                  <input 
                    type="number"
                    min="1"
                    value={quickQty}
                    onChange={(e) => setQuickQty(parseInt(e.target.value) || 0)}
                    placeholder="مثال: 15"
                    style={{ width: '100%', padding: '0.7rem 1rem', background: '#1e293b', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.9rem' }}>
                    💰 المبلغ الإجمالي المستلم (دينار) *:
                  </label>
                  <input 
                    type="text"
                    value={quickTotalAmount}
                    onChange={(e) => setQuickTotalAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="مثال: 450000"
                    style={{ width: '100%', padding: '0.7rem 1rem', background: '#1e293b', color: '#10b981', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center' }}
                  />
                  {quickTotalAmount && (
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', textAlign: 'left' }}>
                      ({new Intl.NumberFormat('en-US').format(Number(quickTotalAmount))} د.ع)
                    </div>
                  )}
                </div>
              </div>

              {/* Automation Options */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={quickDeductStock} 
                    onChange={(e) => setQuickDeductStock(e.target.checked)} 
                    style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                  <span>☑ خصم العدد المباع ({quickQty} قطعة) من رصيد المخزن تلقائياً</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={quickSettleFinance} 
                    onChange={(e) => setQuickSettleFinance(e.target.checked)} 
                    style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                  <span>☑ تسديد الحساب مالياً وإيداع المبلغ في صندوق الخزينة مباشرة</span>
                </label>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)' }}>
              <button 
                type="button"
                onClick={() => setShowQuickSaleModal(false)}
                style={{ padding: '0.75rem 1.5rem', background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                إلغاء
              </button>
              <button 
                type="button"
                disabled={!quickProdId || isSavingQuick}
                onClick={handleSaveQuickSale}
                style={{ padding: '0.75rem 2rem', background: !quickProdId ? '#475569' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: !quickProdId ? 'not-allowed' : 'pointer', boxShadow: quickProdId ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isSavingQuick ? '⏳ جاري التسجيل...' : `🚀 اعتماد وحفظ المبيعات الواصلة 🟢`}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
