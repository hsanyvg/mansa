"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { db } from '../lib/firebase';
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
  const [loading, setLoading] = useState(true);

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
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
    });

    // Listen to products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
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

    return () => {
      unsubOrders();
      unsubProducts();
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
      .filter(o => o.status === 'delivered')
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
          <div className={`${styles.card} ${styles.colSpan2}`}>
            <div className={styles.cardHeader}>
              <span>إجمالي المبيعات (الواصلة)</span>
            </div>
            <div className={styles.cardValue} style={{ color: '#10b981' }}>{stats.totalSales.toLocaleString()} د.ع</div>
            <div className={`${styles.trend} ${styles.up}`}>
              <span>📈 {filter}</span>
              <span style={{ color: 'var(--text-muted)' }}>حركات مستلمة ومكتملة</span>
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
                          <div className={styles.columnValue} style={{ color: '#5704d4' }}>{emp.delivered}</div>
                          <div className={styles.columnPercent} style={{ color: '#5704d4' }}>({delPct}%)</div>
                          <div className={styles.verticalBarTrack}>
                            <div 
                              className={`${styles.verticalBarFill} ${styles.barDelivered}`} 
                              style={{ height: `${delPct || 3}%` }}
                            />
                          </div>
                          <div className={styles.iconCircle} style={{ borderColor: 'rgba(87, 4, 212, 0.4)', backgroundColor: 'rgba(87, 4, 212, 0.1)' }}>
                            <svg className={styles.statusSvg} style={{ color: '#5704d4' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className={styles.columnLabel}>واصل</div>
                        </div>

                        {/* Returned (راجع) */}
                        <div className={styles.columnContainer}>
                          <div className={styles.columnValue} style={{ color: '#eb054a' }}>{emp.returned}</div>
                          <div className={styles.columnPercent} style={{ color: '#eb054a' }}>({retPct}%)</div>
                          <div className={styles.verticalBarTrack}>
                            <div 
                              className={`${styles.verticalBarFill} ${styles.barReturned}`} 
                              style={{ height: `${retPct || 3}%` }}
                            />
                          </div>
                          <div className={styles.iconCircle} style={{ borderColor: 'rgba(235, 5, 74, 0.4)', backgroundColor: 'rgba(235, 5, 74, 0.1)' }}>
                            <svg className={styles.statusSvg} style={{ color: '#eb054a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </div>
                          <div className={styles.columnLabel}>راجع</div>
                        </div>

                        {/* Pending (قيد) */}
                        <div className={styles.columnContainer}>
                          <div className={styles.columnValue} style={{ color: '#eb059e' }}>{emp.pending}</div>
                          <div className={styles.columnPercent} style={{ color: '#eb059e' }}>({penPct}%)</div>
                          <div className={styles.verticalBarTrack}>
                            <div 
                              className={`${styles.verticalBarFill} ${styles.barPending}`} 
                              style={{ height: `${penPct || 3}%` }}
                            />
                          </div>
                          <div className={styles.iconCircle} style={{ borderColor: 'rgba(235, 5, 158, 0.4)', backgroundColor: 'rgba(235, 5, 158, 0.1)' }}>
                            <svg className={styles.statusSvg} style={{ color: '#eb059e' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
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
                <span className={styles.legendDot} style={{ backgroundColor: '#5704d4' }} />
                <span>واصل</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: '#eb059e' }} />
                <span>قيد</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: '#eb054a' }} />
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
        </div>
      </main>
    </div>
  );
}