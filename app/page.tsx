"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot } from 'firebase/firestore';

export default function Dashboard() {
  const [filter, setFilter] = useState('الشهر');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isFilterCalOpen, setIsFilterCalOpen] = useState(false);
  const filterCalRef = useRef<HTMLDivElement>(null);
  const [tempMainFilter, setTempMainFilter] = useState('الشهر');
  const [tempMainStart, setTempMainStart] = useState('');
  const [tempMainEnd, setTempMainEnd] = useState('');
  const [teamFilter, setTeamFilter] = useState('الشهر');
  const [teamStartDate, setTeamStartDate] = useState('');
  const [teamEndDate, setTeamEndDate] = useState('');
  const [isTeamCalOpen, setIsTeamCalOpen] = useState(false);
  const teamCalRef = useRef<HTMLDivElement>(null);
  const [teamViewMode, setTeamViewMode] = useState<'team' | 'landing_pages'>('team');
  
  // Temporary state for calendar modal before user clicks Apply ("تم")
  const [tempFilter, setTempFilter] = useState('الشهر');
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  const [orders, setOrders] = useState<any[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [inStockCount, setInStockCount] = useState(0);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded States for Analysis Tree
  const [expandedAnalysisPages, setExpandedAnalysisPages] = useState<Record<string, boolean>>({});
  const [expandedAnalysisBranches, setExpandedAnalysisBranches] = useState<Record<string, boolean>>({});
  const [expandedAnalysisSubcats, setExpandedAnalysisSubcats] = useState<Record<string, boolean>>({});

  // Active Orders (Gauge Card) Period Filter states
  const [gaugeFilter, setGaugeFilter] = useState('الشهر');
  const [gaugeStartDate, setGaugeStartDate] = useState('');
  const [gaugeEndDate, setGaugeEndDate] = useState('');
  const [isGaugeCalOpen, setIsGaugeCalOpen] = useState(false);
  const gaugeCalRef = useRef<HTMLDivElement>(null);

  const [tempGaugeFilter, setTempGaugeFilter] = useState('الشهر');
  const [tempGaugeStartDate, setTempGaugeStartDate] = useState('');
  const [tempGaugeEndDate, setTempGaugeEndDate] = useState('');

  // Sales Card custom filters
  const [salesCardViewType, setSalesCardViewType] = useState<'sales' | 'orders'>('sales');
  const [salesCardYear, setSalesCardYear] = useState(new Date().getFullYear());
  const [salesCardMonth, setSalesCardMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (teamCalRef.current && !teamCalRef.current.contains(event.target as Node)) {
        setIsTeamCalOpen(false);
      }
      if (gaugeCalRef.current && !gaugeCalRef.current.contains(event.target as Node)) {
        setIsGaugeCalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTeamDateRangeLabel = () => {
    if (teamFilter === 'اليوم') return 'تاريخ: اليوم';
    if (teamFilter === 'الأسبوع') return 'تاريخ: الأسبوع';
    if (teamFilter === 'الشهر') return 'تاريخ: الشهر';
    if (teamFilter === 'الحد الأقصى') return 'تاريخ: الحد الأقصى';
    if (teamFilter === 'مخصص') {
      if (teamStartDate && teamEndDate) {
        return `${teamStartDate} ⬅️ ${teamEndDate}`;
      }
      return 'تاريخ: مخصص';
    }
    return 'تاريخ: الشهر';
  };

  const toggleTeamCal = () => {
    if (!isTeamCalOpen) {
      setTempFilter(teamFilter);
      setTempStartDate(teamStartDate);
      setTempEndDate(teamEndDate);
    }
    setIsTeamCalOpen(!isTeamCalOpen);
  };

  const selectTeamShortcut = (type: string) => {
    setTempFilter(type);
  };

  const handleCustomDateChange = (type: 'start' | 'end', val: string) => {
    setTempFilter('مخصص');
    if (type === 'start') {
      setTempStartDate(val);
    } else {
      setTempEndDate(val);
    }
  };

  const handleApplyTeamFilter = () => {
    setTeamFilter(tempFilter);
    setTeamStartDate(tempStartDate);
    setTeamEndDate(tempEndDate);
    setIsTeamCalOpen(false);
  };

  const handleCancelTeamFilter = () => {
    setIsTeamCalOpen(false);
  };

  useEffect(() => {
    if (tempFilter === 'مخصص') {
      const todayStr = new Date().toISOString().split('T')[0];
      if (!tempStartDate) setTempStartDate(todayStr);
      if (!tempEndDate) setTempEndDate(todayStr);
    }
  }, [tempFilter, tempStartDate, tempEndDate]);

  const getGaugeDateRangeLabel = () => {
    if (gaugeFilter === 'اليوم') return 'تاريخ: اليوم';
    if (gaugeFilter === 'الأسبوع') return 'تاريخ: الأسبوع';
    if (gaugeFilter === 'الشهر') return 'تاريخ: الشهر';
    if (gaugeFilter === 'الحد الأقصى') return 'تاريخ: الحد الأقصى';
    if (gaugeFilter === 'مخصص') {
      if (gaugeStartDate && gaugeEndDate) {
        return `${gaugeStartDate} ⬅️ ${gaugeEndDate}`;
      }
      return 'تاريخ: مخصص';
    }
    return 'تاريخ: الشهر';
  };

  const getGaugeDescriptionLabel = () => {
    if (gaugeFilter === 'اليوم') return 'اليوم';
    if (gaugeFilter === 'الأسبوع') return 'هذا الأسبوع';
    if (gaugeFilter === 'الشهر') return 'هذا الشهر';
    if (gaugeFilter === 'الحد الأقصى') return 'الكل';
    return 'في هذه الفترة';
  };

  const toggleGaugeCal = () => {
    if (!isGaugeCalOpen) {
      setTempGaugeFilter(gaugeFilter);
      setTempGaugeStartDate(gaugeStartDate);
      setTempGaugeEndDate(gaugeEndDate);
    }
    setIsGaugeCalOpen(!isGaugeCalOpen);
  };

  const selectGaugeShortcut = (type: string) => {
    setTempGaugeFilter(type);
  };

  const handleGaugeCustomDateChange = (type: 'start' | 'end', val: string) => {
    setTempGaugeFilter('مخصص');
    if (type === 'start') {
      setTempGaugeStartDate(val);
    } else {
      setTempGaugeEndDate(val);
    }
  };

  const handleApplyGaugeFilter = () => {
    setGaugeFilter(tempGaugeFilter);
    setGaugeStartDate(tempGaugeStartDate);
    setGaugeEndDate(tempGaugeEndDate);
    setIsGaugeCalOpen(false);
  };

  const handleCancelGaugeFilter = () => {
    setIsGaugeCalOpen(false);
  };

  useEffect(() => {
    if (tempGaugeFilter === 'مخصص') {
      const todayStr = new Date().toISOString().split('T')[0];
      if (!tempGaugeStartDate) setTempGaugeStartDate(todayStr);
      if (!tempGaugeEndDate) setTempGaugeEndDate(todayStr);
    }
  }, [tempGaugeFilter, tempGaugeStartDate, tempGaugeEndDate]);

  useEffect(() => {
    // Listen to orders
    const unsubOrders = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
    });

    // Listen to products count and instock stats
    const unsubProducts = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'), (snapshot) => {
      const prods = snapshot.docs.map(doc => doc.data());
      setProductsCount(prods.length);
      
      const inStock = prods.filter(p => {
        if (!p.stock) return false;
        let totalStock = 0;
        for (const storeId in p.stock) {
          totalStock += Number(p.stock[storeId].quantity) || 0;
        }
        return totalStock > 0;
      }).length;
      
      setInStockCount(inStock);
    }, (error) => {
      console.error("Error fetching products:", error);
    });

    // Listen to all products for profit analysis
    const unsubAllProducts = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'), (snapshot) => {
      setAllProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching all products:", error);
    });

    // Listen to expenses for profit analysis
    const unsubExpenses = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching expenses:", error);
    });

    // Listen to categories for profit analysis
    const unsubCategories = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories'), (snapshot) => {
      setAllCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching categories:", error);
    });

    // Listen to pages for profit analysis
    const unsubPages = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'pages_stores'), (snapshot) => {
      setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching pages:", error);
    });

    return () => {
      unsubOrders();
      unsubProducts();
      unsubAllProducts();
      unsubExpenses();
      unsubCategories();
      unsubPages();
    };
  }, []);

  const getMainDateRangeLabel = () => {
    if (filter === 'اليوم') return 'تاريخ: اليوم';
    if (filter === 'الأسبوع') return 'تاريخ: الأسبوع';
    if (filter === 'الشهر') return 'تاريخ: الشهر';
    if (filter === 'الحد الأقصى') return 'تاريخ: الحد الأقصى';
    if (filter === 'مخصص') {
      if (filterStartDate && filterEndDate) return `${filterStartDate} إلى ${filterEndDate}`;
      return 'تاريخ: مخصص';
    }
    return 'تاريخ: الشهر';
  };

  const toggleMainCal = () => {
    setTempMainFilter(filter);
    setTempMainStart(filterStartDate);
    setTempMainEnd(filterEndDate);
    setIsFilterCalOpen(!isFilterCalOpen);
  };

  const selectMainShortcut = (shortcut: string) => {
    setTempMainFilter(shortcut);
    setTempMainStart('');
    setTempMainEnd('');
  };

  const handleCustomMainDateChange = (type: 'start' | 'end', val: string) => {
    setTempMainFilter('مخصص');
    if (type === 'start') setTempMainStart(val);
    else setTempMainEnd(val);
  };

  const handleApplyMainFilter = () => {
    setFilter(tempMainFilter);
    setFilterStartDate(tempMainStart);
    setFilterEndDate(tempMainEnd);
    
    // Sync Team Performance Card
    setTeamFilter(tempMainFilter);
    setTeamStartDate(tempMainStart);
    setTeamEndDate(tempMainEnd);
    
    // Sync Delivery/Returns Gauge Card
    setGaugeFilter(tempMainFilter);
    setGaugeStartDate(tempMainStart);
    setGaugeEndDate(tempMainEnd);
    
    // Sync Sales Card (extracts Year and Month)
    if (tempMainFilter === 'الشهر' || tempMainFilter === 'اليوم' || tempMainFilter === 'الأسبوع') {
      const now = new Date();
      setSalesCardYear(now.getFullYear());
      setSalesCardMonth(now.getMonth() + 1);
    } else if (tempMainFilter === 'مخصص' && tempMainStart) {
      const [yr, mo] = tempMainStart.split('-').map(Number);
      if (yr && mo) {
        setSalesCardYear(yr);
        setSalesCardMonth(mo);
      }
    }

    setIsFilterCalOpen(false);
  };

  const handleCancelMainFilter = () => {
    setIsFilterCalOpen(false);
  };

  const filteredOrders = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const thisWeek = today - 7 * 24 * 60 * 60 * 1000;
    const thisMonth = today - 30 * 24 * 60 * 60 * 1000;
    const thisYear = today - 365 * 24 * 60 * 60 * 1000;

    return orders.filter(order => {
      if (!order.date) return false;
      const orderTime = order.date.toDate ? order.date.toDate().getTime() : new Date(order.date).getTime();
      
      if (filter === 'اليوم') {
        return orderTime >= today;
      } else if (filter === 'الأسبوع') {
        return orderTime >= thisWeek;
      } else if (filter === 'الشهر') {
        return orderTime >= thisMonth;
      } else if (filter === 'مخصص') {
        let start = 0;
        let end = Infinity;
        let d1 = 0, d2 = Infinity;
        
        if (filterStartDate) {
          const [yr, mo, dy] = filterStartDate.split('-').map(Number);
          d1 = new Date(yr, mo - 1, dy, 0, 0, 0, 0).getTime();
        }
        if (filterEndDate) {
          const [yr, mo, dy] = filterEndDate.split('-').map(Number);
          d2 = new Date(yr, mo - 1, dy, 23, 59, 59, 999).getTime();
        }
        
        if (filterStartDate && filterEndDate) {
            start = Math.min(d1, new Date(filterEndDate.split('-').map(Number)[0], filterEndDate.split('-').map(Number)[1] - 1, filterEndDate.split('-').map(Number)[2], 0, 0, 0, 0).getTime());
            end = Math.max(new Date(filterStartDate.split('-').map(Number)[0], filterStartDate.split('-').map(Number)[1] - 1, filterStartDate.split('-').map(Number)[2], 23, 59, 59, 999).getTime(), d2);
        } else {
            start = d1;
            end = d2;
        }

        return orderTime >= start && orderTime <= end;
      } else if (filter === 'الحد الأقصى') {
        return orderTime >= thisYear;
      }
      return true;
    });
  }, [orders, filter, filterStartDate, filterEndDate]);

  const stats = React.useMemo(() => {
    const activeOrders = filteredOrders.filter(o => o.status !== 'cancelled');
    const totalSales = filteredOrders
      .filter(o => o.is_settled === true || o.paymentStatus === 'partially_settled')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    return {
      activeOrdersCount: activeOrders.length,
      totalSales
    };
  }, [filteredOrders]);

  const teamFilteredOrders = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeek = today - 7 * 24 * 60 * 60 * 1000;
    const oneMonth = today - 30 * 24 * 60 * 60 * 1000;

    return orders.filter(order => {
      if (!order.date) return false;
      const orderTime = order.date.toDate ? order.date.toDate().getTime() : new Date(order.date).getTime();
      
      if (teamFilter === 'اليوم') {
        return orderTime >= today;
      } else if (teamFilter === 'الأسبوع') {
        return orderTime >= oneWeek;
      } else if (teamFilter === 'الشهر') {
        return orderTime >= oneMonth;
      } else if (teamFilter === 'الحد الأقصى') {
        return true;
      } else if (teamFilter === 'مخصص') {
        let start = 0;
        let end = Infinity;
        let d1 = 0, d2 = Infinity;
        if (teamStartDate) {
          const [yr, mo, dy] = teamStartDate.split('-').map(Number);
          d1 = new Date(yr, mo - 1, dy, 0, 0, 0, 0).getTime();
        }
        if (teamEndDate) {
          const [yr, mo, dy] = teamEndDate.split('-').map(Number);
          d2 = new Date(yr, mo - 1, dy, 23, 59, 59, 999).getTime();
        }
        
        if (teamStartDate && teamEndDate) {
            start = Math.min(d1, new Date(teamEndDate.split('-').map(Number)[0], teamEndDate.split('-').map(Number)[1] - 1, teamEndDate.split('-').map(Number)[2], 0, 0, 0, 0).getTime());
            end = Math.max(new Date(teamStartDate.split('-').map(Number)[0], teamStartDate.split('-').map(Number)[1] - 1, teamStartDate.split('-').map(Number)[2], 23, 59, 59, 999).getTime(), d2);
        } else {
            start = d1;
            end = d2;
        }
        return orderTime >= start && orderTime <= end;
      }
      return true;
    });
  }, [orders, teamFilter, teamStartDate, teamEndDate]);

  const teamStats = React.useMemo(() => {
    const empMap = new Map<string, any>();
    
    // Find all unique active employees from all orders
    const allEmployees = new Set<string>();
    orders.forEach(order => {
      const empName = order.employeeName?.trim() || 'مجهول';
      if (empName !== '---' && empName !== 'مجهول') {
        allEmployees.add(empName);
      }
    });

    // Pre-populate each employee with 0 counts
    allEmployees.forEach(empName => {
      empMap.set(empName, { name: empName, delivered: 0, returned: 0, pending: 0, total: 0 });
    });

    // Accumulate actual stats from filtered orders
    teamFilteredOrders.forEach(order => {
      const empName = order.employeeName?.trim() || 'مجهول';
      if (empName === '---' || empName === 'مجهول') return;

      if (!empMap.has(empName)) {
        empMap.set(empName, { name: empName, delivered: 0, returned: 0, pending: 0, total: 0 });
      }

      const empStats = empMap.get(empName)!;
      if (order.status === 'cancelled' || order.status === 'deleted' || order.isDeleted === true) {
        return; // Ignore cancelled and deleted orders completely for team performance
      }

      empStats.total += 1;
      
      if (order.status === 'delivered' || order.status === 'completed' || order.is_settled === true || order.paymentStatus === 'partially_settled' || order.status === 'partial') {
        empStats.delivered += 1;
      } else if (order.status === 'returned' || order.status === 'returned_agent' || order.status === 'returned_warehouse' || order.returnStatus === 'in_warehouse') {
        empStats.returned += 1;
      } else {
        empStats.pending += 1;
      }
    });

    const empList = Array.from(empMap.values());
    
    // Filter based on view mode (team vs landing pages)
    const isLandingPage = (name: string) => {
      const lower = name.toLowerCase();
      return lower.includes('محبس') || lower.includes('عقيق') || lower.includes('landing') || lower.includes('هبوط');
    };

    const filteredList = empList.filter(emp => {
      if (emp.total === 0) return false;

      if (teamViewMode === 'team') {
        return !isLandingPage(emp.name);
      } else {
        return isLandingPage(emp.name);
      }
    });

    // Sort primarily by total orders, and secondarily alphabetically by name
    filteredList.sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.name.localeCompare(b.name, 'ar');
    });
    return filteredList;
  }, [orders, teamFilteredOrders, teamViewMode]);

  const getDateRangeLabel = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const todayStr = now.toLocaleDateString('ar-EG', options);
    
    if (filter === 'اليوم') {
      return todayStr;
    }
    
    let daysAgo = 7;
    if (filter === 'هذا الأسبوع') daysAgo = 7;
    else if (filter === 'هذا الشهر') daysAgo = 30;
    else if (filter === 'هذا العام') daysAgo = 365;
    
    const pastDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const pastStr = pastDate.toLocaleDateString('ar-EG', options);
    return `${pastStr} - ${todayStr}`;
  };

  const stockPercent = productsCount > 0 ? Math.round((inStockCount / productsCount) * 100) : 0;

  const salesCardData = React.useMemo(() => {
    const points: { value: number; time?: number; label: string }[] = [];
    const daysInMonth = new Date(salesCardYear, salesCardMonth, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
      points.push({ value: 0, time: new Date(salesCardYear, salesCardMonth - 1, i).getTime(), label: `${i}` });
    }

    let total = 0;
    let prevTotal = 0;

    orders.forEach(order => {
      if (order.status === 'cancelled' || order.status === 'deleted' || order.isDeleted === true) return;
      if (!order.date) return;

      const date = order.date.toDate ? order.date.toDate() : new Date(order.date);
      const yr = date.getFullYear();
      const mo = date.getMonth() + 1;
      
      const isSettledOrPartial = order.is_settled === true || order.paymentStatus === 'partially_settled';

      const isDelivered = order.status === 'delivered' || order.status === 'completed' || order.is_settled === true || order.paymentStatus === 'partially_settled' || order.status === 'partial';

      if (yr === salesCardYear && mo === salesCardMonth) {
        const dayIndex = date.getDate() - 1;
        if (isDelivered) {
          if (salesCardViewType === 'sales') {
            const amount = Number(order.totalAmount) || 0;
            points[dayIndex].value += amount;
            total += amount;
          } else {
            points[dayIndex].value += 1;
            total += 1;
          }
        }
      } else if (
        (mo === salesCardMonth - 1 && yr === salesCardYear) || 
        (salesCardMonth === 1 && mo === 12 && yr === salesCardYear - 1)
      ) {
        if (isDelivered) {
          if (salesCardViewType === 'sales') {
            prevTotal += Number(order.totalAmount) || 0;
          } else {
            prevTotal += 1;
          }
        }
      }
    });

    return { points, total, prevTotal };
  }, [orders, salesCardYear, salesCardMonth, salesCardViewType]);

  const svgChartPath = React.useMemo(() => {
    const width = 500;
    const height = 180;
    const padding = 8;
    const chartWidth = width;
    const chartHeight = 152; // drawing height range (160 - 8)

    if (salesCardData.points.length === 0) {
      return { barPaths: [], maxVal: 0, minVal: 0 };
    }

    const values = salesCardData.points.map(p => p.value);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const range = maxVal - minVal;

    const slotWidth = chartWidth / salesCardData.points.length;
    const barWidth = Math.min(24, Math.max(6, slotWidth * 0.45));
    const r = Math.min(5, barWidth / 2);
    const baseline = 160;

    const barPaths = salesCardData.points.map((point, idx) => {
      const x = (idx + 0.5) * slotWidth;
      const y = range === 0 
        ? 8 + chartHeight / 2 
        : 8 + chartHeight - ((point.value - minVal) / range) * chartHeight;
      
      const path = point.value === 0 
        ? '' 
        : `M ${x - barWidth / 2} ${baseline} 
           L ${x - barWidth / 2} ${y + r} 
           A ${r} ${r} 0 0 1 ${x - barWidth / 2 + r} ${y} 
           L ${x + barWidth / 2 - r} ${y} 
           A ${r} ${r} 0 0 1 ${x + barWidth / 2} ${y + r} 
           L ${x + barWidth / 2} ${baseline} 
           Z`;
      return { path, val: point.value, label: point.label, x, y };
    });

    return { barPaths, maxVal, minVal };
  }, [salesCardData]);

  const salesTrendPercentage = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;
    const oneYear = 365 * oneDay;

    let currentStart = 0;
    let prevStart = 0;
    let prevEnd = 0;

    if (filter === 'اليوم') {
      currentStart = today;
      prevStart = today - oneDay;
      prevEnd = today;
    } else if (filter === 'الأسبوع') {
      currentStart = today - oneWeek;
      prevStart = today - 2 * oneWeek;
      prevEnd = today - oneWeek;
    } else if (filter === 'الشهر' || filter === 'مخصص') {
      currentStart = today - oneMonth;
      prevStart = today - 2 * oneMonth;
      prevEnd = today - oneMonth;
    } else if (filter === 'الحد الأقصى') {
      currentStart = today - oneYear;
      prevStart = today - 2 * oneYear;
      prevEnd = today - oneYear;
    } else {
      return 0;
    }

    const currentSales = orders
      .filter(o => {
        if (o.status === 'cancelled' || o.status === 'deleted' || o.isDeleted === true) return false;
        const isSettledOrPartial = o.is_settled === true || o.paymentStatus === 'partially_settled';
        if (!isSettledOrPartial || !o.date) return false;
        const oTime = o.date.toDate ? o.date.toDate().getTime() : new Date(o.date).getTime();
        return oTime >= currentStart;
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    const prevSales = orders
      .filter(o => {
        if (o.status === 'cancelled' || o.status === 'deleted' || o.isDeleted === true) return false;
        const isSettledOrPartial = o.is_settled === true || o.paymentStatus === 'partially_settled';
        if (!isSettledOrPartial || !o.date) return false;
        const oTime = o.date.toDate ? o.date.toDate().getTime() : new Date(o.date).getTime();
        return oTime >= prevStart && oTime < prevEnd;
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    if (prevSales === 0) {
      return currentSales > 0 ? 100 : 0;
    }
    return Math.round(((currentSales - prevSales) / prevSales) * 10000) / 100;
  }, [orders, filter, filterStartDate, filterEndDate]);

  const yAxisLabels = React.useMemo(() => {
    const max = svgChartPath.maxVal || 0;
    const min = svgChartPath.minVal || 0;

    if (max === 0 && min === 0) {
      return {
        top: '100,000',
        mid: '50,000',
        bottom: '0'
      };
    }

    if (max === min) {
      return {
        top: Math.round(max).toLocaleString(),
        mid: Math.round(max / 2).toLocaleString(),
        bottom: '0'
      };
    }

    const range = max - min;
    return {
      top: Math.round(max).toLocaleString(),
      mid: Math.round(min + range / 2).toLocaleString(),
      bottom: Math.round(min).toLocaleString()
    };
  }, [svgChartPath.maxVal, svgChartPath.minVal]);

  const gaugeFilteredOrders = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeek = today - 7 * 24 * 60 * 60 * 1000;
    const oneMonth = today - 30 * 24 * 60 * 60 * 1000;

    return orders.filter(order => {
      if (!order.date) return false;
      const orderTime = order.date.toDate ? order.date.toDate().getTime() : new Date(order.date).getTime();
      
      if (gaugeFilter === 'اليوم') {
        return orderTime >= today;
      } else if (gaugeFilter === 'الأسبوع') {
        return orderTime >= oneWeek;
      } else if (gaugeFilter === 'الشهر') {
        return orderTime >= oneMonth;
      } else if (gaugeFilter === 'الحد الأقصى') {
        return true;
      } else if (gaugeFilter === 'مخصص') {
        let start = 0;
        let end = Infinity;
        let d1 = 0, d2 = Infinity;
        if (gaugeStartDate) {
          const [yr, mo, dy] = gaugeStartDate.split('-').map(Number);
          d1 = new Date(yr, mo - 1, dy, 0, 0, 0, 0).getTime();
        }
        if (gaugeEndDate) {
          const [yr, mo, dy] = gaugeEndDate.split('-').map(Number);
          d2 = new Date(yr, mo - 1, dy, 23, 59, 59, 999).getTime();
        }
        if (gaugeStartDate && gaugeEndDate) {
            start = Math.min(d1, new Date(gaugeEndDate.split('-').map(Number)[0], gaugeEndDate.split('-').map(Number)[1] - 1, gaugeEndDate.split('-').map(Number)[2], 0, 0, 0, 0).getTime());
            end = Math.max(new Date(gaugeStartDate.split('-').map(Number)[0], gaugeStartDate.split('-').map(Number)[1] - 1, gaugeStartDate.split('-').map(Number)[2], 23, 59, 59, 999).getTime(), d2);
        } else {
            start = d1;
            end = d2;
        }
        return orderTime >= start && orderTime <= end;
      }
      return true;
    });
  }, [orders, gaugeFilter, gaugeStartDate, gaugeEndDate]);

  const gaugeStats = React.useMemo(() => {
    const total = gaugeFilteredOrders.length;
    let delivered = 0;
    let returned = 0;
    let cancelled = 0;
    let inProgress = 0;

    gaugeFilteredOrders.forEach(o => {
      if (o.status === 'cancelled' || o.status === 'deleted' || o.isDeleted === true) {
        cancelled++;
      } else if (o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse' || o.returnStatus === 'in_warehouse') {
        returned++;
      } else if (o.status === 'delivered' || o.status === 'completed' || o.is_settled === true || o.paymentStatus === 'partially_settled' || o.status === 'partial') {
        delivered++;
      } else {
        inProgress++;
      }
    });
    
    // For rate calculation, we can use total active orders (excluding cancelled/deleted) or all orders.
    // The previous logic excluded cancelled for rates.
    const activeOrders = total - cancelled;

    if (total === 0) return { totalOrdersCount: 0, activeOrdersCount: 0, deliveredCount: 0, returnedCount: 0, inProgressCount: 0, cancelledCount: 0, deliveryRate: 0, returnRate: 0, inProgressRate: 0, cancelledRate: 0 };
    const delRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    const retRate = total > 0 ? Math.round((returned / total) * 100) : 0;
    const progRate = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    const cancRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    
    return {
      totalOrdersCount: total,
      activeOrdersCount: activeOrders,
      deliveredCount: delivered,
      returnedCount: returned,
      inProgressCount: inProgress,
      cancelledCount: cancelled,
      deliveryRate: delRate,
      returnRate: retRate,
      inProgressRate: progRate,
      cancelledRate: cancRate
    };
  }, [gaugeFilteredOrders]);

  const filteredExpenses = React.useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const getDaysAgo = (days: number) => {
      const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    };

    return expenses.filter(exp => {
      if (!exp.date) return false;
      if (exp.isArchived) return false;
      
      if (filter === 'اليوم') {
        return exp.date === todayStr;
      } else if (filter === 'الأسبوع') {
        return exp.date >= getDaysAgo(7);
      } else if (filter === 'الشهر') {
        return exp.date >= getDaysAgo(30);
      } else if (filter === 'مخصص') {
        let isValid = true;
        if (filterStartDate) {
          isValid = isValid && exp.date >= filterStartDate;
        }
        if (filterEndDate) {
          isValid = isValid && exp.date <= filterEndDate;
        }
        return isValid;
      } else if (filter === 'الحد الأقصى') {
        return exp.date >= getDaysAgo(365);
      }
      return true;
    });
  }, [expenses, filter, filterStartDate, filterEndDate]);

  const toggleAnalysisPage = (pageName: string) => {
    setExpandedAnalysisPages(prev => ({ ...prev, [pageName]: !prev[pageName] }));
  };

  const toggleAnalysisBranch = (branchKey: string) => {
    setExpandedAnalysisBranches(prev => ({ ...prev, [branchKey]: !prev[branchKey] }));
  };

  const toggleAnalysisSubcat = (subcatKey: string) => {
    setExpandedAnalysisSubcats(prev => ({ ...prev, [subcatKey]: !prev[subcatKey] }));
  };

  const analysisStats = React.useMemo(() => {
    // 1. Resolve product hierarchy helper
    const resolveProductHierarchy = (prodName: string) => {
      const prod = allProducts.find(p => p.name === prodName);
      if (!prod) return { page: 'عامة (بدون بيج)', branch: 'غير محدد', subcat: 'بدون فئة فرعية' };

      const cat = allCategories.find(c => c.id === prod.categoryId);
      if (!cat) return { page: 'عامة (بدون بيج)', branch: 'غير محدد', subcat: 'بدون فئة فرعية' };

      const pg = pages.find(p => p.id === cat.pageId);
      const pageName = pg ? pg.name : 'عامة (بدون بيج)';
      const branchName = cat.name || 'غير محدد';

      let subcatName = 'بدون فئة فرعية';
      if (prod.subcategoryId && cat.subcategories) {
        const sub = cat.subcategories.find((s: any) => s.id === prod.subcategoryId);
        if (sub) subcatName = sub.name;
      }

      return { page: pageName, branch: branchName, subcat: subcatName };
    };

    // 2. Initialize tree data structure
    const tree: Record<string, {
      name: string;
      revenue: number;
      expenses: number;
      deliveryCost: number;
      netProfit: number;
      deliveredOrdersCount: number;
      branches: Record<string, {
        name: string;
        revenue: number;
        expenses: number;
        netProfit: number;
        subcategories: Record<string, {
          name: string;
          revenue: number;
          expenses: number;
          netProfit: number;
          items: Record<string, {
            name: string;
            revenue: number;
            expenses: number;
            netProfit: number;
          }>
        }>
      }>
    }> = {};

    // Helper to ensure path exists in tree
    const ensurePath = (page: string, branch: string, subcat: string, item: string) => {
      if (!tree[page]) {
        tree[page] = {
          name: page,
          revenue: 0,
          expenses: 0,
          deliveryCost: 0,
          netProfit: 0,
          deliveredOrdersCount: 0,
          branches: {}
        };
      }
      const p = tree[page];
      if (!p.branches[branch]) {
        p.branches[branch] = {
          name: branch,
          revenue: 0,
          expenses: 0,
          netProfit: 0,
          subcategories: {}
        };
      }
      const b = p.branches[branch];
      if (!b.subcategories[subcat]) {
        b.subcategories[subcat] = {
          name: subcat,
          revenue: 0,
          expenses: 0,
          netProfit: 0,
          items: {}
        };
      }
      const s = b.subcategories[subcat];
      if (!s.items[item]) {
        s.items[item] = {
          name: item,
          revenue: 0,
          expenses: 0,
          netProfit: 0
        };
      }
    };

    // 3. Accumulate revenues from settled orders
    filteredOrders.forEach((order: any) => {
      const isSettledOrPartial = order.is_settled === true || order.paymentStatus === 'partially_settled';
      if (!isSettledOrPartial) return;

      // 3.1 Get items to process, ensuring we don't lose orders with empty items
      let itemsToProcess = (order.items && Array.isArray(order.items) && order.items.length > 0) 
        ? order.items 
        : [{ name: 'غير مصنف', quantity: 1, unitPrice: order.totalAmount || 0 }];

      let orderItemsTotal = itemsToProcess.reduce((sum: number, it: any) => {
        const iQty = Number(it.quantity) || 1; // Treat qty 0 as 1 for proportion
        const iPrice = Number(it.unitPrice) || Number(it.price) || 0;
        return sum + (iQty * iPrice);
      }, 0);

      // If all items have 0 price, distribute evenly
      let fallbackProportion = false;
      if (orderItemsTotal === 0) {
        orderItemsTotal = itemsToProcess.length;
        fallbackProportion = true;
      }

      const orderTotalAmount = Number(order.totalAmount) || 0;

      // 3.2 Distribute to pages and items
      itemsToProcess.forEach((item: any) => {
        const pName = item.productName || item.name || 'غير مصنف';
        
        const hierarchy = resolveProductHierarchy(pName);
        ensurePath(hierarchy.page, hierarchy.branch, hierarchy.subcat, pName);

        const qty = Number(item.quantity) || 1;
        const price = Number(item.unitPrice) || Number(item.price) || 0;
        const itemTotal = fallbackProportion ? 1 : (qty * price);

        // Proportional share of this item in the entire order
        const proportion = itemTotal / orderItemsTotal;
        const allocatedRevenue = proportion * orderTotalAmount;

        // Page level nodes (proportional share of gross totalAmount and order count)
        const pGrp = tree[hierarchy.page];
        pGrp.deliveredOrdersCount += proportion;
        pGrp.revenue += allocatedRevenue;

        // Branch/Subcategory/Item level nodes
        const bGrp = pGrp.branches[hierarchy.branch];
        const sGrp = bGrp.subcategories[hierarchy.subcat];
        const iGrp = sGrp.items[pName];

        bGrp.revenue += allocatedRevenue;
        sGrp.revenue += allocatedRevenue;
        iGrp.revenue += allocatedRevenue;
      });
    });

    // 4. Accumulate expenses
    filteredExpenses.forEach(exp => {
      const expAmount = Number(exp.amount) || 0; // assuming IQD
      
      const pageKey = exp.pageName || 'عامة (بدون بيج)';
      const branchKey = exp.branchName || '';
      const itemKey = exp.itemName || '';
      
      let subcatKey = '';
      if (itemKey) {
        subcatKey = resolveProductHierarchy(itemKey).subcat;
      }

      if (!tree[pageKey]) {
        tree[pageKey] = {
          name: pageKey,
          revenue: 0,
          expenses: 0,
          deliveryCost: 0,
          netProfit: 0,
          deliveredOrdersCount: 0,
          branches: {}
        };
      }
      const pGrp = tree[pageKey];
      pGrp.expenses += expAmount;

      if (branchKey) {
        if (!pGrp.branches[branchKey]) {
          pGrp.branches[branchKey] = {
            name: branchKey,
            revenue: 0,
            expenses: 0,
            netProfit: 0,
            subcategories: {}
          };
        }
        const bGrp = pGrp.branches[branchKey];
        bGrp.expenses += expAmount;

        const finalSubcatKey = subcatKey || 'بدون فئة فرعية';
        if (!bGrp.subcategories[finalSubcatKey]) {
          bGrp.subcategories[finalSubcatKey] = {
            name: finalSubcatKey,
            revenue: 0,
            expenses: 0,
            netProfit: 0,
            items: {}
          };
        }
        const sGrp = bGrp.subcategories[finalSubcatKey];
        sGrp.expenses += expAmount;

        if (itemKey) {
          if (!sGrp.items[itemKey]) {
            sGrp.items[itemKey] = {
              name: itemKey,
              revenue: 0,
              expenses: 0,
              netProfit: 0
            };
          }
          const iGrp = sGrp.items[itemKey];
          iGrp.expenses += expAmount;
        }
      }
    });

    // 5. Finalize Net Profit calculations for all nodes (No COGS subtraction) and round to nearest whole IQD
    Object.values(tree).forEach(page => {
      page.revenue = Math.round(page.revenue);
      page.expenses = Math.round(page.expenses);
      page.netProfit = page.revenue - page.expenses;

      Object.values(page.branches).forEach(branch => {
        branch.revenue = Math.round(branch.revenue);
        branch.expenses = Math.round(branch.expenses);
        branch.netProfit = branch.revenue - branch.expenses;

        Object.values(branch.subcategories).forEach(subcat => {
          subcat.revenue = Math.round(subcat.revenue);
          subcat.expenses = Math.round(subcat.expenses);
          subcat.netProfit = subcat.revenue - subcat.expenses;

          Object.values(subcat.items).forEach(item => {
            item.revenue = Math.round(item.revenue);
            item.expenses = Math.round(item.expenses);
            item.netProfit = item.revenue - item.expenses;
          });
        });
      });
    });

    return tree;
  }, [allProducts, allCategories, pages, filteredOrders, filteredExpenses]);

  const overallStats = React.useMemo(() => {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalNetProfit = 0;

    let deliveredCount = 0;
    let deliveredAmount = 0;
    let returnedCount = 0;
    let returnedAmount = 0;

    filteredOrders.forEach((o: any) => {
      const isDelivered = o.status === 'delivered' || o.status === 'completed' || o.is_settled === true || o.paymentStatus === 'partially_settled';
      const isReturned = o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse' || o.returnStatus === 'in_warehouse';
      
      const amt = Number(o.totalAmount) || 0;
      if (isDelivered) {
        deliveredCount++;
        deliveredAmount += amt;
      }
      if (isReturned) {
        returnedCount++;
        returnedAmount += amt;
      }
    });

    Object.values(analysisStats).forEach((page: any) => {
      totalRevenue += page.revenue || 0;
      totalExpenses += page.expenses || 0;
      totalNetProfit += page.netProfit || 0;
    });

    const activeTotal = deliveredCount + returnedCount;
    const deliveredPct = activeTotal > 0 ? Math.round((deliveredCount / activeTotal) * 100) : (filteredOrders.length > 0 ? 100 : 0);
    const returnedPct = activeTotal > 0 ? Math.round((returnedCount / activeTotal) * 100) : 0;

    return {
      totalRevenue,
      totalExpenses,
      totalNetProfit,
      deliveredCount,
      deliveredAmount,
      deliveredPct,
      returnedCount,
      returnedAmount,
      returnedPct,
      totalOrders: filteredOrders.length
    };
  }, [analysisStats, filteredOrders]);

  const [animatedRate, setAnimatedRate] = useState(0);
  const [animatedReturnRate, setAnimatedReturnRate] = useState(0);
  const [animatedProgressRate, setAnimatedProgressRate] = useState(0);
  const [animatedCancelledRate, setAnimatedCancelledRate] = useState(0);

  useEffect(() => {
    if (!loading) {
      setAnimatedRate(0);
      setAnimatedReturnRate(0);
      setAnimatedProgressRate(0);
      setAnimatedCancelledRate(0);
      const timer = setTimeout(() => {
        setAnimatedRate(gaugeStats.deliveryRate);
        setAnimatedReturnRate(gaugeStats.returnRate);
        setAnimatedProgressRate(gaugeStats.inProgressRate);
        setAnimatedCancelledRate(gaugeStats.cancelledRate);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [gaugeStats.deliveryRate, gaugeStats.returnRate, gaugeStats.inProgressRate, gaugeStats.cancelledRate, loading]);

  if (loading) {
    return (
      <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            borderTopColor: '#38bdf8',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          <span>جاري تحميل لوحة القيادة...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>لوحة القيادة</h1>
          <div className={styles.filters}>
            <div className={styles.teamDatePickerContainer} ref={filterCalRef}>
                <button 
                  className={styles.teamDateRangeBtn} 
                  onClick={toggleMainCal}
                >
                  📅 {getMainDateRangeLabel()}
                </button>
                
                {isFilterCalOpen && (
                  <div className={styles.teamDateModal}>
                    <div className={styles.teamShortcutList}>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempMainFilter === 'اليوم' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectMainShortcut('اليوم')}
                      >
                        اليوم
                      </button>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempMainFilter === 'الأسبوع' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectMainShortcut('الأسبوع')}
                      >
                        الأسبوع
                      </button>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempMainFilter === 'الشهر' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectMainShortcut('الشهر')}
                      >
                        الشهر
                      </button>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempMainFilter === 'الحد الأقصى' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectMainShortcut('الحد الأقصى')}
                      >
                        الحد الأقصى
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <select 
                        className={styles.teamDateInput} 
                        style={{ padding: '0.5rem', flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                        value={
                          tempMainStart && tempMainEnd && 
                          new Date(tempMainStart).getDate() === 1 && 
                          new Date(tempMainEnd).getDate() === new Date(new Date(tempMainStart).getFullYear(), new Date(tempMainStart).getMonth() + 1, 0).getDate() && 
                          new Date(tempMainStart).getMonth() === new Date(tempMainEnd).getMonth() &&
                          new Date(tempMainStart).getFullYear() === new Date(tempMainEnd).getFullYear() 
                          ? new Date(tempMainStart).getMonth() + 1 : ""
                        }
                        onChange={(e) => {
                          const year = tempMainStart ? new Date(tempMainStart).getFullYear() : new Date().getFullYear();
                          const month = parseInt(e.target.value);
                          if (isNaN(month)) return;
                          const start = new Date(year, month - 1, 1);
                          const end = new Date(year, month, 0);
                          
                          const formatObj = (d: Date) => {
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            return `${y}-${m}-${day}`;
                          };
                          setTempMainFilter('مخصص');
                          handleCustomMainDateChange('start', formatObj(start));
                          handleCustomMainDateChange('end', formatObj(end));
                        }}
                      >
                        <option value="" style={{ color: 'black' }}>اختر الشهر...</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m} style={{ color: 'black' }}>شهر {m}</option>
                        ))}
                      </select>

                      <select 
                        className={styles.teamDateInput} 
                        style={{ padding: '0.5rem', flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                        value={tempMainStart ? new Date(tempMainStart).getFullYear() : new Date().getFullYear()}
                        onChange={(e) => {
                          const year = parseInt(e.target.value);
                          const month = tempMainStart ? new Date(tempMainStart).getMonth() : new Date().getMonth();
                          const start = new Date(year, month, 1);
                          const end = new Date(year, month + 1, 0);
                          
                          const formatObj = (d: Date) => {
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            return `${y}-${m}-${day}`;
                          };
                          setTempMainFilter('مخصص');
                          handleCustomMainDateChange('start', formatObj(start));
                          handleCustomMainDateChange('end', formatObj(end));
                        }}
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                          <option key={y} value={y} style={{ color: 'black' }}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.teamDateInputs}>
                      <div className={styles.teamDateInputGroup}>
                        <label>من تاريخ:</label>
                        <input 
                          type="date" 
                          className={styles.teamDateInput} 
                          value={tempMainStart} 
                          onChange={e => handleCustomMainDateChange('start', e.target.value)} 
                        />
                      </div>
                      <div className={styles.teamDateInputGroup}>
                        <label>إلى تاريخ:</label>
                        <input 
                          type="date" 
                          className={styles.teamDateInput} 
                          value={tempMainEnd} 
                          onChange={e => handleCustomMainDateChange('end', e.target.value)} 
                        />
                      </div>
                    </div>

                    <div className={styles.teamModalActions}>
                      <button 
                        className={styles.teamApplyBtn} 
                        onClick={handleApplyMainFilter}
                      >
                        تم
                      </button>
                      <button 
                        className={styles.teamCancelBtn} 
                        onClick={handleCancelMainFilter}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>

        <div className={styles.dashboardGrid}>
          {/* Card 1 */}
          <div className={`${styles.card} ${styles.colSpan5} ${styles.salesCard}`}>
            <div className={styles.salesHeader}>
              <div className={styles.salesTitleContainer} style={{ flexDirection: 'row', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <select 
                  style={{ background: 'var(--surface-light)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  value={salesCardViewType} 
                  onChange={(e) => setSalesCardViewType(e.target.value as 'sales' | 'orders')}
                >
                  <option value="sales">المبيعات</option>
                  <option value="orders">عدد الطلبات</option>
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    style={{ background: 'var(--surface-light)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    value={salesCardYear} 
                    onChange={(e) => setSalesCardYear(Number(e.target.value))}
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select 
                    style={{ background: 'var(--surface-light)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    value={salesCardMonth} 
                    onChange={(e) => setSalesCardMonth(Number(e.target.value))}
                  >
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>شهر {m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.chartContainer}>
              <div className={styles.chartYAxis}>
                <span>{yAxisLabels.top}</span>
                <span>{yAxisLabels.mid}</span>
                <span>{yAxisLabels.bottom}</span>
              </div>
              <svg className={styles.salesChartSvg} viewBox="0 0 500 180" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="salesBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#c084fc" />
                    <stop offset="30%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="rgba(168, 85, 247, 0.05)" />
                  </linearGradient>
                </defs>

                {/* Apple-style horizontal dashed gridlines corresponding to Top, Mid, Bottom */}
                <line x1="0" y1="8" x2="500" y2="8" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <line x1="0" y1="84" x2="500" y2="84" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <line x1="0" y1="160" x2="500" y2="160" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                {/* Render the bars */}
                {svgChartPath.barPaths.map((bar, i) => bar.path && (
                  <path
                    key={`path-${i}`}
                    d={bar.path}
                    fill="url(#salesBarGradient)"
                    className={styles.chartBarPath}
                  />
                ))}

                {/* Render Values on top of bars */}
                {svgChartPath.barPaths.map((bar, i) => {
                  if (bar.val === 0) return null;
                  
                  const displayVal = bar.val >= 1000000 
                    ? (bar.val / 1000000).toFixed(1) + 'm' 
                    : bar.val >= 1000 
                    ? (bar.val / 1000).toFixed(1) + 'k' 
                    : bar.val.toString();

                  return (
                    <text
                      key={`val-${i}`}
                      x={bar.x}
                      y={bar.y - 4}
                      textAnchor="middle"
                      fill="rgba(255, 255, 255, 0.6)"
                      fontSize="8"
                      fontWeight="600"
                    >
                      {displayVal}
                    </text>
                  );
                })}

                {/* Render X-Axis weekday/period labels */}
                {svgChartPath.barPaths.map((bar, i) => (
                  <text
                    key={`lbl-${i}`}
                    x={bar.x}
                    y="173"
                    textAnchor="middle"
                    fill="rgba(255, 255, 255, 0.3)"
                     fontSize="9"
                     fontWeight="700"
                   >
                      {bar.label}
                   </text>
                 ))}
               </svg>
             </div>

            <div className={styles.salesFooter}>
              <div className={styles.salesValueContainer}>
                <div className={styles.salesValueRow}>
                  <span className={styles.salesValueText}>
                    {salesCardViewType === 'sales' ? `${salesCardData.total.toLocaleString()} د.ع` : `${salesCardData.total.toLocaleString()} طلب`}
                  </span>
                  {(() => {
                    const trend = salesCardData.prevTotal === 0 
                      ? (salesCardData.total > 0 ? 100 : 0)
                      : Math.round(((salesCardData.total - salesCardData.prevTotal) / salesCardData.prevTotal) * 10000) / 100;
                    return (
                      <span className={`${styles.salesTrendBadge} ${trend >= 0 ? styles.salesTrendUp : styles.salesTrendDown}`}>
                        {trend >= 0 ? '▲' : '▼'} {trend >= 0 ? '+' : ''}{Math.abs(trend)}%
                      </span>
                    );
                  })()}
                </div>
                <div className={styles.salesStatusLabel}>
                  <span>{salesCardViewType === 'sales' ? 'إجمالي المبيعات الواصلة' : 'إجمالي عدد الطلبات'} في شهر {salesCardMonth}</span>
                  <svg className={styles.checkboxIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <rect x="3" y="3" width="18" height="18" rx="4" fill="rgba(16, 185, 129, 0.1)" stroke="#10b981" />
                    <path d="M9 12l2 2 4-4" stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div className={styles.salesActions}>
                <button className={styles.btnBuy}>التفاصيل</button>
                <button className={styles.btnSell}>تصدير</button>
              </div>
            </div>
          </div>

          {/* Card 2 & 2.5 Combined: Delivery and Return Rates */}
          <div className={`${styles.card} ${styles.colSpan2} ${isGaugeCalOpen ? styles.elevatedCard : ''}`} style={{ display: 'flex', flexDirection: 'column', minHeight: '220px', padding: '1.5rem', justifyContent: 'space-between' }}>
            <div className={`${styles.cardHeader} ${styles.gaugeCardHeader}`} style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>إحصائيات التوصيل والراجع</span>
              
              <div className={styles.teamDatePickerContainer} ref={gaugeCalRef}>
                <button 
                  className={styles.teamDateRangeBtn} 
                  onClick={toggleGaugeCal}
                >
                  📅 {getGaugeDateRangeLabel()}
                </button>
                
                {isGaugeCalOpen && (
                  <div className={styles.teamDateModal}>
                    <div className={styles.teamShortcutList}>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempGaugeFilter === 'اليوم' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectGaugeShortcut('اليوم')}
                      >
                        اليوم
                      </button>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempGaugeFilter === 'الأسبوع' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectGaugeShortcut('الأسبوع')}
                      >
                        الأسبوع
                      </button>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempGaugeFilter === 'الشهر' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectGaugeShortcut('الشهر')}
                      >
                        الشهر
                      </button>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempGaugeFilter === 'الحد الأقصى' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectGaugeShortcut('الحد الأقصى')}
                      >
                        الحد الأقصى
                      </button>
                    </div>
                    
                    <div className={styles.teamDateInputs}>
                      <div className={styles.teamDateInputGroup}>
                        <label>من تاريخ:</label>
                        <input 
                          type="date" 
                          className={styles.teamDateInput} 
                          value={tempGaugeStartDate} 
                          onChange={e => handleGaugeCustomDateChange('start', e.target.value)} 
                        />
                      </div>
                      <div className={styles.teamDateInputGroup}>
                        <label>إلى تاريخ:</label>
                        <input 
                          type="date" 
                          className={styles.teamDateInput} 
                          value={tempGaugeEndDate} 
                          onChange={e => handleGaugeCustomDateChange('end', e.target.value)} 
                        />
                      </div>
                    </div>

                    <div className={styles.teamModalActions}>
                      <button 
                        className={styles.teamApplyBtn} 
                        onClick={handleApplyGaugeFilter}
                      >
                        تم
                      </button>
                      <button 
                        className={styles.teamCancelBtn} 
                        onClick={handleCancelGaugeFilter}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '1rem' }}>
              
              {/* Green Gauge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 0.5rem' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '105px', display: 'flex', justifySelf: 'center', alignItems: 'flex-end' }}>
                  <svg viewBox="0 0 200 130" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#d1fae5" />
                        <stop offset="50%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#6ee7b7" />
                      </linearGradient>
                      
                      <filter id="glow-soft" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      
                      <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Track path */}
                    <path d="M 25 100 A 75 75 0 0 1 175 100" 
                          fill="none" stroke="#2a2a35" strokeWidth="16" strokeLinecap="butt" />

                    {/* Active progress path */}
                    <path 
                      className={styles.progressBar} 
                      d="M 25 100 A 75 75 0 0 1 175 100" 
                      fill="none" 
                      stroke="url(#greenGradient)" 
                      strokeWidth="16" 
                      strokeLinecap="butt" 
                      pathLength="100"
                      strokeDasharray="100" 
                      strokeDashoffset={100 - animatedRate} 
                      filter="url(#glow-soft)" 
                    />

                    {/* Concentric rings */}
                    <circle cx="100" cy="100" r="40" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.3" />
                    <circle cx="100" cy="100" r="30" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.5" />
                    <circle cx="100" cy="100" r="20" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.8" />

                    {/* Needle group */}
                    <g 
                      className={styles.needleGroup} 
                      style={{ 
                        transform: `translate(100px, 100px) rotate(${(animatedRate / 100) * 180 - 90}deg)`
                      }}
                    >
                      <polygon points="-9,0 9,0 0,-83" 
                               fill="rgba(16, 185, 129, 0.4)" 
                               stroke="#d1fae5" strokeWidth="1.5" 
                               filter="drop-shadow(0 0 5px rgba(16, 185, 129, 0.9))" />
                    </g>

                    {/* Pivot center */}
                    <circle cx="100" cy="100" r="12" fill="#064e3b" stroke="#6ee7b7" strokeWidth="3" filter="url(#glow-strong)" />
                    <circle cx="100" cy="100" r="4" fill="#ffffff" filter="url(#glow-strong)" />
                  </svg>
                </div>
                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fff', textShadow: '0 0 10px rgba(16,185,129,0.4)', lineHeight: 1 }}>
                    {gaugeStats.deliveredCount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, marginTop: '4px' }}>طلب واصل</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontWeight: 600 }}>
                  نسبة التوصيل {animatedRate}%
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: '1px', height: '110px', backgroundColor: 'rgba(255,255,255,0.06)' }}></div>

              {/* Red Gauge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 0.5rem' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '105px', display: 'flex', justifySelf: 'center', alignItems: 'flex-end' }}>
                  <svg viewBox="0 0 200 130" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#fee2e2" />
                        <stop offset="50%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#f87171" />
                      </linearGradient>
                      
                      <filter id="glow-soft-red" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      
                      <filter id="glow-strong-red" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Track path */}
                    <path d="M 25 100 A 75 75 0 0 1 175 100" 
                          fill="none" stroke="#2a2a35" strokeWidth="16" strokeLinecap="butt" />

                    {/* Active progress path */}
                    <path 
                      className={styles.progressBar} 
                      d="M 25 100 A 75 75 0 0 1 175 100" 
                      fill="none" 
                      stroke="url(#redGradient)" 
                      strokeWidth="16" 
                      strokeLinecap="butt" 
                      pathLength="100"
                      strokeDasharray="100" 
                      strokeDashoffset={100 - animatedReturnRate} 
                      filter="url(#glow-soft-red)" 
                    />

                    {/* Concentric rings */}
                    <circle cx="100" cy="100" r="40" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.3" />
                    <circle cx="100" cy="100" r="30" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.5" />
                    <circle cx="100" cy="100" r="20" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.8" />

                    {/* Needle group */}
                    <g 
                      className={styles.needleGroup} 
                      style={{ 
                        transform: `translate(100px, 100px) rotate(${(animatedReturnRate / 100) * 180 - 90}deg)`
                      }}
                    >
                      <polygon points="-9,0 9,0 0,-83" 
                               fill="rgba(239, 68, 68, 0.4)" 
                               stroke="#fee2e2" strokeWidth="1.5" 
                               filter="drop-shadow(0 0 5px rgba(239, 68, 68, 0.9))" />
                    </g>

                    {/* Pivot center */}
                    <circle cx="100" cy="100" r="12" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="3" filter="url(#glow-strong-red)" />
                    <circle cx="100" cy="100" r="4" fill="#ffffff" filter="url(#glow-strong-red)" />
                  </svg>
                </div>
                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fff', textShadow: '0 0 10px rgba(239,68,68,0.4)', lineHeight: 1 }}>
                    {gaugeStats.returnedCount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, marginTop: '4px' }}>طلب راجع</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontWeight: 600 }}>
                  نسبة الراجع {animatedReturnRate}%
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '1rem', marginTop: '1.5rem' }}>
              {/* Yellow Gauge (In Progress) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 0.5rem' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '105px', display: 'flex', justifySelf: 'center', alignItems: 'flex-end' }}>
                  <svg viewBox="0 0 200 130" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#fef3c7" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#fbbf24" />
                      </linearGradient>
                      <filter id="glow-soft-yellow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      <filter id="glow-strong-yellow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    <path d="M 25 100 A 75 75 0 0 1 175 100" fill="none" stroke="#2a2a35" strokeWidth="16" strokeLinecap="butt" />
                    <path className={styles.progressBar} d="M 25 100 A 75 75 0 0 1 175 100" fill="none" stroke="url(#yellowGradient)" strokeWidth="16" strokeLinecap="butt" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - animatedProgressRate} filter="url(#glow-soft-yellow)" />
                    <circle cx="100" cy="100" r="40" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.3" />
                    <circle cx="100" cy="100" r="30" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
                    <circle cx="100" cy="100" r="20" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />
                    <g className={styles.needleGroup} style={{ transform: `translate(100px, 100px) rotate(${(animatedProgressRate / 100) * 180 - 90}deg)` }}>
                      <polygon points="-9,0 9,0 0,-83" fill="rgba(245, 158, 11, 0.4)" stroke="#fef3c7" strokeWidth="1.5" filter="drop-shadow(0 0 5px rgba(245, 158, 11, 0.9))" />
                    </g>
                    <circle cx="100" cy="100" r="12" fill="#78350f" stroke="#fcd34d" strokeWidth="3" filter="url(#glow-strong-yellow)" />
                    <circle cx="100" cy="100" r="4" fill="#ffffff" filter="url(#glow-strong-yellow)" />
                  </svg>
                </div>
                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fff', textShadow: '0 0 10px rgba(245,158,11,0.4)', lineHeight: 1 }}>{gaugeStats.inProgressCount.toLocaleString()}</div>
                  <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700, marginTop: '4px' }}>قيد التوصيل ومؤجل</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontWeight: 600 }}>النسبة {animatedProgressRate}%</div>
              </div>

              <div style={{ width: '1px', height: '110px', backgroundColor: 'rgba(255,255,255,0.06)' }}></div>

              {/* Gray Gauge (Cancelled) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 0.5rem' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '105px', display: 'flex', justifySelf: 'center', alignItems: 'flex-end' }}>
                  <svg viewBox="0 0 200 130" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="grayGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f3f4f6" />
                        <stop offset="50%" stopColor="#9ca3af" />
                        <stop offset="100%" stopColor="#d1d5db" />
                      </linearGradient>
                      <filter id="glow-soft-gray" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      <filter id="glow-strong-gray" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    <path d="M 25 100 A 75 75 0 0 1 175 100" fill="none" stroke="#2a2a35" strokeWidth="16" strokeLinecap="butt" />
                    <path className={styles.progressBar} d="M 25 100 A 75 75 0 0 1 175 100" fill="none" stroke="url(#grayGradient)" strokeWidth="16" strokeLinecap="butt" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - animatedCancelledRate} filter="url(#glow-soft-gray)" />
                    <circle cx="100" cy="100" r="40" fill="none" stroke="#9ca3af" strokeWidth="1" opacity="0.3" />
                    <circle cx="100" cy="100" r="30" fill="none" stroke="#9ca3af" strokeWidth="1" opacity="0.5" />
                    <circle cx="100" cy="100" r="20" fill="none" stroke="#9ca3af" strokeWidth="1.5" opacity="0.8" />
                    <g className={styles.needleGroup} style={{ transform: `translate(100px, 100px) rotate(${(animatedCancelledRate / 100) * 180 - 90}deg)` }}>
                      <polygon points="-9,0 9,0 0,-83" fill="rgba(156, 163, 175, 0.4)" stroke="#f3f4f6" strokeWidth="1.5" filter="drop-shadow(0 0 5px rgba(156, 163, 175, 0.9))" />
                    </g>
                    <circle cx="100" cy="100" r="12" fill="#374151" stroke="#d1d5db" strokeWidth="3" filter="url(#glow-strong-gray)" />
                    <circle cx="100" cy="100" r="4" fill="#ffffff" filter="url(#glow-strong-gray)" />
                  </svg>
                </div>
                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fff', textShadow: '0 0 10px rgba(156,163,175,0.4)', lineHeight: 1 }}>{gaugeStats.cancelledCount.toLocaleString()}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 700, marginTop: '4px' }}>حذف وإلغاء</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontWeight: 600 }}>النسبة {animatedCancelledRate}%</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.75rem' }}>
              إجمالي الطلبات في هذه الفترة: <strong style={{ color: '#fff' }}>{gaugeStats.totalOrdersCount.toLocaleString()} طلب</strong>
            </div>
          </div>



          {/* Team Performance */}
          <div className={`${styles.card} ${styles.colSpan7} ${styles.rowSpan2} ${isTeamCalOpen ? styles.elevatedCard : ''}`}>
            <div className={styles.cardHeader}>
              <span>{teamViewMode === 'team' ? `أداء الفريق (${teamStats.length} موظف نشط)` : `أداء صفحات الهبوط (${teamStats.length} صفحة نشطة)`}</span>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select 
                  style={{ background: 'var(--surface-light)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}
                  value={teamViewMode} 
                  onChange={(e) => setTeamViewMode(e.target.value as 'team' | 'landing_pages')}
                >
                  <option value="team">أداء الفريق</option>
                  <option value="landing_pages">أداء صفحات الهبوط</option>
                </select>

                <div className={styles.teamDatePickerContainer} ref={teamCalRef}>
                <button 
                  className={styles.teamDateRangeBtn} 
                  onClick={toggleTeamCal}
                >
                  📅 {getTeamDateRangeLabel()}
                </button>
                
                {isTeamCalOpen && (
                  <div className={styles.teamDateModal}>
                    <div className={styles.teamShortcutList}>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempFilter === 'اليوم' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectTeamShortcut('اليوم')}
                      >
                        اليوم
                      </button>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempFilter === 'الأسبوع' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectTeamShortcut('الأسبوع')}
                      >
                        الأسبوع
                      </button>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempFilter === 'الشهر' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectTeamShortcut('الشهر')}
                      >
                        الشهر
                      </button>
                      <button 
                        className={`${styles.teamShortcutBtn} ${tempFilter === 'الحد الأقصى' ? styles.activeShortcut : ''}`} 
                        onClick={() => selectTeamShortcut('الحد الأقصى')}
                      >
                        الحد الأقصى
                      </button>
                    </div>
                    
                    <div className={styles.teamDateInputs}>
                      <div className={styles.teamDateInputGroup}>
                        <label>من تاريخ:</label>
                        <input 
                          type="date" 
                          className={styles.teamDateInput} 
                          value={tempStartDate} 
                          onChange={e => handleCustomDateChange('start', e.target.value)} 
                        />
                      </div>
                      <div className={styles.teamDateInputGroup}>
                        <label>إلى تاريخ:</label>
                        <input 
                          type="date" 
                          className={styles.teamDateInput} 
                          value={tempEndDate} 
                          onChange={e => handleCustomDateChange('end', e.target.value)} 
                        />
                      </div>
                    </div>

                    {/* Apply & Cancel Actions */}
                    <div className={styles.teamModalActions}>
                      <button 
                        className={styles.teamApplyBtn} 
                        onClick={handleApplyTeamFilter}
                      >
                        تم
                      </button>
                      <button 
                        className={styles.teamCancelBtn} 
                        onClick={handleCancelTeamFilter}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
            
            <div className={styles.teamScrollRow}>
              {teamStats.length > 0 ? (
                teamStats.map((emp) => {
                  const firstLetter = emp.name.charAt(0);
                  const total = emp.total || 1;
                  const delPct = Math.round((emp.delivered / total) * 100);
                  const retPct = Math.round((emp.returned / total) * 100);
                  const penPct = Math.round((emp.pending / total) * 100);

                  return (
                    <div key={emp.name} className={styles.employeeCard}>
                      {/* Card Header */}
                      <div className={styles.employeeHeader}>
                        <div className={styles.employeeInfo}>
                          <div className={styles.employeeName}>{emp.name}</div>
                          <div className={styles.employeeTotalOrders}>
                            {emp.total} :إجمالي الطلبات
                          </div>
                        </div>
                      </div>

                      {/* Chart Columns */}
                      <div className={styles.chartColumns}>
                        {/* Delivered (واصل) */}
                        <div className={styles.columnContainer}>
                          <div className={styles.columnValue} style={{ color: '#10b981' }}>{emp.delivered}</div>
                          <div className={styles.columnPercent} style={{ color: '#10b981' }}>({delPct}%)</div>
                          <div className={styles.verticalBarTrack}>
                            <div 
                              className={`${styles.verticalBarFill} ${styles.barDelivered}`} 
                              style={{ height: `${delPct || 3}%` }}
                            />
                          </div>
                          <div className={styles.iconCircle} style={{ borderColor: 'rgba(16, 185, 129, 0.4)', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                            <svg className={styles.statusSvg} style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className={styles.columnLabel}>واصل</div>
                        </div>

                        {/* Returned (راجع) */}
                        <div className={styles.columnContainer}>
                          <div className={styles.columnValue} style={{ color: '#ef4444' }}>{emp.returned}</div>
                          <div className={styles.columnPercent} style={{ color: '#ef4444' }}>({retPct}%)</div>
                          <div className={styles.verticalBarTrack}>
                            <div 
                              className={`${styles.verticalBarFill} ${styles.barReturned}`} 
                              style={{ height: `${retPct || 3}%` }}
                            />
                          </div>
                          <div className={styles.iconCircle} style={{ borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                            <svg className={styles.statusSvg} style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </div>
                          <div className={styles.columnLabel}>راجع</div>
                        </div>

                        {/* Pending (قيد) */}
                        <div className={styles.columnContainer}>
                          <div className={styles.columnValue} style={{ color: '#f59e0b' }}>{emp.pending}</div>
                          <div className={styles.columnPercent} style={{ color: '#f59e0b' }}>({penPct}%)</div>
                          <div className={styles.verticalBarTrack}>
                            <div 
                              className={`${styles.verticalBarFill} ${styles.barPending}`} 
                              style={{ height: `${penPct || 3}%` }}
                            />
                          </div>
                          <div className={styles.iconCircle} style={{ borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                            <svg className={styles.statusSvg} style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                          <div className={styles.columnLabel}>قيد</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ width: '100%', textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  لا توجد طلبات للموظفين في هذه الفترة!
                </div>
              )}
            </div>

            {/* Bottom Legend */}
            <div className={styles.legendContainer}>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: '#10b981' }} />
                <span>واصل</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: '#f59e0b' }} />
                <span>قيد</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: '#ef4444' }} />
                <span>راجع</span>
              </div>
            </div>
          </div>

          {/* Card 4: Product Profit & Loss Analysis */}
          <div className={`${styles.card} ${styles.colSpan7}`} style={{ marginTop: '1rem' }}>
            <div className={styles.cardHeader}>
              <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#fff' }}>📊 شجرة تحليل الأرباح والخسائر والأداء (البيج ⬅️ الفئة ⬅️ الصنف)</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>صافي الربح = الإيرادات من الكشوفات - المصاريف المباشرة</span>
            </div>

            <div className={styles.treeSection} style={{ border: 'none', paddingTop: 0 }}>
              {/* Overall Summary Panel */}
              <div className={styles.summaryStatsRow} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {/* 1. الواصل */}
                <div className={styles.summaryStatCard} style={{ borderRight: '3px solid #10b981', background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(0,0,0,0.2) 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={styles.summaryStatLabel}>🟢 الواصل (الطلبات المقبوضة)</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      ↗️ {overallStats.deliveredPct}%
                    </span>
                  </div>
                  <span className={styles.summaryStatValue} style={{ color: '#10b981', marginTop: '0.3rem' }}>
                    {overallStats.totalRevenue.toLocaleString()} د.ع
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>
                    📦 {overallStats.deliveredCount} طلب واصل ومستلم
                  </div>
                </div>

                {/* 2. الراجع */}
                <div className={styles.summaryStatCard} style={{ borderRight: '3px solid #ef4444', background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(0,0,0,0.2) 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={styles.summaryStatLabel}>🔴 الراجع (المرتجع)</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      ↘️ {overallStats.returnedPct}%
                    </span>
                  </div>
                  <span className={styles.summaryStatValue} style={{ color: '#ef4444', marginTop: '0.3rem' }}>
                    {overallStats.returnedAmount.toLocaleString()} د.ع
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>
                    ↩️ {overallStats.returnedCount} طلب مرتجع
                  </div>
                </div>

                {/* 3. المصاريف المباشرة */}
                <div className={styles.summaryStatCard} style={{ borderRight: '3px solid #c084fc', background: 'linear-gradient(135deg, rgba(192,132,252,0.08) 0%, rgba(0,0,0,0.2) 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={styles.summaryStatLabel}>💸 المصاريف المباشرة</span>
                    <span style={{ fontSize: '0.75rem', color: '#c084fc' }}>تكاليف</span>
                  </div>
                  <span className={styles.summaryStatValue} style={{ color: '#c084fc', marginTop: '0.3rem' }}>
                    {overallStats.totalExpenses.toLocaleString()} د.ع
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>
                    🧾 إجمالي التكاليف التشغيلية
                  </div>
                </div>

                {/* 4. صافي الأرباح الكلية */}
                <div className={styles.summaryStatCard} style={{ borderRight: `3px solid ${overallStats.totalNetProfit >= 0 ? '#10b981' : '#ef4444'}`, background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={styles.summaryStatLabel}>📈 صافي الأرباح الكلية</span>
                    <span style={{ fontSize: '0.75rem', color: overallStats.totalNetProfit >= 0 ? '#10b981' : '#ef4444' }}>
                      {overallStats.totalNetProfit >= 0 ? 'ربح صافي 💎' : 'خسارة ⚠️'}
                    </span>
                  </div>
                  <span className={styles.summaryStatValue} style={{ color: overallStats.totalNetProfit >= 0 ? '#10b981' : '#ef4444', marginTop: '0.3rem' }}>
                    {overallStats.totalNetProfit >= 0 ? '+' : ''}{overallStats.totalNetProfit.toLocaleString()} د.ع
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>
                    الإيرادات - المصاريف المباشرة
                  </div>
                </div>
              </div>

              <div className={styles.treeContainer} style={{ marginTop: '1rem' }}>
                {Object.values(analysisStats).map(page => {
                  const pageKey = page.name;
                  const isPageExpanded = !!expandedAnalysisPages[pageKey];
                  const hasBranches = Object.keys(page.branches).length > 0;

                  return (
                    <div key={pageKey} className={styles.treeNode}>
                      <div 
                        className={`${styles.nodeHeader} ${styles.pageNode}`}
                        onClick={() => hasBranches && toggleAnalysisPage(pageKey)}
                        style={{ cursor: hasBranches ? 'pointer' : 'default' }}
                      >
                        <div className={styles.nodeLeft}>
                          {hasBranches && <span className={styles.arrowIcon}>{isPageExpanded ? '▼' : '▶'}</span>}
                          <span className={styles.nodeName}>🏢 {page.name}</span>
                        </div>
                        <div className={styles.nodeAmount}>
                          <span className={styles.revenueText}>
                            مبيعات: <span dir="ltr">{page.revenue.toLocaleString()}</span> د.ع
                          </span>
                          <span className={styles.expensesText} style={{ color: '#c084fc' }}>
                            مصاريف: <span dir="ltr">{page.expenses.toLocaleString()}</span> د.ع
                          </span>
                          <span className={page.netProfit >= 0 ? styles.profitText : styles.lossText}>
                            الصافي: <span dir="ltr">{page.netProfit >= 0 ? '+' : ''}{page.netProfit.toLocaleString()}</span> د.ع
                          </span>
                        </div>
                      </div>

                      {isPageExpanded && hasBranches && (
                        <div className={styles.nodeChildren}>
                          {Object.values(page.branches).map(branch => {
                            const branchKey = `${pageKey}::${branch.name}`;
                            const isBranchExpanded = !!expandedAnalysisBranches[branchKey];
                            const hasSubcats = Object.keys(branch.subcategories).length > 0;

                            return (
                              <div key={branchKey} className={styles.treeNode}>
                                <div 
                                  className={`${styles.nodeHeader} ${styles.branchNode}`}
                                  onClick={() => hasSubcats && toggleAnalysisBranch(branchKey)}
                                  style={{ cursor: hasSubcats ? 'pointer' : 'default' }}
                                >
                                  <div className={styles.nodeLeft}>
                                    {hasSubcats && <span className={styles.arrowIcon}>{isBranchExpanded ? '▼' : '▶'}</span>}
                                    <span className={styles.nodeName}>🌿 {branch.name}</span>
                                  </div>
                                  <div className={styles.nodeAmount}>
                                    <span className={styles.revenueText}>
                                      مبيعات: <span dir="ltr">{branch.revenue.toLocaleString()}</span> د.ع
                                    </span>
                                    <span className={styles.expensesText} style={{ color: '#c084fc' }}>
                                      مصاريف: <span dir="ltr">{branch.expenses.toLocaleString()}</span> د.ع
                                    </span>
                                    <span className={branch.netProfit >= 0 ? styles.profitText : styles.lossText}>
                                      الصافي: <span dir="ltr">{branch.netProfit >= 0 ? '+' : ''}{branch.netProfit.toLocaleString()}</span> د.ع
                                    </span>
                                  </div>
                                </div>

                                {isBranchExpanded && hasSubcats && (
                                  <div className={styles.nodeChildren}>
                                    {Object.values(branch.subcategories).map(subcat => {
                                      const subcatKey = `${branchKey}::${subcat.name}`;
                                      const isSubcatExpanded = !!expandedAnalysisSubcats[subcatKey];
                                      const hasItems = Object.keys(subcat.items).length > 0;

                                      return (
                                        <div key={subcatKey} className={styles.treeNode}>
                                          <div 
                                            className={`${styles.nodeHeader} ${styles.subcatNode}`}
                                            onClick={() => hasItems && toggleAnalysisSubcat(subcatKey)}
                                            style={{ cursor: hasItems ? 'pointer' : 'default' }}
                                          >
                                            <div className={styles.nodeLeft}>
                                              {hasItems && <span className={styles.arrowIcon}>{isSubcatExpanded ? '▼' : '▶'}</span>}
                                              <span className={styles.nodeName}>🍂 {subcat.name}</span>
                                            </div>
                                            <div className={styles.nodeAmount}>
                                              <span className={styles.revenueText}>
                                                مبيعات: <span dir="ltr">{subcat.revenue.toLocaleString()}</span> د.ع
                                              </span>
                                              <span className={styles.expensesText} style={{ color: '#c084fc' }}>
                                                مصاريف: <span dir="ltr">{subcat.expenses.toLocaleString()}</span> د.ع
                                              </span>
                                              <span className={subcat.netProfit >= 0 ? styles.profitText : styles.lossText}>
                                                الصافي: <span dir="ltr">{subcat.netProfit >= 0 ? '+' : ''}{subcat.netProfit.toLocaleString()}</span> د.ع
                                              </span>
                                            </div>
                                          </div>

                                          {isSubcatExpanded && hasItems && (
                                            <div className={styles.nodeChildren}>
                                              {Object.values(subcat.items).map(item => (
                                                <div key={item.name} className={`${styles.nodeHeader} ${styles.itemNode}`}>
                                                  <div className={styles.nodeLeft}>
                                                    <span className={styles.nodeName}>🏷️ {item.name}</span>
                                                  </div>
                                                  <div className={styles.nodeAmount}>
                                                    <span className={styles.revenueText}>
                                                      مبيعات: <span dir="ltr">{item.revenue.toLocaleString()}</span> د.ع
                                                    </span>
                                                    <span className={styles.expensesText} style={{ color: '#c084fc' }}>
                                                      مصاريف: <span dir="ltr">{item.expenses.toLocaleString()}</span> د.ع
                                                    </span>
                                                    <span className={item.netProfit >= 0 ? styles.profitText : styles.lossText}>
                                                      الصافي: <span dir="ltr">{item.netProfit >= 0 ? '+' : ''}{item.netProfit.toLocaleString()}</span> د.ع
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}