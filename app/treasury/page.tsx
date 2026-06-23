"use client";

import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, writeBatch, doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
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
  isSettlementArchived?: boolean;
  paidAmount?: number;
}

interface GroupedStatement {
  id: string;
  isStatement: boolean;
  settlementStatementId: string;
  settledWalletName: string;
  settlementAgent: string;
  settlementNotes: string;
  settlementImages: string[];
  totalAmount: number;
  addDate: string;
  addTime: string;
  date: any;
  orders: Order[];
  isSettlementArchived: boolean;
}

function groupOrders(ordersList: Order[]): GroupedStatement[] {
  const groupsMap = new Map<string, GroupedStatement>();
  const individualStatements: GroupedStatement[] = [];

  ordersList.forEach(order => {
    const stmtId = order.settlementStatementId?.trim();
    if (stmtId) {
      if (groupsMap.has(stmtId)) {
        const group = groupsMap.get(stmtId)!;
        group.orders.push(order);
        group.totalAmount += order.totalAmount;
        const orderTime = order.date?.toMillis ? order.date.toMillis() : (order.date ? new Date(order.date).getTime() : 0);
        const groupTime = group.date?.toMillis ? group.date.toMillis() : (group.date ? new Date(group.date).getTime() : 0);
        if (orderTime > groupTime) {
          group.date = order.date;
          group.addDate = order.addDate || '---';
          group.addTime = order.addTime || '---';
        }
        if (order.settlementImages) {
          order.settlementImages.forEach(img => {
            if (!group.settlementImages.includes(img)) {
              group.settlementImages.push(img);
            }
          });
        }
        if (order.settlementNotes && !group.settlementNotes.includes(order.settlementNotes)) {
          group.settlementNotes = group.settlementNotes
            ? `${group.settlementNotes}\n${order.settlementNotes}`
            : order.settlementNotes;
        }
      } else {
        groupsMap.set(stmtId, {
          id: stmtId,
          isStatement: true,
          settlementStatementId: stmtId,
          settledWalletName: order.settledWalletName || 'غير محددة',
          settlementAgent: order.settlementAgent || '---',
          settlementNotes: order.settlementNotes || '',
          settlementImages: [...(order.settlementImages || [])],
          totalAmount: order.totalAmount,
          addDate: order.addDate || '---',
          addTime: order.addTime || '---',
          date: order.date,
          orders: [order],
          isSettlementArchived: order.isSettlementArchived || false
        });
      }
    } else {
      individualStatements.push({
        id: order.id,
        isStatement: false,
        settlementStatementId: '',
        settledWalletName: order.settledWalletName || 'غير محددة',
        settlementAgent: order.settlementAgent || '---',
        settlementNotes: order.settlementNotes || '',
        settlementImages: [...(order.settlementImages || [])],
        totalAmount: order.totalAmount,
        addDate: order.addDate || '---',
        addTime: order.addTime || '---',
        date: order.date,
        orders: [order],
        isSettlementArchived: order.isSettlementArchived || false
      });
    }
  });

  const result = [...Array.from(groupsMap.values()), ...individualStatements];
  
  result.sort((a, b) => {
    const tA = a.date?.toMillis ? a.date.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
    const tB = b.date?.toMillis ? b.date.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
    return tB - tA;
  });

  return result;
}

interface Wallet {
  id: string;
  name: string;
}

interface ShippingCompany {
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
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<GroupedStatement | null>(null);
  const [settledOrders, setSettledOrders] = useState<Order[]>([]);
  const [archivedSettlements, setArchivedSettlements] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'settled' | 'archived'>('pending');

  const settledGroups = React.useMemo(() => {
    return groupOrders(settledOrders);
  }, [settledOrders]);

  const archivedGroups = React.useMemo(() => {
    return groupOrders(archivedSettlements);
  }, [archivedSettlements]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showSelectedOrdersList, setShowSelectedOrdersList] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showBulkSelectModal, setShowBulkSelectModal] = useState(false);
  const [bulkSelectText, setBulkSelectText] = useState('');
  const [bulkSettlementAmounts, setBulkSettlementAmounts] = useState<Record<string, number>>({});

  // Phase 2 Form States
  const [externalStatementId, setExternalStatementId] = useState('');
  const [deliveryAgent, setDeliveryAgent] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // File Input Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch wallets list and shipping companies
  useEffect(() => {
    const unsubWallets = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'wallets'), (snapshot) => {
      setWallets(snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
      })));
    });

    const unsubCompanies = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'shipping_companies'), (snapshot) => {
      setShippingCompanies(snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
      })));
    });

    return () => {
      unsubWallets();
      unsubCompanies();
    };
  }, []);

  // Listen to outside clicks to close the Actions dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target as Node)) {
        setShowActionsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    // Fetch all orders for real-time calculations and filter delivered ones
    const q = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let actual = 0;
      let pending = 0;
      const pendingList: Order[] = [];
      const settledList: Order[] = [];
      const archivedList: Order[] = [];

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
            settlementImages: data.settlementImages || [],
            isSettlementArchived: data.isSettlementArchived || false,
            paidAmount: Number(data.paidAmount) || 0
          };

          if (isSettled) {
            actual += amount;
            if (data.isSettlementArchived === true) {
              archivedList.push(orderObj);
            } else {
              settledList.push(orderObj);
            }
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

      // Sort archived list by date descending (newest first)
      archivedList.sort((a, b) => {
        const tA = a.date?.toMillis ? a.date.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
        const tB = b.date?.toMillis ? b.date.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
        return tB - tA;
      });

      setActualBalance(actual);
      setPendingBalance(pending);
      setPendingOrders(pendingList);
      setSettledOrders(settledList);
      setArchivedSettlements(archivedList);
      
      // Remove any selected items that are no longer in the active lists
      setSelectedOrders((prev) => {
        const next = new Set(prev);
        for (const id of next) {
          const existsInPending = pendingList.some(o => o.id === id);
          const existsInSettled = groupOrders(settledList).some(g => g.id === id);
          const existsInArchived = groupOrders(archivedList).some(g => g.id === id);
          if (!existsInPending && !existsInSettled && !existsInArchived) {
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
      if (activeTab === 'pending') {
        setSelectedOrders(new Set(pendingOrders.map(o => o.id)));
      } else if (activeTab === 'settled') {
        setSelectedOrders(new Set(settledGroups.map(o => o.id)));
      } else if (activeTab === 'archived') {
        setSelectedOrders(new Set(archivedGroups.map(o => o.id)));
      }
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
      let totalAmountToDeposit = 0;

      selectedOrders.forEach(orderId => {
        const order = pendingOrders.find(o => o.id === orderId);
        if (order) {
          const remainingAmount = order.totalAmount - (order.paidAmount || 0);
          const inputAmount = bulkSettlementAmounts[orderId];
          const receivedAmount = inputAmount !== undefined ? inputAmount : remainingAmount;
          
          const newPaidAmount = (order.paidAmount || 0) + receivedAmount;
          totalAmountToDeposit += receivedAmount;

          const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
          
          const isFullySettled = newPaidAmount >= order.totalAmount;
          
          batch.update(orderRef, {
            is_settled: isFullySettled,
            paymentStatus: isFullySettled ? 'settled' : 'partially_settled',
            paidAmount: newPaidAmount,
            settledWalletId: selectedWallet.id,
            settledWalletName: selectedWallet.name,
            settledAt: serverTimestamp(),
            settlementStatementId: externalStatementId || '',
            settlementAgent: deliveryAgent || '',
            settlementNotes: settlementNotes || '',
            settlementImages: uploadedImages.map(img => img.dataUrl)
          });
        }
      });

      // Create a deposit transaction record in treasury_transactions
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toISOString().split('T')[0];

      const transactionRef = doc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions'));
      batch.set(transactionRef, {
        type: 'deposit',
        amount: totalAmountToDeposit,
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
      setBulkSettlementAmounts({});
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

  const handleArchiveSettlement = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
      await updateDoc(orderRef, { isSettlementArchived: true });
    } catch (error) {
      console.error("Error archiving settlement:", error);
      alert("حدث خطأ أثناء أرشفة التسوية.");
    }
  };

  const handleRestoreSettlement = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
      await updateDoc(orderRef, { isSettlementArchived: false });
    } catch (error) {
      console.error("Error restoring settlement:", error);
      alert("حدث خطأ أثناء استعادة التسوية.");
    }
  };

  const handleDeleteSettlement = async (orderId: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الطلب بشكل نهائي من النظام؟")) {
      try {
        const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
        await deleteDoc(orderRef);
      } catch (error) {
        console.error("Error deleting order:", error);
        alert("حدث خطأ أثناء حذف الطلب.");
      }
    }
  };

  const handleArchiveGroup = async (group: GroupedStatement) => {
    try {
      const batch = writeBatch(db);
      group.orders.forEach(order => {
        batch.update(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id), { isSettlementArchived: true });
      });
      await batch.commit();
      if (selectedStatement?.id === group.id) {
        setSelectedStatement(null);
      }
    } catch (error) {
      console.error("Error archiving group:", error);
      alert("حدث خطأ أثناء أرشفة الكشف.");
    }
  };

  const handleRestoreGroup = async (group: GroupedStatement) => {
    try {
      const batch = writeBatch(db);
      group.orders.forEach(order => {
        batch.update(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id), { isSettlementArchived: false });
      });
      await batch.commit();
      if (selectedStatement?.id === group.id) {
        setSelectedStatement(null);
      }
    } catch (error) {
      console.error("Error restoring group:", error);
      alert("حدث خطأ أثناء استعادة الكشف.");
    }
  };

  const handleDeleteGroup = async (group: GroupedStatement) => {
    const message = group.isStatement 
      ? `هل أنت متأكد من حذف هذا الكشف (#${group.settlementStatementId}) وجميع الطلبات المرتبطة به (${group.orders.length} طلب) بشكل نهائي من النظام؟`
      : `هل أنت متأكد من حذف هذا الطلب بشكل نهائي من النظام؟`;
      
    if (confirm(message)) {
      try {
        const batch = writeBatch(db);
        group.orders.forEach(order => {
          batch.delete(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id));
        });
        await batch.commit();
        if (selectedStatement?.id === group.id) {
          setSelectedStatement(null);
        }
      } catch (error) {
        console.error("Error deleting group:", error);
        alert("حدث خطأ أثناء حذف الكشف.");
      }
    }
  };

  const totalSelectedAmount = Array.from(selectedOrders).reduce((sum, orderId) => {
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return sum;
    const remainingAmount = order.totalAmount - (order.paidAmount || 0);
    const inputAmount = bulkSettlementAmounts[orderId];
    return sum + (inputAmount !== undefined ? inputAmount : remainingAmount);
  }, 0);

  const handleBulkSelect = () => {
    const lines = bulkSelectText.split('\n').filter(l => l.trim().length > 0);
    const newSelected = new Set<string>(selectedOrders);
    const newAmounts: Record<string, number> = { ...bulkSettlementAmounts };
    let notFound: string[] = [];
    let addedCount = 0;

    lines.forEach(line => {
      const parts = line.trim().split(/[\t\s]+/);
      const identifier = parts[0];
      const amountStr = parts.length > 1 ? parts[parts.length - 1] : null;

      const order = pendingOrders.find(o => 
        o.id === identifier || 
        o.id.endsWith(identifier) || 
        (o as any).orderNumber === identifier || 
        (o as any).shipmentNumber === identifier
      );

      if (order) {
        newSelected.add(order.id);
        addedCount++;
        if (amountStr) {
          const parsedAmount = parseFloat(amountStr.replace(/,/g, ''));
          if (!isNaN(parsedAmount)) {
            newAmounts[order.id] = parsedAmount;
          }
        }
      } else {
        notFound.push(identifier);
      }
    });

    setSelectedOrders(newSelected);
    setBulkSettlementAmounts(newAmounts);
    setShowBulkSelectModal(false);
    setBulkSelectText('');
    
    if (notFound.length > 0) {
      alert(`تم إضافة ${addedCount} طلب بنجاح.\nلم يتم العثور على المعرفات التالية في قائمة الطلبات المعلقة:\n${notFound.join(', ')}`);
    } else {
      alert(`تم إضافة ${addedCount} طلب بنجاح.`);
    }
  };

  // Filter pendingOrders based on globalSearch
  const filteredPendingOrders = pendingOrders.filter(order => {
    if (!globalSearch) return true;
    const searchLower = globalSearch.toLowerCase();
    return (
      order.id.toLowerCase().includes(searchLower) ||
      (order.customerName && order.customerName.toLowerCase().includes(searchLower)) ||
      (order.customerPhone && order.customerPhone.toLowerCase().includes(searchLower)) ||
      (order.shipmentCompany && order.shipmentCompany.toLowerCase().includes(searchLower)) ||
      ((order as any).orderNumber && (order as any).orderNumber.toLowerCase().includes(searchLower)) ||
      ((order as any).shipmentNumber && (order as any).shipmentNumber.toLowerCase().includes(searchLower))
    );
  });

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
              onClick={() => { setActiveTab('pending'); setSelectedOrders(new Set()); }}
            >
              الطلبات المعلقة ({pendingOrders.length})
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'settled' ? styles.activeTab : ''}`}
              onClick={() => { setActiveTab('settled'); setSelectedOrders(new Set()); }}
            >
              التسويات المكتملة ({settledGroups.length})
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'archived' ? styles.activeTab : ''}`}
              onClick={() => { setActiveTab('archived'); setSelectedOrders(new Set()); }}
            >
              أرشيف الكشوفات ({archivedGroups.length})
            </button>
          </div>

          {activeTab === 'pending' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input 
                  type="text" 
                  placeholder="البحث برقم الطلب، اسم الزبون..." 
                  style={{ width: '100%', padding: '0.75rem 3.5rem 0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#0f111a', color: '#fff', outline: 'none' }}
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                />
                <button 
                  onClick={() => setShowBulkSelectModal(true)}
                  style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}
                  title="تحديد متعدد بالمعرفات (نسخ ولصق)"
                >
                  📋
                </button>
              </div>

              <button 
                className={styles.settleButton} 
                onClick={handleSettle}
                disabled={selectedOrders.size === 0 || isSettling}
                style={{ whiteSpace: 'nowrap' }}
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
            </div>
          )}

          {activeTab === 'settled' && (
            <div ref={actionsDropdownRef} style={{ position: 'relative' }}>
              <button 
                className={styles.settleButton} 
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)' }}
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                disabled={selectedOrders.size === 0}
              >
                ⚙️ الإجراءات ({selectedOrders.size}) ▼
              </button>
              {showActionsDropdown && selectedOrders.size > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.5rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                  zIndex: 100,
                  minWidth: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  {selectedOrders.size === 1 && (
                    <button
                      onClick={() => {
                        const singleId = Array.from(selectedOrders)[0];
                        const group = settledGroups.find(g => g.id === singleId);
                        if (group) setSelectedStatement(group);
                        setShowActionsDropdown(false);
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        textAlign: 'right',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        transition: 'background 0.2s',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      👁️ تفاصيل الكشف
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        const batch = writeBatch(db);
                        selectedOrders.forEach(id => {
                          const group = settledGroups.find(g => g.id === id);
                          if (group) {
                            group.orders.forEach(order => {
                              batch.update(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id), { isSettlementArchived: true });
                            });
                          }
                        });
                        await batch.commit();
                        setSelectedOrders(new Set());
                        setShowActionsDropdown(false);
                      } catch (err) {
                        console.error(err);
                        alert("حدث خطأ أثناء أرشفة الكشوفات.");
                      }
                    }}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      textAlign: 'right',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    📥 أرشفة الكشوفات المحددة
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'archived' && (
            <div ref={actionsDropdownRef} style={{ position: 'relative' }}>
              <button 
                className={styles.settleButton} 
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.2)' }}
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                disabled={selectedOrders.size === 0}
              >
                ⚙️ الإجراءات ({selectedOrders.size}) ▼
              </button>
              {showActionsDropdown && selectedOrders.size > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.5rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                  zIndex: 100,
                  minWidth: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  {selectedOrders.size === 1 && (
                    <button
                      onClick={() => {
                        const singleId = Array.from(selectedOrders)[0];
                        const group = archivedGroups.find(g => g.id === singleId);
                        if (group) setSelectedStatement(group);
                        setShowActionsDropdown(false);
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        textAlign: 'right',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        transition: 'background 0.2s',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      👁️ تفاصيل الكشف
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        const batch = writeBatch(db);
                        selectedOrders.forEach(id => {
                          const group = archivedGroups.find(g => g.id === id);
                          if (group) {
                            group.orders.forEach(order => {
                              batch.update(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id), { isSettlementArchived: false });
                            });
                          }
                        });
                        await batch.commit();
                        setSelectedOrders(new Set());
                        setShowActionsDropdown(false);
                      } catch (err) {
                        console.error(err);
                        alert("حدث خطأ أثناء استعادة الكشوفات.");
                      }
                    }}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      textAlign: 'right',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      transition: 'background 0.2s',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    ↩️ استعادة الكشوفات المحددة
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`هل أنت متأكد من حذف ${selectedOrders.size} كشفاً (وجميع الطلبات المرتبطة بها) بشكل نهائي من النظام؟`)) {
                        try {
                          const batch = writeBatch(db);
                          selectedOrders.forEach(id => {
                            const group = archivedGroups.find(g => g.id === id);
                            if (group) {
                              group.orders.forEach(order => {
                                batch.delete(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id));
                              });
                            }
                          });
                          await batch.commit();
                          setSelectedOrders(new Set());
                          setShowActionsDropdown(false);
                        } catch (err) {
                          console.error(err);
                          alert("حدث خطأ أثناء حذف الكشوفات.");
                        }
                      }
                    }}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      textAlign: 'right',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 'bold',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    🗑️ حذف الكشوفات المحددة
                  </button>
                </div>
              )}
            </div>
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
                    <th>المبلغ الكلي</th>
                    <th>الواصل سابقاً</th>
                    <th>المتبقي للاستلام</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingOrders.map(order => (
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
                      <td className={styles.amountCol} style={{ color: order.paidAmount ? '#f59e0b' : '#64748b' }}>
                        {(order.paidAmount || 0).toLocaleString()} د.ع
                      </td>
                      <td className={styles.amountCol} style={{ color: '#10b981' }}>
                        {(order.totalAmount - (order.paidAmount || 0)).toLocaleString()} د.ع
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
                <div className={styles.emptyIcon}>✨</div>
                <div>لا توجد طلبات معلقة بانتظار التسوية!</div>
              </div>
            )
          ) : activeTab === 'settled' ? (
            settledGroups.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkboxCell}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={selectedOrders.size === settledGroups.length && settledGroups.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>رقم الكشف / الطلب</th>
                    <th>اسم الزبون / التفاصيل</th>
                    <th>تاريخ التسوية</th>
                    <th>المحفظة المستلمة</th>
                    <th>المبلغ المستلم</th>
                    <th>بيانات التسوية</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {settledGroups.map(group => (
                    <tr key={group.id}>
                      <td className={styles.checkboxCell}>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={selectedOrders.has(group.id)}
                          onChange={(e) => handleSelectOrder(group.id, e.target.checked)}
                        />
                      </td>
                      <td>
                        <span style={{ fontWeight: group.isStatement ? 'bold' : 'normal' }}>
                          {group.isStatement ? `📄 كشف: ${group.settlementStatementId}` : `# ${group.id}`}
                        </span>
                      </td>
                      <td>
                        {group.isStatement ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600', color: '#38bdf8' }}>🧾 كشف مشترك ({group.orders.length} طلبات)</span>
                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>أول زبون: {group.orders[0]?.customerName || 'بدون اسم'}</span>
                          </div>
                        ) : (
                          <span>{group.orders[0]?.customerName || 'بدون اسم'}</span>
                        )}
                      </td>
                      <td className={styles.dateCol}>{group.addDate} - {group.addTime}</td>
                      <td>
                        <span style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}>
                          🏦 {group.settledWalletName || 'غير محددة'}
                        </span>
                      </td>
                      <td className={styles.amountCol} style={{ fontWeight: 'bold', color: group.isStatement ? '#38bdf8' : 'inherit' }}>
                        {group.totalAmount.toLocaleString()} د.ع
                      </td>
                      <td>
                        {(group.settlementStatementId || group.settlementAgent) ? (
                          <div className={styles.settlementTableBadge}>
                            {group.settlementStatementId && (
                              <div className={styles.badgeLine}>
                                <span className={styles.badgeLabel}>كشف:</span> {group.settlementStatementId}
                              </div>
                            )}
                            {group.settlementAgent && (
                              <div className={styles.badgeLine}>
                                <span className={styles.badgeLabel}>المندوب:</span> {group.settlementAgent}
                              </div>
                            )}
                            {group.settlementImages && group.settlementImages.length > 0 && (
                              <div className={styles.badgeLine} style={{ color: '#10b981', fontWeight: 'bold' }}>
                                📸 {group.settlementImages.length} مرفقات
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ opacity: 0.4 }}>---</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedStatement(group)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1.2rem',
                              padding: '4px'
                            }}
                            title="عرض تفاصيل الكشف"
                          >
                            👁️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveGroup(group)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1.1rem',
                              padding: '4px'
                            }}
                            title="أرشفة الكشف"
                          >
                            📥
                          </button>
                        </div>
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
          ) : (
            archivedGroups.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkboxCell}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={selectedOrders.size === archivedGroups.length && archivedGroups.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>رقم الكشف / الطلب</th>
                    <th>اسم الزبون / التفاصيل</th>
                    <th>تاريخ التسوية</th>
                    <th>المحفظة المستلمة</th>
                    <th>المبلغ المستلم</th>
                    <th>بيانات التسوية</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedGroups.map(group => (
                    <tr key={group.id}>
                      <td className={styles.checkboxCell}>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={selectedOrders.has(group.id)}
                          onChange={(e) => handleSelectOrder(group.id, e.target.checked)}
                        />
                      </td>
                      <td>
                        <span style={{ fontWeight: group.isStatement ? 'bold' : 'normal' }}>
                          {group.isStatement ? `📄 كشف: ${group.settlementStatementId}` : `# ${group.id}`}
                        </span>
                      </td>
                      <td>
                        {group.isStatement ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600', color: '#f59e0b' }}>🧾 كشف مشترك ({group.orders.length} طلبات)</span>
                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>أول زبون: {group.orders[0]?.customerName || 'بدون اسم'}</span>
                          </div>
                        ) : (
                          <span>{group.orders[0]?.customerName || 'بدون اسم'}</span>
                        )}
                      </td>
                      <td className={styles.dateCol}>{group.addDate} - {group.addTime}</td>
                      <td>
                        <span style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}>
                          🏦 {group.settledWalletName || 'غير محددة'}
                        </span>
                      </td>
                      <td className={styles.amountCol} style={{ fontWeight: 'bold', color: group.isStatement ? '#f59e0b' : 'inherit' }}>
                        {group.totalAmount.toLocaleString()} د.ع
                      </td>
                      <td>
                        {(group.settlementStatementId || group.settlementAgent) ? (
                          <div className={styles.settlementTableBadge}>
                            {group.settlementStatementId && (
                              <div className={styles.badgeLine}>
                                <span className={styles.badgeLabel}>كشف:</span> {group.settlementStatementId}
                              </div>
                            )}
                            {group.settlementAgent && (
                              <div className={styles.badgeLine}>
                                <span className={styles.badgeLabel}>المندوب:</span> {group.settlementAgent}
                              </div>
                            )}
                            {group.settlementImages && group.settlementImages.length > 0 && (
                              <div className={styles.badgeLine} style={{ color: '#10b981', fontWeight: 'bold' }}>
                                📸 {group.settlementImages.length} مرفقات
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ opacity: 0.4 }}>---</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedStatement(group)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1.2rem',
                              padding: '4px'
                            }}
                            title="عرض تفاصيل الكشف"
                          >
                            👁️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestoreGroup(group)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1.1rem',
                              padding: '4px'
                            }}
                            title="استعادة الكشف"
                          >
                            ↩️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(group)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1.1rem',
                              padding: '4px'
                            }}
                            title="حذف الكشف نهائياً"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📦</div>
                <div>أرشيف الكشوفات فارغ!</div>
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
              <div 
                className={styles.summaryItem}
                onClick={() => setShowSelectedOrdersList(!showSelectedOrdersList)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="اضغط لعرض أو إخفاء الطلبات المحددة"
              >
                <span className={styles.summaryLabel}>
                  عدد الطلبات المحددة 
                  <span style={{ fontSize: '0.8rem', marginRight: '0.5rem', opacity: 0.7 }}>
                    {showSelectedOrdersList ? '▲' : '▼'}
                  </span>
                </span>
                <span className={styles.summaryValue} style={{ color: '#10b981' }}>{selectedOrders.size} طلب</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>إجمالي المبلغ المستحق</span>
                <span className={styles.summaryValue} style={{ color: '#38bdf8' }}>{totalSelectedAmount.toLocaleString()} د.ع</span>
              </div>
            </div>

            {showSelectedOrdersList && selectedOrders.size > 0 && (
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                margin: '0 1.5rem 1.5rem 1.5rem',
                padding: '0.5rem'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }}>
                      <th style={{ padding: '0.5rem' }}>رقم الطلب</th>
                      <th style={{ padding: '0.5rem' }}>اسم الزبون</th>
                      <th style={{ padding: '0.5rem' }}>المبلغ المستلم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(selectedOrders).map(orderId => {
                      const order = pendingOrders.find(o => o.id === orderId);
                      if (!order) return null;
                      const inputAmount = bulkSettlementAmounts[orderId];
                      const remainingAmount = order.totalAmount - (order.paidAmount || 0);
                      const amountStr = (inputAmount !== undefined ? inputAmount : remainingAmount).toLocaleString();
                      return (
                        <tr key={orderId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '0.5rem' }}>{order.id.slice(-6).toUpperCase()}</td>
                          <td style={{ padding: '0.5rem' }}>{order.customerName}</td>
                          <td style={{ padding: '0.5rem', color: '#10b981', direction: 'ltr', textAlign: 'right' }}>{amountStr} د.ع</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

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
                  <label className={styles.label}>اسم شركة التوصيل / المندوب المسلِّم</label>
                  <select
                    className={styles.select}
                    value={deliveryAgent}
                    onChange={e => setDeliveryAgent(e.target.value)}
                  >
                    <option value="">اختر الشركة أو المندوب...</option>
                    {shippingCompanies.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
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

      {/* Statement Details Modal */}
      {selectedStatement && (
        <div className={styles.modalOverlay} onClick={() => setSelectedStatement(null)}>
          <div className={styles.detailsModal} style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)' }}>
              <h2>
                🧾 تفاصيل كشف التسوية 
                <span style={{ color: '#38bdf8', fontSize: '1rem', marginRight: '0.5rem' }}>
                  {selectedStatement.isStatement ? `#${selectedStatement.settlementStatementId}` : `(تسوية فردية)`}
                </span>
              </h2>
              <button className={styles.closeButton} onClick={() => setSelectedStatement(null)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              {/* Statement Information Grid */}
              <div className={styles.detailsGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>رقم كشف الشركة / الورقي</span>
                  <span className={styles.detailsValue}>{selectedStatement.settlementStatementId || 'بدون رقم كشف'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>المحفظة المستلمة</span>
                  <span className={styles.detailsValue} style={{ color: '#10b981' }}>🏦 {selectedStatement.settledWalletName}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>المندوب المسلِّم</span>
                  <span className={styles.detailsValue}>{selectedStatement.settlementAgent || '---'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>تاريخ ووقت الكشف</span>
                  <span className={styles.detailsValue}>{selectedStatement.addDate} - {selectedStatement.addTime}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>عدد الطلبات المشمولة</span>
                  <span className={styles.detailsValue} style={{ color: '#38bdf8', fontWeight: 'bold' }}>{selectedStatement.orders.length} طلب</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>إجمالي مبلغ الكشف</span>
                  <span className={styles.detailsValue} style={{ color: '#10b981', fontWeight: 'bold' }}>
                    {selectedStatement.totalAmount.toLocaleString()} د.ع
                  </span>
                </div>
              </div>

              {/* Orders List Table inside Statement */}
              <div className={styles.itemsTableContainer} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.8rem', fontWeight: '600' }}>📦 الطلبات المشمولة في هذا الكشف:</h3>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>رقم الطلب</th>
                      <th>اسم الزبون</th>
                      <th>رقم الهاتف</th>
                      <th>المحافظة والمنطقة</th>
                      <th>المبلغ</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStatement.orders.map((order, idx) => (
                      <tr key={order.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{order.id}</td>
                        <td>{order.customerName}</td>
                        <td style={{ direction: 'ltr', textAlign: 'right' }}>{order.customerPhone || '---'}</td>
                        <td>{order.governorate} - {order.region}</td>
                        <td style={{ color: '#10b981', fontWeight: 'bold' }}>{order.totalAmount.toLocaleString()} د.ع</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1.1rem',
                              padding: '4px'
                            }}
                            title="عرض تفاصيل الطلب والمواد"
                          >
                            👁️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Settlement Notes */}
              {selectedStatement.settlementNotes && (
                <div className={styles.settlementDetailsSection} style={{ marginBottom: '1.5rem' }}>
                  <h3 className={styles.sectionSubTitle}>📝 ملاحظات التسوية الكلية</h3>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {selectedStatement.settlementNotes}
                  </div>
                </div>
              )}

              {/* Attachment Images */}
              {selectedStatement.settlementImages && selectedStatement.settlementImages.length > 0 && (
                <div className={styles.settlementDetailsSection}>
                  <h3 className={styles.sectionSubTitle}>🖼️ مرفقات وصور الكشف الورقي ({selectedStatement.settlementImages.length})</h3>
                  <div className={styles.imageGallery}>
                    {selectedStatement.settlementImages.map((imgUrl, index) => (
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

            <div className={styles.modalFooterDetails}>
              <div className={styles.notesSection}>
                💡 اضغط على زر العين (👁️) بجانب أي طلب في الجدول أعلاه لعرض الأصناف المشتراة وتفاصيل العميل.
              </div>
              <div className={styles.totalHighlight}>
                <span>المبلغ الكلي للكشف:</span>
                <span>{selectedStatement.totalAmount.toLocaleString()} د.ع</span>
              </div>
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

      {/* Bulk Select Modal */}
      {showBulkSelectModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBulkSelectModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2 className={styles.modalTitle} style={{ color: '#60a5fa' }}>📋 تحديد متعدد عبر الإكسل</h2>
            <div style={{ marginBottom: '1.5rem', color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6' }}>
              قم بنسخ ولصق أرقام الطلبات أو بوليصات الشحن من ملف الإكسل هنا. يمكنك لصق عمود واحد للمعرفات فقط (للتسوية الكاملة)، أو عمودين (رقم الطلب ثم المبلغ المستلم مفصولين بمسافة أو Tab) لتسجيل المبالغ الجزئية تلقائياً.
              <br /><br />
              <strong>مثال للإدخال:</strong><br />
              <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', display: 'block', borderRadius: '6px', color: '#10b981', marginTop: '0.5rem' }}>
                ORD-001<br />
                ORD-002&nbsp;&nbsp;&nbsp;45000<br />
                ORD-003&nbsp;&nbsp;&nbsp;20,000
              </code>
            </div>
            
            <textarea
              value={bulkSelectText}
              onChange={(e) => setBulkSelectText(e.target.value)}
              placeholder="الصق المعرفات هنا..."
              style={{
                width: '100%',
                height: '250px',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '1rem',
                resize: 'vertical',
                outline: 'none',
                direction: 'ltr',
                textAlign: 'left'
              }}
            />
            
            <div className={styles.modalActions} style={{ marginTop: '1.5rem' }}>
              <button 
                className={styles.submitBtn} 
                onClick={handleBulkSelect}
                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
              >
                تحديد الطلبات
              </button>
              <button className={styles.cancelBtn} onClick={() => setShowBulkSelectModal(false)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
