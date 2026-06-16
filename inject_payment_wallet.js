const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'employees', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Add states
const stateInjectionStr = `  const [activeTab, setActiveTab] = useState<'management' | 'payroll' | 'attendance' | 'deductions' | 'bonuses'>('management');`;
content = content.replace(
  stateInjectionStr,
  `  const [wallets, setWallets] = useState<any[]>([]);\n  const [payModal, setPayModal] = useState<{isOpen: boolean, empId: string, netDue: number, empName: string, walletId: string} | null>(null);\n\n` + stateInjectionStr
);

// 2. Add wallets effect
const effectInjectionStr = `  useEffect(() => {\n    const q = query(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'employees'), orderBy('createdAt', 'desc'));`;
content = content.replace(
  effectInjectionStr,
  `  useEffect(() => {\n    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'wallets'), (snap) => {\n      setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() })));\n    });\n    return () => unsub();\n  }, []);\n\n` + effectInjectionStr
);

// 3. Update handlePaySalary and add confirmPaySalary
const handlePaySalaryStart = `  const handlePaySalary = async (empId: string) => {`;
const handlePaySalaryEnd = `    } catch (error) {\n      console.error("Error paying salary:", error);\n      showToastMsg("حدث خطأ أثناء التسديد", "error");\n    }\n  };`;

const handlePayStrStartIdx = content.indexOf(handlePaySalaryStart);
const handlePayStrEndIdx = content.indexOf(handlePaySalaryEnd, handlePayStrStartIdx) + handlePaySalaryEnd.length;

if (handlePayStrStartIdx !== -1 && handlePayStrEndIdx > handlePayStrStartIdx) {
  const oldHandlePayBody = content.substring(handlePayStrStartIdx, handlePayStrEndIdx);
  
  // Transform it
  let newLogic = `  const handlePaySalary = (empId: string) => {
    const pData = globalPayrollData[empId];
    if (!pData) return;

    if (pData.netDue <= 0 && pData.unpaidOrderIds.length === 0) {
      showToastMsg("المبلغ صفر أو لا توجد طلبات جديدة للتسديد.", "error");
      return;
    }

    setPayModal({
      isOpen: true,
      empId: empId,
      netDue: pData.netDue,
      empName: pData.empDetails.name,
      walletId: ''
    });
  };

  const confirmPaySalary = async () => {
    if (!payModal) return;
    if (!payModal.walletId && payModal.netDue > 0) {
      showToastMsg("يرجى اختيار المحفظة", "error");
      return;
    }

    const empId = payModal.empId;
    const pData = globalPayrollData[empId];
    if (!pData) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Mark orders as Paid
      pData.unpaidOrderIds.forEach((orderId: string) => {
        const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
        batch.update(orderRef, { isPaidToStaff: true });
      });

      // 2. Add salary payment record
      const paymentRef = doc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'salary_payments'));
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
          manualBonuses: pData.manualBonuses || 0,
          basicSalary: pData.empDetails.paymentType !== 'commission' ? pData.empDetails.basicSalary : 0,
          paymentType: pData.empDetails.paymentType
        },
        paymentDate: serverTimestamp()
      });

      // 3. Mark deductions and bonuses as paid
      deductionsSnapshot.filter(d => d.data().employeeId === empId && !d.data().isPaid).forEach(d => {
        const ref = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'deductions', d.id);
        batch.update(ref, { isPaid: true });
      });

      bonusesSnapshot.filter(b => b.data().employeeId === empId && !b.data().isPaid).forEach(b => {
        const ref = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'bonuses', b.id);
        batch.update(ref, { isPaid: true });
      });

      // 4. Record Treasury Transaction
      if (payModal.netDue > 0 && payModal.walletId) {
        const selectedWallet = wallets.find(w => w.id === payModal.walletId);
        const treasuryRef = doc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions'));
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        batch.set(treasuryRef, {
          type: 'withdraw',
          walletId: payModal.walletId,
          walletName: selectedWallet?.name || 'غير محددة',
          amount: payModal.netDue,
          currency: 'IQD',
          date: toLocalDate(now),
          time: currentTime,
          notes: \`تسديد راتب الموظف: \${pData.empDetails.name}\`,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      setPayModal(null);
      showToastMsg(\`تم تسديد راتب \${pData.empDetails.name} بنجاح!\`, "success");
    } catch (error) {
      console.error("Error paying salary:", error);
      showToastMsg("حدث خطأ أثناء التسديد", "error");
    }
  };`;

  content = content.substring(0, handlePayStrStartIdx) + newLogic + content.substring(handlePayStrEndIdx);
} else {
  console.log("Could not find handlePaySalary block!");
}

// 4. Add the modal JSX at the very end before the last </div>
const modalJSX = `
      {payModal?.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '400px' }}>
            <div className={styles.modalHeader}>
              <h2>تسديد الراتب</h2>
              <button className={styles.closeBtn} onClick={() => setPayModal(null)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: '1rem' }}>
                هل أنت متأكد من تسديد مبلغ <strong>{formatCurrency(payModal.netDue)}</strong> للموظف <strong>{payModal.empName}</strong>؟
              </p>
              {payModal.netDue > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>اختر المحفظة لدفع الراتب منها:</label>
                  <select 
                    className={styles.select}
                    value={payModal.walletId}
                    onChange={(e) => setPayModal({ ...payModal, walletId: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  >
                    <option value="">-- اختر المحفظة --</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.modalActions} style={{ marginTop: '2rem' }}>
                <button className={styles.btnSecondary} onClick={() => setPayModal(null)}>إلغاء</button>
                <button className={styles.btnPrimary} onClick={confirmPaySalary}>تأكيد التسديد</button>
              </div>
            </div>
          </div>
        </div>
      )}
`;

const lastDivIdx = content.lastIndexOf('</div>\n    </div>\n  );\n}');
if (lastDivIdx !== -1) {
  content = content.substring(0, lastDivIdx) + modalJSX + content.substring(lastDivIdx);
} else {
  console.log("Could not find last div to insert modal!");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully injected wallet payment logic.');
