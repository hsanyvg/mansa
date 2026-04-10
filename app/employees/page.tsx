"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../lib/firebase';
import DateRangePicker from '../../components/DateRangePicker';
import { 
  collection, 
  onSnapshot, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy,
  writeBatch,
  where,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

interface Employee {
  id: string;
  name: string;
  basicSalary: number;
  commissionRate: number;
  paymentType: string;
  isActive: boolean;
  trackAbsence: boolean;
  joinDate?: string | null;
  createdAt: any;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Tabs State
  const [activeTab, setActiveTab] = useState<'management' | 'payroll' | 'attendance'>('management');

  // Attendance State
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedAttendanceEmployee, setSelectedAttendanceEmployee] = useState<Employee | null>(null);
  const [archiveData, setArchiveData] = useState<any[]>([]);
  const [viewArchiveRecord, setViewArchiveRecord] = useState<any | null>(null);
  const [archiveOrders, setArchiveOrders] = useState<any[]>([]);
  const [loadingArchiveOrders, setLoadingArchiveOrders] = useState(false);
  const [archiveOrdersSearch, setArchiveOrdersSearch] = useState('');
  const [archiveTab, setArchiveTab] = useState<'active' | 'final'>('active');

  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>(() => {
    const d = new Date();
    return {
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth(), d.getDate())
    };
  });
  const [attendanceData, setAttendanceData] = useState<{
    days: { date: string, dayNum: number, isPresent: boolean, isOverride: boolean }[],
    totalPresent: number,
    totalAbsent: number,
    deliveredOrders: number,
    totalCommission: number,
    pendingOrdersCount: number,
    expectedCommission: number
  }>({ 
    days: [], 
    totalPresent: 0, 
    totalAbsent: 0, 
    deliveredOrders: 0, 
    totalCommission: 0,
    pendingOrdersCount: 0,
    expectedCommission: 0
  });
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Global Payroll State
  const [globalPayrollData, setGlobalPayrollData] = useState<Record<string, any>>({});
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [ordersSnapshot, setOrdersSnapshot] = useState<any[]>([]);
  const [overridesSnapshot, setOverridesSnapshot] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    basicSalary: '0',
    commissionRate: '0',
    paymentType: 'salary',
    isActive: true,
    trackAbsence: true,
    joinDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(data);
    });
    return () => unsubscribe();
  }, []);

  const showToastMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      setEditingId(employee.id);
      setFormData({
        name: employee.name,
        basicSalary: employee.basicSalary?.toString() || '0',
        commissionRate: employee.commissionRate?.toString() || '0',
        paymentType: employee.paymentType || 'salary',
        isActive: employee.isActive ?? true,
        trackAbsence: employee.trackAbsence ?? true,
        joinDate: employee.joinDate || new Date().toISOString().split('T')[0]
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        basicSalary: '0',
        commissionRate: '0',
        paymentType: 'salary',
        isActive: true,
        trackAbsence: true,
        joinDate: new Date().toISOString().split('T')[0]
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      showToastMsg("اسم الموظف حقل إجباري", "error");
      return;
    }

    try {
      const batch = writeBatch(db);
      const basicSal = parseFloat(formData.basicSalary) || 0;
      const commRate = parseFloat(formData.commissionRate) || 0;

      if (editingId) {
        const employeeRef = doc(db, 'employees', editingId);
        batch.update(employeeRef, {
          name: formData.name,
          basicSalary: basicSal,
          commissionRate: commRate,
          paymentType: formData.paymentType,
          isActive: formData.isActive,
          trackAbsence: formData.trackAbsence,
          joinDate: formData.joinDate
        });
        await batch.commit();
        showToastMsg("تم تحديث بيانات الموظف بنجاح");
      } else {
        const employeeRef = doc(collection(db, 'employees'));
        batch.set(employeeRef, {
          name: formData.name,
          basicSalary: basicSal,
          commissionRate: commRate,
          paymentType: formData.paymentType,
          isActive: formData.isActive,
          trackAbsence: formData.trackAbsence,
          joinDate: formData.joinDate,
          createdAt: serverTimestamp()
        });
        await batch.commit();
        showToastMsg("تم إضافة الموظف بنجاح");
      }
      setShowModal(false);
    } catch (error) {
      console.error("Error saving employee:", error);
      showToastMsg("حدث خطأ أثناء الحفظ", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الموظف "${name}"؟ هذا الإجراء قد يسبب مشاكل في تقارير الرواتب القديمة المرتبطة به.`)) return;
    
    try {
      await deleteDoc(doc(db, 'employees', id));
      showToastMsg("تم حذف الموظف بنجاح");
    } catch (error) {
      console.error("Error deleting employee:", error);
      showToastMsg("حدث خطأ أثناء الحذف", "error");
    }
  };



  useEffect(() => {
    if ((!showAttendanceModal && !showPayrollModal) || !selectedAttendanceEmployee) return;

    setLoadingAttendance(true);
    
    // Listen to Orders
    const ordersQ = query(
      collection(db, 'orders'),
      where('employeeId', '==', selectedAttendanceEmployee.id),
      where('date', '>=', dateRange.start),
      where('date', '<=', new Date(dateRange.end.getTime() + 86400000)) // Incl. end day
    );

    const unsubOrders = onSnapshot(ordersQ, (ordersSnap) => {
      // Listen to Overrides
      const overridesQ = query(
        collection(db, 'attendance_overrides'),
        where('employeeId', '==', selectedAttendanceEmployee.id),
        where('date', '>=', dateRange.start.toISOString().split('T')[0]),
        where('date', '<=', dateRange.end.toISOString().split('T')[0])
      );

      const unsubOverrides = onSnapshot(overridesQ, (overridesSnap) => {
        const activeDays = new Set<string>();
        ordersSnap.forEach(doc => {
          const d = doc.data().date?.toDate();
          if (d) activeDays.add(d.toISOString().split('T')[0]);
        });

        const overridesMap = new Map<string, boolean>();
        overridesSnap.forEach(doc => {
          const data = doc.data();
          overridesMap.set(data.date, data.isPresent);
        });

        // Calculate days logic
        const daysList = [];
        let presentCount = 0;
        let absentCount = 0;
        
        let iterDate = new Date(dateRange.start);
        const endIter = new Date(dateRange.end);
        
        while (iterDate <= endIter) {
          const dateKey = iterDate.toISOString().split('T')[0];
          let isPresent = false;
          let isOverride = false;

          const joinDateStr = selectedAttendanceEmployee.joinDate;
          const isBeforeJoin = joinDateStr && dateKey < joinDateStr;

          if (overridesMap.has(dateKey)) {
            isPresent = overridesMap.get(dateKey)!;
            isOverride = true;
          } else if (isBeforeJoin) {
            // New fix: any day before join date is automatically "present" (or at least not absent)
            isPresent = true;
          } else if (selectedAttendanceEmployee.trackAbsence ?? true) {
            // Auto calculate based on orders
            if (activeDays.has(dateKey)) {
              isPresent = true;
            }
          } else {
            // Fixed staff: always present unless explicitly overridden to absent
            isPresent = true;
          }

          if (isPresent) presentCount++; else absentCount++;

          daysList.push({
            date: dateKey,
            dayNum: iterDate.getDate(),
            isPresent,
            isOverride
          });
          
          iterDate.setDate(iterDate.getDate() + 1);
        }

        // Commission Logic
        const deliveredOrders = ordersSnap.docs.filter(d => d.data().status === 'delivered').length;
        const pendingOrders = ordersSnap.docs.filter(d => ['processing', 'shipped', 'pending'].includes(d.data().status)).length;
        const commissionPerOrder = selectedAttendanceEmployee.commissionRate || 0;
        
        setAttendanceData({
          days: daysList,
          totalPresent: presentCount,
          totalAbsent: absentCount,
          deliveredOrders,
          totalCommission: deliveredOrders * commissionPerOrder,
          pendingOrdersCount: pendingOrders,
          expectedCommission: pendingOrders * commissionPerOrder
        });
        setLoadingAttendance(false);
      });

      return () => unsubOverrides();
    });

    return () => unsubOrders();
  }, [showAttendanceModal, selectedAttendanceEmployee, dateRange]);

  // --- Data Fetching Listeners for Global Payroll ---
  useEffect(() => {
    if (activeTab === 'management') return;
    
    setLoadingPayroll(true);
    const ordersQ = query(
      collection(db, 'orders'),
      where('date', '>=', dateRange.start),
      where('date', '<=', new Date(dateRange.end.getTime() + 86400000))
    );

    return onSnapshot(ordersQ, (snap) => {
      setOrdersSnapshot(snap.docs);
    }, (error) => {
      console.error("Orders Snapshot Error:", error);
      setLoadingPayroll(false);
    });
  }, [dateRange, activeTab]);

  useEffect(() => {
    if (activeTab === 'management') return;
    
    const overridesQ = query(
      collection(db, 'attendance_overrides'),
      where('date', '>=', dateRange.start.toISOString().split('T')[0]),
      where('date', '<=', dateRange.end.toISOString().split('T')[0])
    );

    return onSnapshot(overridesQ, (snap) => {
      setOverridesSnapshot(snap.docs);
    }, (error) => {
      console.error("Overrides Snapshot Error:", error);
      setLoadingPayroll(false);
    });
  }, [dateRange, activeTab]);

  // --- Global Payroll & Attendance Calculation Effect ---
  useEffect(() => {
    if (activeTab === 'management') return;

    const payrollMap: Record<string, any> = {};

    employees.forEach(emp => {
      payrollMap[emp.id] = {
        empDetails: emp,
        deliveredOrdersCount: 0,
        payableCommission: 0,
        absentDays: 0,
        absentDatesList: [] as { date: string, dayNum: number, isExempted: boolean }[],
        proRatedBase: 0,
        eligibleDays: 0,
        deductions: 0,
        netDue: 0,
        unpaidOrderIds: [] as string[]
      };
      
      const activeDays = new Set<string>();
      const empOrders = ordersSnapshot.filter(d => d.data().employeeId === emp.id);
      
      empOrders.forEach(doc => {
        const d = doc.data().date?.toDate();
        if (d) activeDays.add(d.toISOString().split('T')[0]);
        
        if (doc.data().status === 'delivered' && !doc.data().isPaidToStaff) {
            payrollMap[emp.id].deliveredOrdersCount++;
            payrollMap[emp.id].unpaidOrderIds.push(doc.id);
        }
      });

      payrollMap[emp.id].payableCommission = payrollMap[emp.id].deliveredOrdersCount * (emp.commissionRate || 0);

      const overridesMap = new Map<string, boolean>();
      overridesSnapshot.filter(d => d.data().employeeId === emp.id).forEach(doc => {
        const data = doc.data();
        overridesMap.set(data.date, data.isPresent);
      });

      let iterDate = new Date(dateRange.start);
      const endIter = new Date(dateRange.end);
      let absentCount = 0;
      
      const daysInMonth = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth() + 1, 0).getDate();
      let eligibleDays = 0;

      while (iterDate <= endIter) {
        const dateKey = iterDate.toISOString().split('T')[0];
        const hasOrders = activeDays.has(dateKey);
        const override = overridesMap.get(dateKey); // undefined, true, or false
        
        const joinDateStr = emp.joinDate;
        const isBeforeJoin = joinDateStr && dateKey < joinDateStr;

        if (!isBeforeJoin) {
          eligibleDays++;
          
          let isPresent = true;
          if (emp.trackAbsence ?? true) {
            // Standard behavior: no orders = absent unless overridden to present
            isPresent = hasOrders || (override === true);
          } else {
            // Fixed staff behavior: only absent if explicitly overridden to false
            if (override === false) {
              isPresent = false;
            }
          }

          if (!isPresent) {
            payrollMap[emp.id].absentDatesList.push({ 
              date: dateKey, 
              dayNum: iterDate.getDate(),
              isExempted: false
            });
            absentCount++;
          } else if (!hasOrders && (emp.trackAbsence ?? true) && override === true) {
            payrollMap[emp.id].absentDatesList.push({ 
              date: dateKey, 
              dayNum: iterDate.getDate(),
              isExempted: true
            });
          } else if (!hasOrders && !(emp.trackAbsence ?? true)) {
            payrollMap[emp.id].absentDatesList.push({ 
              date: dateKey, 
              dayNum: iterDate.getDate(),
              isExempted: true
            });
          }
        }
        iterDate.setDate(iterDate.getDate() + 1);
      }

      payrollMap[emp.id].absentDays = absentCount;
      payrollMap[emp.id].eligibleDays = eligibleDays;
      
      if (emp.paymentType !== 'commission') {
          const baseSalVal = emp.basicSalary || 0;
          const dailyRate = baseSalVal / daysInMonth;
          payrollMap[emp.id].proRatedBase = Math.round(dailyRate * eligibleDays);
          payrollMap[emp.id].deductions = Math.round(dailyRate * absentCount);
      }

      let baseToUse = emp.paymentType !== 'commission' ? payrollMap[emp.id].proRatedBase : 0;
      let comm = emp.paymentType !== 'salary' ? payrollMap[emp.id].payableCommission : 0;
      payrollMap[emp.id].netDue = baseToUse + comm - payrollMap[emp.id].deductions;
      if (payrollMap[emp.id].netDue < 0) payrollMap[emp.id].netDue = 0;
    });

    setGlobalPayrollData(payrollMap);
    setLoadingPayroll(false);
  }, [activeTab, dateRange, employees, ordersSnapshot, overridesSnapshot]);

  const handlePaySalary = async (empId: string) => {
    const pData = globalPayrollData[empId];
    if (!pData) return;

    if (pData.netDue <= 0 && pData.unpaidOrderIds.length === 0) {
      showToastMsg("المبلغ صفر أو لا توجد طلبات جديدة للتسديد.", "error");
      return;
    }

    if (!window.confirm(`هل أنت متأكد من تسديد مبلغ ${formatCurrency(pData.netDue)} للموظف ${pData.empDetails.name}؟`)) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Mark orders as Paid
      pData.unpaidOrderIds.forEach((orderId: string) => {
        const orderRef = doc(db, 'orders', orderId);
        batch.update(orderRef, { isPaidToStaff: true });
      });

      // 2. Add salary payment record
      const paymentRef = doc(collection(db, 'salary_payments'));
      batch.set(paymentRef, {
        employeeId: empId,
        employeeName: pData.empDetails.name,
        amountPaid: pData.netDue,
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        orderIds: pData.unpaidOrderIds,
        details: {
          deliveredOrders: pData.deliveredOrdersCount,
          totalCommission: pData.payableCommission,
          absentDays: pData.absentDays,
          deductions: pData.deductions,
          basicSalary: pData.empDetails.paymentType !== 'commission' ? pData.empDetails.basicSalary : 0,
          paymentType: pData.empDetails.paymentType
        },
        paymentDate: serverTimestamp()
      });

      await batch.commit();
      showToastMsg(`تم تسديد راتب ${pData.empDetails.name} بنجاح!`, "success");
    } catch (error) {
      console.error("Error paying salary:", error);
      showToastMsg("حدث خطأ أثناء التسديد", "error");
    }
  };

  // --- Payment Archive Logic ---
  useEffect(() => {
    if (!showArchiveModal) return;

    const q = query(collection(db, 'salary_payments'), orderBy('paymentDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setArchiveData(data);
    });

    return () => unsubscribe();
  }, [showArchiveModal]);

  const openArchive = () => {
    setArchiveTab('active');
    setShowArchiveModal(true);
  };

  const handleMoveToFinalArchive = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من نقل هذه العملية إلى الأرشيف النهائي؟ لن تظهر في القائمة الرئيسية بعد الآن.")) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'salary_payments', id), { isArchivedFinal: true });
      await batch.commit();
      showToastMsg("تم نقل العملية للأرشيف النهائي");
    } catch (error) {
      console.error(error);
      showToastMsg("حدث خطأ أثناء المحاولة", "error");
    }
  };

  const handleRestoreFromFinal = async (id: string) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'salary_payments', id), { isArchivedFinal: false });
      await batch.commit();
      showToastMsg("تمت استعادة العملية للأرشيف النشط");
    } catch (error) {
      console.error(error);
      showToastMsg("حدث خطأ أثناء المحاولة", "error");
    }
  };

  useEffect(() => {
    if (!viewArchiveRecord) return;
    if (!viewArchiveRecord.orderIds || viewArchiveRecord.orderIds.length === 0) {
      setArchiveOrders([]);
      return;
    }
    
    setLoadingArchiveOrders(true);
    const fetchOrders = async () => {
      try {
        const { orderIds } = viewArchiveRecord;
        const chunks = [];
        // Firestore 'in' query limit is 30, so we chunk the array
        for (let i = 0; i < orderIds.length; i += 30) {
          chunks.push(orderIds.slice(i, i + 30));
        }
        
        let allOrds: any[] = [];
        for (const chunk of chunks) {
          const q = query(collection(db, 'orders'), where('__name__', 'in', chunk));
          const snap = await getDocs(q);
          snap.forEach(d => allOrds.push({ id: d.id, ...d.data() }));
        }
        setArchiveOrders(allOrds);
      } catch (err) {
        console.error("Error fetching archive orders", err);
      } finally {
        setLoadingArchiveOrders(false);
      }
    };
    
    fetchOrders();
  }, [viewArchiveRecord]);

  // ------------------------------

  const openAttendanceModal = (emp: Employee) => {
    setSelectedAttendanceEmployee(emp);
    setShowAttendanceModal(true);
  };

  const openPayrollModal = (emp: Employee) => {
    setSelectedAttendanceEmployee(emp);
    setShowPayrollModal(true);
  };

  const toggleAttendance = async (dayInfo: any) => {
    if (!selectedAttendanceEmployee) return;
    performAttendanceToggle(selectedAttendanceEmployee.id, dayInfo.date, dayInfo.isPresent);
  };

  const handleToggleAttendanceFromTab = async (empId: string, date: string, isCurrentlyPresent: boolean) => {
    performAttendanceToggle(empId, date, isCurrentlyPresent);
  };

  const performAttendanceToggle = async (empId: string, date: string, isCurrentlyPresent: boolean) => {
    try {
      const docId = `${empId}_${date}`;
      const overRef = doc(db, 'attendance_overrides', docId);
      
      const newStatus = !isCurrentlyPresent;
      const [year, month, day] = date.split('-');
      
      const batch = writeBatch(db);
      batch.set(overRef, {
        employeeId: empId,
        month: `${year}-${month}`,
        date: date,
        day: parseInt(day),
        isPresent: newStatus,
        updatedAt: serverTimestamp()
      });
      await batch.commit();
      
      showToastMsg("تم تحديث حالة الحضور", "success");
    } catch (err) {
      console.error(err);
      showToastMsg("حدث خطأ أثناء التحديث", "error");
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US').format(val) + ' د.ع';
  };

  return (
    <div className={styles.container}>
      {toast && <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.message}</div>}

      <div className={styles.tabsContainer}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'management' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('management')}
        >
          إدارة الموظفين
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'payroll' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('payroll')}
        >
          الرواتب والعمولات
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'attendance' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          سجل الحضور والغياب
        </button>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>
          {activeTab === 'management' ? 'قائمة الموظفين' : 
           activeTab === 'payroll' ? 'الرواتب والعمولات' : 'سجل الغيابات والحضور'}
        </h1>
        
        {activeTab === 'management' ? (
          <button className={styles.addButton} onClick={() => handleOpenModal()}>
            <span>+ إضافة موظف جديد</span>
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              className={styles.payButton} 
              style={{ padding: '0.65rem 1.25rem', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)' }}
              onClick={openArchive}
            >
              📜 أرشيف الدفعيات
            </button>
            <div style={{ width: '300px' }}>
              <DateRangePicker 
                initialPreset="هذا الشهر" 
                onApply={() => {}} 
                onApplyDates={(start, end) => setDateRange({ start, end })}
              />
            </div>
          </div>
        )}
      </header>

      {activeTab === 'management' && (
        <section className={styles.searchSection}>
          <div className={styles.searchBox}>
            <input 
              type="text" 
              placeholder="بحث باسم الموظف..." 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className={styles.searchIcon}>🔍</span>
          </div>
        </section>
      )}

      {activeTab === 'management' ? (
        <main className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>اسم الموظف</th>
                <th>الراتب الأساسي</th>
                <th>العمولة لكل طلب</th>
                <th>نوع الدفع</th>
                <th>حالة النشاط</th>
                <th>العمليات</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td className={styles.employeeName}>
                    {emp.name}
                  </td>
                  <td>{formatCurrency(emp.basicSalary || 0)}</td>
                  <td>{formatCurrency(emp.commissionRate || 0)}/طلب</td>
                  <td>
                    <span style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      {emp.paymentType === 'salary' ? 'راتب ثابت' : 
                       emp.paymentType === 'commission' ? 'نسبة فقط' : 
                       emp.paymentType === 'both' ? 'راتب ونسبة' : 'غير محدد'}
                    </span>
                  </td>
                  <td>
                    <span className={emp.isActive ? styles.statusActive : styles.statusInactive}>
                      {emp.isActive ? 'نشط (Active)' : 'غير نشط (Inactive)'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => handleOpenModal(emp)} title="تعديل">✏️</button>
                      <button className={`${styles.actionBtn}`} style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }} onClick={() => handleDelete(emp.id, emp.name)} title="حذف">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      ) : (
        <main className={styles.tableContainer}>
          {loadingPayroll ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>جاري معالجة الكشوفات...</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>اسم الموظف</th>
                  <th>الطلبات المكتملة</th>
                  <th>إجمالي العمولات</th>
                  <th>الخصميات (أيام الغياب)</th>
                  <th>الصافي المستحق</th>
                  <th>العمليات</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const pData = globalPayrollData[emp.id];
                  if (!pData) return null;
                  
                  return (
                    <tr key={emp.id}>
                      <td className={styles.employeeName}>
                        {emp.name}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {emp.paymentType === 'salary' ? 'راتب ثابت' : emp.paymentType === 'commission' ? 'نسبة فقط' : 'راتب ونسبة'}
                        </div>
                      </td>
                      <td>{pData.deliveredOrdersCount} طلب</td>
                      <td style={{ color: '#fbbf24' }}>{formatCurrency(pData.payableCommission)}</td>
                      <td style={{ color: pData.deductions > 0 ? '#ef4444' : 'inherit' }}>
                        {formatCurrency(pData.deductions)} 
                        <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '4px' }}>({pData.absentDays} يوم)</span>
                      </td>
                      <td style={{ color: '#10b981', fontWeight: 'bold' }}>{formatCurrency(pData.netDue)}</td>
                      <td>
                        <button 
                          className={styles.payButton} 
                          onClick={() => handlePaySalary(emp.id)}
                          disabled={pData.netDue <= 0 && pData.unpaidOrderIds.length === 0}
                        >
                          تسديد الراتب
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </main>
      )}

      {activeTab === 'attendance' && (
        <main className={styles.mainContent}>
          {loadingPayroll ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>جاري التحميل...</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الأيام المسجلة كـ "غائب"</th>
                  <th style={{ textAlign: 'center' }}>إجمالي الغيابات</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const pData = globalPayrollData[emp.id] || {};
                  const absences = pData.absentDatesList || [];
                  
                  return (
                    <tr key={emp.id}>
                      <td className={styles.employeeName}>{emp.name}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {absences.length > 0 ? absences.map((abs: any) => (
                            <div 
                              key={abs.date} 
                              onClick={() => handleToggleAttendanceFromTab(emp.id, abs.date, abs.isExempted)}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem', 
                                background: abs.isExempted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.1)', 
                                border: `1px solid ${abs.isExempted ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                padding: '0.3rem 0.6rem',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              title={abs.isExempted ? "إلغاء الإعفاء" : "إعفاء الموظف"}
                            >
                              <span style={{ color: abs.isExempted ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                {abs.dayNum} شار ({abs.date.split('-')[1]})
                              </span>
                              <div style={{ 
                                background: abs.isExempted ? '#10b981' : 'rgba(255,255,255,0.1)', 
                                color: 'white', 
                                borderRadius: '4px', 
                                padding: '0.1rem 0.4rem', 
                                fontSize: '0.7rem',
                                fontWeight: 'bold'
                              }}>
                                {abs.isExempted ? '✔️ معفى' : 'إعفاء'}
                              </div>
                            </div>
                          )) : (
                            <span style={{ color: '#10b981', fontSize: '0.85rem' }}>✅ لا توجد غيابات</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: absences.length > 0 ? '#ef4444' : '#10b981' }}>
                        {absences.length} يوم
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </main>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h2>
              <button className={styles.closeButton} onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>اسم الموظف *</label>
                    <input type="text" className={styles.input} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>نوع الدفع</label>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input 
                          type="radio" 
                          name="paymentType" 
                          value="salary" 
                          checked={formData.paymentType === 'salary'} 
                          onChange={e => setFormData({
                            ...formData, 
                            paymentType: e.target.value,
                            commissionRate: '0' 
                          })} 
                        />
                        راتب ثابت فقط
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input 
                          type="radio" 
                          name="paymentType" 
                          value="commission" 
                          checked={formData.paymentType === 'commission'} 
                          onChange={e => setFormData({
                            ...formData, 
                            paymentType: e.target.value,
                            basicSalary: '0'
                          })} 
                        />
                        نسبة فقط
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input 
                          type="radio" 
                          name="paymentType" 
                          value="both" 
                          checked={formData.paymentType === 'both'} 
                          onChange={e => setFormData({
                            ...formData, 
                            paymentType: e.target.value
                          })} 
                        />
                        راتب ونسبة معاً
                      </label>
                    </div>
                  </div>
                  
                  {formData.paymentType !== 'commission' && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>الراتب الأساسي</label>
                      <input type="number" className={styles.input} value={formData.basicSalary} onChange={e => setFormData({...formData, basicSalary: e.target.value})} />
                    </div>
                  )}

                  {formData.paymentType !== 'salary' && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>العمولة الثابتة لكل طلب (د.ع)</label>
                      <input type="number" className={styles.input} value={formData.commissionRate} onChange={e => setFormData({...formData, commissionRate: e.target.value})} />
                    </div>
                  )}
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>حالة النشاط</label>
                    <select className={styles.select} value={formData.isActive ? 'true' : 'false'} onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})}>
                      <option value="true">نشط (Active)</option>
                      <option value="false">غير نشط (Inactive)</option>
                    </select>
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`} style={{ marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.trackAbsence} 
                        onChange={e => setFormData({...formData, trackAbsence: e.target.checked})}
                        style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-primary)' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold' }}>احتساب الغيابات تلقائياً</span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>إذا تم تفعيله، سيتم خصم الراتب في الأيام التي لا يسجل فيها الموظف أي طلبات.</span>
                      </div>
                    </label>
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>تاريخ المباشرة (اختياري)</label>
                    <input 
                      type="date" 
                      className={styles.input} 
                      value={formData.joinDate} 
                      onChange={e => setFormData({...formData, joinDate: e.target.value})} 
                      placeholder="اتركه فارغاً إذا كان موظف قديم"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      سيتم احتساب الراتب والغيابات فقط من هذا التاريخ فصاعداً.
                    </small>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowModal(false)}>إلغاء</button>
                <button type="submit" className={styles.saveButton}>حفظ البيانات</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && selectedAttendanceEmployee && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.attendanceModal}`}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>سجل حضور: {selectedAttendanceEmployee.name}</h2>
              <button className={styles.closeButton} onClick={() => setShowAttendanceModal(false)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.monthSelector}>
                <label className={styles.label}>اختر النطاق الزمني:</label>
                <div style={{ flex: 1 }}>
                  <DateRangePicker 
                    initialPreset="هذا الشهر" 
                    onApply={() => {}} 
                    onApplyDates={(start, end) => setDateRange({ start, end })}
                  />
                </div>
              </div>

              {loadingAttendance ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>جاري جلب البيانات...</div>
              ) : (
                <>
                  <div className={styles.summaryCards}>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>أيام الحضور</span>
                      <span className={`${styles.summaryValue} ${styles.green}`}>{attendanceData.totalPresent}</span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>أيام الغياب</span>
                      <span className={`${styles.summaryValue} ${styles.red}`}>{attendanceData.totalAbsent}</span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>طلبات مكتملة</span>
                      <span className={`${styles.summaryValue}`} style={{ color: '#60a5fa' }}>{attendanceData.deliveredOrders}</span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>العمولة المحققة</span>
                      <span className={`${styles.summaryValue}`} style={{ color: '#fbbf24' }}>{formatCurrency(attendanceData.totalCommission)}</span>
                    </div>
                  </div>

                  <div className={styles.summaryCards} style={{ marginTop: '-1rem' }}>
                    <div className={`${styles.summaryCard} ${styles.pendingCard}`}>
                      <span className={styles.summaryLabel}>طلبات قيد التوصيل</span>
                      <span className={`${styles.summaryValue} ${styles.orange}`}>{attendanceData.pendingOrdersCount}</span>
                    </div>
                    <div className={`${styles.summaryCard} ${styles.pendingCard}`}>
                      <span className={styles.summaryLabel}>عمولة قيد التحصيل (قريباً)</span>
                      <span className={`${styles.summaryValue} ${styles.orange}`}>{formatCurrency(attendanceData.expectedCommission)}</span>
                    </div>
                  </div>

                  <div className={styles.attendanceGrid}>
                    {attendanceData.days.map((day) => (
                      <div key={day.date} className={`${styles.dayCard} ${day.isPresent ? styles.present : styles.absent}`}>
                        <div className={styles.dayNumber}>{day.dayNum}</div>
                        <div className={styles.dayStatus}>
                          {day.isPresent ? '✔️ حاضر' : '❌ غائب'}
                        </div>
                        <button 
                          className={styles.toggleBtn}
                          onClick={() => toggleAttendance(day)}
                        >
                          {day.isPresent ? 'تسجيل غياب' : 'تسجيل حضور'}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payroll Calculator Modal */}
      {showPayrollModal && selectedAttendanceEmployee && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.attendanceModal}`} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>💰 كشف حساب الموظف: {selectedAttendanceEmployee.name}</h2>
              <button className={styles.closeButton} onClick={() => setShowPayrollModal(false)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.monthSelector}>
                <label className={styles.label}>الفترة المالية:</label>
                <div style={{ flex: 1 }}>
                  <DateRangePicker 
                    initialPreset="هذا الشهر" 
                    onApply={() => {}} 
                    onApplyDates={(start, end) => setDateRange({ start, end })}
                  />
                </div>
              </div>

              {loadingAttendance ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>جاري الحساب...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Financial Details Card */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>نوع الدفع:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                        {selectedAttendanceEmployee.paymentType === 'salary' ? 'راتب ثابت فقط' : 
                         selectedAttendanceEmployee.paymentType === 'commission' ? 'نسبة فقط' : 'راتب وعمولة معاً'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Basic Salary Row */}
                      {selectedAttendanceEmployee.paymentType !== 'commission' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>الراتب الأساسي (كامل):</span>
                            <span style={{ fontWeight: '600' }}>{formatCurrency(selectedAttendanceEmployee.basicSalary || 0)}</span>
                          </div>
                          {attendanceData.days.length !== (globalPayrollData[selectedAttendanceEmployee.id]?.eligibleDays || 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#60a5fa', fontSize: '0.9rem' }}>
                              <span>الراتب المستحق للفترة (نسبي):</span>
                              <span style={{ fontWeight: '600' }}>{formatCurrency(globalPayrollData[selectedAttendanceEmployee.id]?.proRatedBase || 0)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Commission Row */}
                      {selectedAttendanceEmployee.paymentType !== 'salary' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>الطلبات المكتملة (واصل):</span>
                            <span style={{ fontWeight: '600' }}>{attendanceData.deliveredOrders} طلب</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>العمولة لكل طلب:</span>
                            <span style={{ fontWeight: '600' }}>{formatCurrency(selectedAttendanceEmployee.commissionRate || 0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}>
                            <span>إجمالي العمولات:</span>
                            <span style={{ fontWeight: 'bold' }}>+ {formatCurrency(attendanceData.totalCommission)}</span>
                          </div>
                        </>
                      )}

                      {/* Total Calculation */}
                      <div style={{ 
                        marginTop: '1.5rem', 
                        paddingTop: '1.5rem', 
                        borderTop: '2px dashed rgba(255,255,255,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>المبلـــغ الكلي المستحق:</span>
                        <div style={{ textAlign: 'left' }}>
                          <span style={{ 
                            fontSize: '1.75rem', 
                            fontWeight: '900', 
                            color: '#10b981',
                            textShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
                          }}>
                            {formatCurrency(
                              (selectedAttendanceEmployee.paymentType !== 'commission' ? (globalPayrollData[selectedAttendanceEmployee.id]?.proRatedBase || 0) : 0) +
                              (selectedAttendanceEmployee.paymentType !== 'salary' ? attendanceData.totalCommission : 0) -
                              (selectedAttendanceEmployee.paymentType !== 'commission' ? (globalPayrollData[selectedAttendanceEmployee.id]?.deductions || 0) : 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warning for Pending */}
                  {attendanceData.pendingOrdersCount > 0 && selectedAttendanceEmployee.paymentType !== 'salary' && (
                    <div style={{ 
                      background: 'rgba(249, 115, 22, 0.1)', 
                      padding: '1rem', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(249, 115, 22, 0.3)',
                      fontSize: '0.85rem',
                      color: '#f97316',
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center'
                    }}>
                      <span>⚠️ يوجد مبلغ إضافي معلق {formatCurrency(attendanceData.expectedCommission)} بانتظار اكتمال {attendanceData.pendingOrdersCount} طلبات.</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button 
                      className={styles.saveButton} 
                      style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)' }}
                      onClick={() => window.print()}
                    >
                      🖨️ طباعة الكشف
                    </button>
                    <button className={styles.saveButton} style={{ flex: 1 }} onClick={() => setShowPayrollModal(false)}>
                      تم المراجعه
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Archive Modal */}
      {showArchiveModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.attendanceModal}`} style={{ maxWidth: '900px' }}>
            <div className={styles.modalHeader} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <h2 className={styles.modalTitle}>📜 أرشيف تسديد الرواتب والعمولات</h2>
                <button className={styles.closeButton} onClick={() => setShowArchiveModal(false)}>×</button>
              </div>
              <div className={styles.tabsContainer} style={{ marginBottom: 0, padding: 0, width: 'fit-content' }}>
                <button 
                  className={`${styles.tabButton} ${archiveTab === 'active' ? styles.tabButtonActive : ''}`}
                  onClick={() => setArchiveTab('active')}
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  السجلات النشطة
                </button>
                <button 
                  className={`${styles.tabButton} ${archiveTab === 'final' ? styles.tabButtonActive : ''}`}
                  onClick={() => setArchiveTab('final')}
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  الأرشيف النهائي
                </button>
              </div>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.tableContainer} style={{ background: 'transparent', border: 'none' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>اسم الموظف</th>
                      <th>المبلغ المدفوع</th>
                      <th>الفترة المحاسبية</th>
                      <th>تاريخ وتوقت الدفع</th>
                      <th>عدد الطلبات</th>
                      <th style={{ textAlign: 'center' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archiveData
                      .filter(item => archiveTab === 'final' ? item.isArchivedFinal === true : !item.isArchivedFinal)
                      .length > 0 ? archiveData
                      .filter(item => archiveTab === 'final' ? item.isArchivedFinal === true : !item.isArchivedFinal)
                      .map((item) => {
                      const payDate = item.paymentDate?.toDate();
                      const dateStr = payDate ? payDate.toLocaleDateString('en-GB') : '---';
                      const timeStr = payDate ? payDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) : '';

                      const startRange = item.dateRangeStart?.toDate();
                      const endRange = item.dateRangeEnd?.toDate();
                      const rangeStr = startRange && endRange 
                        ? `${startRange.toLocaleDateString('en-GB')} - ${endRange.toLocaleDateString('en-GB')}`
                        : '---';

                      return (
                        <tr key={item.id}>
                          <td className={styles.employeeName}>{item.employeeName}</td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }}>{formatCurrency(item.amountPaid)}</td>
                          <td style={{ fontSize: '0.85rem' }}>{rangeStr}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{dateStr}</span>
                              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{timeStr}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{item.details?.deliveredOrders || 0} طلب</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button 
                                className={styles.actionBtn} 
                                style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}
                                onClick={() => setViewArchiveRecord(item)}
                                title="عرض الطلبات"
                              >
                                👁️ عرض
                              </button>
                              {archiveTab === 'active' ? (
                                <button 
                                  className={styles.actionBtn} 
                                  style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                                  onClick={() => handleMoveToFinalArchive(item.id)}
                                  title="نقل للأرشيف النهائي"
                                >
                                  🗑️
                                </button>
                              ) : (
                                <button 
                                  className={styles.actionBtn} 
                                  style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}
                                  onClick={() => handleRestoreFromFinal(item.id)}
                                  title="استعادة"
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
                        <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          {archiveTab === 'active' ? 'لا توجد عمليات دفع مسجلة حالياً.' : 'الأرشيف النهائي فارغ.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Orders Details Modal */}
      {viewArchiveRecord && (
        <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
          <div className={styles.modal} style={{ maxWidth: '900px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>📦 الطلبات المحاسب عليها - {viewArchiveRecord.employeeName}</h2>
              <button className={styles.closeButton} onClick={() => { setViewArchiveRecord(null); setArchiveOrdersSearch(''); }}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ marginBottom: '1rem' }}>
                <input 
                  type="text" 
                  placeholder="بحث في الطلبات (اسم الزبون، الهاتف، رقم الوصل، المنطقة)..." 
                  className={styles.searchInput}
                  value={archiveOrdersSearch}
                  onChange={(e) => setArchiveOrdersSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg-lighter)' }}
                />
              </div>

              {!viewArchiveRecord.orderIds || viewArchiveRecord.orderIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  لا توجد طلبات مسجلة لهذه الدفعة (قد تكون دفعة قديمة).
                </div>
              ) : loadingArchiveOrders ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل الطلبات...</div>
              ) : (
                <div className={styles.tableContainer} style={{ background: 'transparent', border: 'none', maxHeight: '500px', overflowY: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>رقم الوصل</th>
                        <th>اسم الزبون</th>
                        <th>رقم الهاتف</th>
                        <th>المنطقة/المحافظة</th>
                        <th>المبلغ الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archiveOrders
                        .filter(o => 
                          (o.customerName || '').toLowerCase().includes(archiveOrdersSearch.toLowerCase()) ||
                          (o.customerPhone || '').includes(archiveOrdersSearch) ||
                          (o.receiptNumber || '').toLowerCase().includes(archiveOrdersSearch.toLowerCase()) ||
                          (o.governorate || '').toLowerCase().includes(archiveOrdersSearch.toLowerCase()) ||
                          (o.region || '').toLowerCase().includes(archiveOrdersSearch.toLowerCase())
                        )
                        .map(order => (
                          <tr key={order.id}>
                            <td style={{ fontWeight: 'bold' }}>{order.receiptNumber}</td>
                            <td>{order.customerName}</td>
                            <td dir="ltr" style={{ textAlign: 'right' }}>{order.customerPhone}</td>
                            <td>{order.governorate} {order.region ? `- ${order.region}` : ''}</td>
                            <td style={{ color: '#10b981' }}>{new Intl.NumberFormat('en-US').format(order.totalAmount || 0)} د.ع</td>
                          </tr>
                        ))
                      }
                      {archiveOrders.length > 0 && archiveOrders.filter(o => 
                          (o.customerName || '').toLowerCase().includes(archiveOrdersSearch.toLowerCase()) ||
                          (o.customerPhone || '').includes(archiveOrdersSearch) ||
                          (o.receiptNumber || '').toLowerCase().includes(archiveOrdersSearch.toLowerCase()) ||
                          (o.city || '').toLowerCase().includes(archiveOrdersSearch.toLowerCase())
                        ).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            لا توجد نتائج بحث مطابقة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
