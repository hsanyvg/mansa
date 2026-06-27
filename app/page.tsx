"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot } from 'firebase/firestore';

export default function Dashboard() {
  const [filter, setFilter] = useState('هذا الشهر');
  const [teamFilter, setTeamFilter] = useState('الشهر');
  const [teamStartDate, setTeamStartDate] = useState('');
  const [teamEndDate, setTeamEndDate] = useState('');
  const [isTeamCalOpen, setIsTeamCalOpen] = useState(false);
  const teamCalRef = useRef<HTMLDivElement>(null);
  
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
      } else if (filter === 'هذا الأسبوع') {
        return orderTime >= thisWeek;
      } else if (filter === 'هذا الشهر') {
        return orderTime >= thisMonth;
      } else if (filter === 'هذا العام') {
        return orderTime >= thisYear;
      }
      return true;
    });
  }, [orders, filter]);

  const stats = React.useMemo(() => {
    const activeOrders = filteredOrders.filter(o => o.status !== 'cancelled');
    const totalSales = filteredOrders
      .filter(o => o.is_settled === true)
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
        if (teamStartDate) {
          const [yr, mo, dy] = teamStartDate.split('-').map(Number);
          start = new Date(yr, mo - 1, dy, 0, 0, 0, 0).getTime();
        }
        let end = Infinity;
        if (teamEndDate) {
          const [yr, mo, dy] = teamEndDate.split('-').map(Number);
          end = new Date(yr, mo - 1, dy, 23, 59, 59, 999).getTime();
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
      empStats.total += 1;
      if (order.status === 'delivered') {
        empStats.delivered += 1;
      } else if (order.status === 'returned') {
        empStats.returned += 1;
      } else if (order.status !== 'cancelled') {
        empStats.pending += 1;
      }
    });

    const empList = Array.from(empMap.values());
    // Sort primarily by total orders, and secondarily alphabetically by name
    empList.sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.name.localeCompare(b.name, 'ar');
    });
    return empList;
  }, [orders, teamFilteredOrders]);

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

  const salesTrendData = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const points: { value: number; time?: number; label: string }[] = [];

    const getStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    if (filter === 'اليوم') {
      // 12 blocks of 2 hours for today (00:00, 02:00, ..., 22:00)
      for (let i = 0; i < 12; i++) {
        const hour = i * 2;
        const label = hour === 0 ? '12ص' : hour === 12 ? '12م' : hour < 12 ? `${hour}ص` : `${hour - 12}م`;
        points.push({ value: 0, label });
      }
      filteredOrders.forEach(order => {
        if (order.is_settled !== true || !order.date) return;
        const date = order.date.toDate ? order.date.toDate() : new Date(order.date);
        const hour = date.getHours();
        const blockIndex = Math.min(11, Math.floor(hour / 2));
        points[blockIndex].value += Number(order.totalAmount) || 0;
      });
    } else if (filter === 'هذا الأسبوع') {
      // Last 7 days
      const days = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        points.push({ value: 0, time: getStartOfDay(d), label: days[d.getDay()] });
      }
      filteredOrders.forEach(order => {
        if (order.is_settled !== true || !order.date) return;
        const orderTime = order.date.toDate ? order.date.toDate().getTime() : new Date(order.date).getTime();
        const orderDayStart = getStartOfDay(new Date(orderTime));
        const point = points.find(p => p.time === orderDayStart);
        if (point) {
          point.value += Number(order.totalAmount) || 0;
        }
      });
    } else if (filter === 'هذا الشهر') {
      // Last 15 days or last 30 days
      for (let i = 14; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 2 * 24 * 60 * 60 * 1000);
        points.push({ value: 0, time: getStartOfDay(d), label: `${d.getDate()}` });
      }
      filteredOrders.forEach(order => {
        if (order.is_settled !== true || !order.date) return;
        const orderTime = order.date.toDate ? order.date.toDate().getTime() : new Date(order.date).getTime();
        const orderDayStart = getStartOfDay(new Date(orderTime));
        let minDiff = Infinity;
        let closestIndex = 0;
        points.forEach((p, idx) => {
          const diff = Math.abs(orderDayStart - p.time!);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = idx;
          }
        });
        if (minDiff <= 2 * 24 * 60 * 60 * 1000) {
          points[closestIndex].value += Number(order.totalAmount) || 0;
        }
      });
    } else {
      // هذا العام: last 12 months
      const monthsShort = ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس'];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        points.push({ value: 0, time: d.getTime(), label: monthsShort[d.getMonth()] });
      }
      filteredOrders.forEach(order => {
        if (order.is_settled !== true || !order.date) return;
        const date = order.date.toDate ? order.date.toDate() : new Date(order.date);
        const yr = date.getFullYear();
        const mo = date.getMonth();
        points.forEach(p => {
          const d = new Date(p.time!);
          if (d.getFullYear() === yr && d.getMonth() === mo) {
            p.value += Number(order.totalAmount) || 0;
          }
        });
      });
    }

    return points;
  }, [filteredOrders, filter]);

  const svgChartPath = React.useMemo(() => {
    const width = 500;
    const height = 115;
    const padding = 8;
    const chartWidth = width;
    const chartHeight = 87; // drawing height range (95 - 8)

    if (salesTrendData.length === 0) {
      return { 
        barPaths: [],
        maxVal: 0,
        minVal: 0
      };
    }

    const values = salesTrendData.map(p => p.value);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const range = maxVal - minVal;

    const slotWidth = chartWidth / salesTrendData.length;
    const barWidth = Math.min(24, Math.max(6, slotWidth * 0.45));
    const r = Math.min(5, barWidth / 2);
    const baseline = 95;

    const barPaths = salesTrendData.map((point, idx) => {
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
  }, [salesTrendData]);

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
    } else if (filter === 'هذا الأسبوع') {
      currentStart = today - oneWeek;
      prevStart = today - 2 * oneWeek;
      prevEnd = today - oneWeek;
    } else if (filter === 'هذا الشهر') {
      currentStart = today - oneMonth;
      prevStart = today - 2 * oneMonth;
      prevEnd = today - oneMonth;
    } else if (filter === 'هذا العام') {
      currentStart = today - oneYear;
      prevStart = today - 2 * oneYear;
      prevEnd = today - oneYear;
    } else {
      return 0;
    }

    const currentSales = orders
      .filter(o => {
        if (o.is_settled !== true || !o.date) return false;
        const oTime = o.date.toDate ? o.date.toDate().getTime() : new Date(o.date).getTime();
        return oTime >= currentStart;
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    const prevSales = orders
      .filter(o => {
        if (o.is_settled !== true || !o.date) return false;
        const oTime = o.date.toDate ? o.date.toDate().getTime() : new Date(o.date).getTime();
        return oTime >= prevStart && oTime < prevEnd;
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    if (prevSales === 0) {
      return currentSales > 0 ? 100 : 0;
    }
    return Math.round(((currentSales - prevSales) / prevSales) * 10000) / 100;
  }, [orders, filter]);

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
        if (gaugeStartDate) {
          const [yr, mo, dy] = gaugeStartDate.split('-').map(Number);
          start = new Date(yr, mo - 1, dy, 0, 0, 0, 0).getTime();
        }
        let end = Infinity;
        if (gaugeEndDate) {
          const [yr, mo, dy] = gaugeEndDate.split('-').map(Number);
          end = new Date(yr, mo - 1, dy, 23, 59, 59, 999).getTime();
        }
        return orderTime >= start && orderTime <= end;
      }
      return true;
    });
  }, [orders, gaugeFilter, gaugeStartDate, gaugeEndDate]);

  const gaugeStats = React.useMemo(() => {
    const activeOrders = gaugeFilteredOrders.filter(o => o.status !== 'cancelled');
    const total = activeOrders.length;
    if (total === 0) return { activeOrdersCount: 0, deliveryRate: 0 };
    const delivered = gaugeFilteredOrders.filter(o => o.status === 'delivered').length;
    const rate = Math.round((delivered / total) * 100);
    return {
      activeOrdersCount: total,
      deliveryRate: rate
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
      } else if (filter === 'هذا الأسبوع') {
        return exp.date >= getDaysAgo(7);
      } else if (filter === 'هذا الشهر') {
        return exp.date >= getDaysAgo(30);
      } else if (filter === 'هذا العام') {
        return exp.date >= getDaysAgo(365);
      }
      return true;
    });
  }, [expenses, filter]);

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
    filteredOrders.forEach(order => {
      if (order.is_settled !== true) return;

      // 3.1 Calculate total of all items in this order to scale proportionally
      const orderItemsTotal = (order.items || []).reduce((sum: number, it: any) => {
        const iQty = Number(it.quantity) || 0;
        const iPrice = Number(it.unitPrice) || Number(it.price) || 0;
        return sum + (iQty * iPrice);
      }, 0) || 1;

      const orderTotalAmount = Number(order.totalAmount) || 0;

      // 3.2 Distribute to pages and items
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const pName = item.productName || item.name;
          if (!pName) return;

          const hierarchy = resolveProductHierarchy(pName);
          ensurePath(hierarchy.page, hierarchy.branch, hierarchy.subcat, pName);

          const qty = Number(item.quantity) || 0;
          const price = Number(item.unitPrice) || Number(item.price) || 0;
          const itemTotal = qty * price;

          // Proportional share of this item in the entire order
          const proportion = itemTotal / orderItemsTotal;

          // Page level nodes (proportional share of gross totalAmount and order count)
          const pGrp = tree[hierarchy.page];
          pGrp.deliveredOrdersCount += proportion;
          pGrp.revenue += proportion * orderTotalAmount;

          // Branch/Subcategory/Item level nodes
          const bGrp = pGrp.branches[hierarchy.branch];
          const sGrp = bGrp.subcategories[hierarchy.subcat];
          const iGrp = sGrp.items[pName];

          bGrp.revenue += itemTotal;
          sGrp.revenue += itemTotal;
          iGrp.revenue += itemTotal;
        });
      }
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

    Object.values(analysisStats).forEach((page: any) => {
      totalRevenue += page.revenue || 0;
      totalExpenses += page.expenses || 0;
      totalNetProfit += page.netProfit || 0;
    });

    return {
      totalRevenue,
      totalExpenses,
      totalNetProfit
    };
  }, [analysisStats]);

  const [animatedRate, setAnimatedRate] = useState(0);


  useEffect(() => {
    if (!loading) {
      setAnimatedRate(0);
      const timer = setTimeout(() => {
        setAnimatedRate(gaugeStats.deliveryRate);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [gaugeStats.deliveryRate, loading]);

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
            {['اليوم', 'هذا الأسبوع', 'هذا الشهر', 'هذا العام'].map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
            <div className={styles.datePicker}>
              <span>{getDateRangeLabel()}</span>
            </div>
          </div>
        </div>

        <div className={styles.dashboardGrid}>
          {/* Card 1 */}
          <div className={`${styles.card} ${styles.colSpan2} ${styles.salesCard}`}>
            <div className={styles.salesHeader}>
              <div className={styles.salesTitleContainer}>
                <div className={styles.salesTitle}>إجمالي المبيعات (الواصلة)</div>
                <div className={styles.salesSub}>Mansa Sales</div>
              </div>
              <div className={styles.salesFiltersContainer}>
                {['اليوم', 'هذا الأسبوع', 'هذا الشهر', 'هذا العام'].map((f) => {
                  const label = f === 'اليوم' ? '1D' : f === 'هذا الأسبوع' ? '1W' : f === 'هذا الشهر' ? '1M' : '1Y';
                  return (
                    <button
                      key={f}
                      className={`${styles.salesFilterBtn} ${filter === f ? styles.salesFilterBtnActive : ''}`}
                      onClick={() => setFilter(f)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.chartContainer}>
              <div className={styles.chartYAxis}>
                <span>{yAxisLabels.top}</span>
                <span>{yAxisLabels.mid}</span>
                <span>{yAxisLabels.bottom}</span>
              </div>
              <svg className={styles.salesChartSvg} viewBox="0 0 500 115" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="salesBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#c084fc" />
                    <stop offset="30%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="rgba(168, 85, 247, 0.05)" />
                  </linearGradient>
                </defs>

                {/* Apple-style horizontal dashed gridlines corresponding to Top, Mid, Bottom */}
                <line x1="0" y1="8" x2="500" y2="8" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <line x1="0" y1="51.5" x2="500" y2="51.5" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <line x1="0" y1="95" x2="500" y2="95" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                {/* Render the bars */}
                {svgChartPath.barPaths.map((bar, i) => bar.path && (
                  <path
                    key={i}
                    d={bar.path}
                    fill="url(#salesBarGradient)"
                    className={styles.chartBarPath}
                  />
                ))}

                {/* Render X-Axis weekday/period labels */}
                {svgChartPath.barPaths.map((bar, i) => (
                  <text
                    key={`lbl-${i}`}
                    x={bar.x}
                    y="108"
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
                  <span className={styles.salesValueText}>{stats.totalSales.toLocaleString()} د.ع</span>
                  <span className={`${styles.salesTrendBadge} ${salesTrendPercentage >= 0 ? styles.salesTrendUp : styles.salesTrendDown}`}>
                    {salesTrendPercentage >= 0 ? '▲' : '▼'} {salesTrendPercentage >= 0 ? '+' : ''}{Math.abs(salesTrendPercentage)}%
                  </span>
                </div>
                <div className={styles.salesStatusLabel}>
                  <span>حركات مستلمة ومكتملة</span>
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

          {/* Card 2 */}
          <div className={`${styles.card} ${styles.gaugeCard} ${isGaugeCalOpen ? styles.elevatedCard : ''}`}>
            <div className={`${styles.cardHeader} ${styles.gaugeCardHeader}`}>
              <span>الطلبات النشطة (نسبة التوصيل)</span>
              
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
            
            <div className={styles.gaugeContainer}>
              <svg viewBox="0 0 200 130" className={styles.gaugeSvg}>
                <defs>
                  <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f3e8ff" />
                    <stop offset="50%" stopColor="#a435e8" />
                    <stop offset="100%" stopColor="#49159e" />
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
                  stroke="url(#purpleGradient)" 
                  strokeWidth="16" 
                  strokeLinecap="butt" 
                  strokeDasharray="235.62" 
                  strokeDashoffset={235.62 - (235.62 * animatedRate) / 100} 
                  filter="url(#glow-soft)" 
                />

                {/* Concentric rings */}
                <circle cx="100" cy="100" r="40" fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.3" />
                <circle cx="100" cy="100" r="30" fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.5" />
                <circle cx="100" cy="100" r="20" fill="none" stroke="#a855f7" strokeWidth="1.5" opacity="0.8" />

                {/* Needle group */}
                <g 
                  className={styles.needleGroup} 
                  style={{ 
                    transform: `translate(100px, 100px) rotate(${(animatedRate / 100) * 180 - 90}deg)`
                  }}
                >
                  <polygon points="-9,0 9,0 0,-83" 
                           fill="rgba(192, 132, 252, 0.4)" 
                           stroke="#f3e8ff" strokeWidth="1.5" 
                           filter="drop-shadow(0 0 5px rgba(168, 85, 247, 0.9))" />
                </g>

                {/* Pivot center */}
                <circle cx="100" cy="100" r="12" fill="#4b04b5" stroke="#d8b4fe" strokeWidth="3" filter="url(#glow-strong)" />
                <circle cx="100" cy="100" r="4" fill="#ffffff" filter="url(#glow-strong)" />
              </svg>
            </div>

            <div className={styles.gaugeValue}>{animatedRate}%</div>

            <div className={styles.gaugeDescription}>
              📦 {gaugeStats.activeOrdersCount} طلب نشط {getGaugeDescriptionLabel()}
            </div>
          </div>

          {/* Card 3 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span>المنتجات النشطة</span>
            </div>
            <div className={styles.cardValue}>{productsCount.toLocaleString()}</div>
            <div className={`${styles.trend} ${styles.up}`} style={{ color: '#a855f7' }}>
              <span>🛍️ في الكتالوج</span>
            </div>
          </div>

          {/* Team Performance */}
          <div className={`${styles.card} ${styles.colSpan2} ${styles.rowSpan2} ${isTeamCalOpen ? styles.elevatedCard : ''}`}>
            <div className={styles.cardHeader}>
              <span>أداء الفريق ({teamStats.length} موظف نشط)</span>
              
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

          {/* Inventory Status */}
          <div className={`${styles.card} ${styles.colSpan2} ${styles.rowSpan2}`}>
            <div className={styles.cardHeader}>
              <span>حالة المخزون الكلي</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center', marginTop: '1rem' }}>
              <div className={styles.donutContainer}>
                <div className={styles.donutText}>
                  <div className={styles.donutValue}>{stockPercent}%</div>
                  <div className={styles.donutLabel}>متوفر بالمخزن</div>
                </div>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-hover)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#10B981" strokeWidth="10" strokeDasharray="314" strokeDashoffset={314 - (314 * stockPercent) / 100} strokeLinecap="round" transform="rotate(-90 60 60)" />
                </svg>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              عدد المنتجات المتوفرة: <strong>{inStockCount}</strong> من أصل <strong>{productsCount}</strong> منتج
            </div>
          </div>

          {/* Card 4: Product Profit & Loss Analysis */}
          <div className={`${styles.card} ${styles.colSpan4}`} style={{ marginTop: '1rem' }}>
            <div className={styles.cardHeader}>
              <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#fff' }}>📊 شجرة تحليل الأرباح والخسائر والأداء (البيج ⬅️ الفئة ⬅️ الصنف)</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>صافي الربح = الإيرادات من الكشوفات - المصاريف المباشرة</span>
            </div>

            <div className={styles.treeSection} style={{ border: 'none', paddingTop: 0 }}>
              {/* Overall Summary Panel */}
              <div className={styles.summaryStatsRow} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className={styles.summaryStatCard}>
                  <span className={styles.summaryStatLabel}>💰 إجمالي المبيعات (الواصلة)</span>
                  <span className={styles.summaryStatValue} style={{ color: '#60a5fa' }}>{overallStats.totalRevenue.toLocaleString()} د.ع</span>
                </div>
                <div className={styles.summaryStatCard}>
                  <span className={styles.summaryStatLabel}>💸 إجمالي المصاريف المباشرة</span>
                  <span className={styles.summaryStatValue} style={{ color: '#c084fc' }}>{overallStats.totalExpenses.toLocaleString()} د.ع</span>
                </div>
                <div className={styles.summaryStatCard}>
                  <span className={styles.summaryStatLabel}>📈 صافي الأرباح الكلية</span>
                  <span className={styles.summaryStatValue} style={{ color: overallStats.totalNetProfit >= 0 ? '#10b981' : '#ef4444' }}>
                    {overallStats.totalNetProfit >= 0 ? '+' : ''}{overallStats.totalNetProfit.toLocaleString()} د.ع
                  </span>
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
                          <span className={styles.revenueText}>مبيعات: {page.revenue.toLocaleString()} د.ع</span>
                          <span className={styles.expensesText} style={{ color: '#c084fc' }}>مصاريف: {page.expenses.toLocaleString()} د.ع</span>
                          <span className={page.netProfit >= 0 ? styles.profitText : styles.lossText}>
                            الصافي: {page.netProfit >= 0 ? '+' : ''}{page.netProfit.toLocaleString()} د.ع
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
                                    <span className={styles.revenueText}>مبيعات: {branch.revenue.toLocaleString()} د.ع</span>
                                    <span className={styles.expensesText} style={{ color: '#c084fc' }}>مصاريف: {branch.expenses.toLocaleString()} د.ع</span>
                                    <span className={branch.netProfit >= 0 ? styles.profitText : styles.lossText}>
                                      الصافي: {branch.netProfit >= 0 ? '+' : ''}{branch.netProfit.toLocaleString()} د.ع
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
                                              <span className={styles.revenueText}>مبيعات: {subcat.revenue.toLocaleString()} د.ع</span>
                                              <span className={styles.expensesText} style={{ color: '#c084fc' }}>مصاريف: {subcat.expenses.toLocaleString()} د.ع</span>
                                              <span className={subcat.netProfit >= 0 ? styles.profitText : styles.lossText}>
                                                الصافي: {subcat.netProfit >= 0 ? '+' : ''}{subcat.netProfit.toLocaleString()} د.ع
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
                                                    <span className={styles.revenueText}>مبيعات: {item.revenue.toLocaleString()} د.ع</span>
                                                    <span className={styles.expensesText} style={{ color: '#c084fc' }}>مصاريف: {item.expenses.toLocaleString()} د.ع</span>
                                                    <span className={item.netProfit >= 0 ? styles.profitText : styles.lossText}>
                                                      الصافي: {item.netProfit >= 0 ? '+' : ''}{item.netProfit.toLocaleString()} د.ع
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