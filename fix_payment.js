const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'employees', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Add state
content = content.replace(
  `  const [bonusesSnapshot, setBonusesSnapshot] = useState<any[]>([]);\n\n  // Form State`,
  `  const [bonusesSnapshot, setBonusesSnapshot] = useState<any[]>([]);\n  const [paymentsSnapshot, setPaymentsSnapshot] = useState<any[]>([]);\n\n  // Form State`
);

// 2. Add effect
const effectSearchStr = `    return onSnapshot(bonusesQ, (snap) => {\n      setBonusesSnapshot(snap.docs);\n    }, (error) => {\n      console.error("Bonuses Snapshot Error:", error);\n    });\n  }, [dateRange, activeTab]);`;
content = content.replace(
  effectSearchStr,
  effectSearchStr + `\n\n  useEffect(() => {\n    if (activeTab === 'management') return;\n    const q = query(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'salary_payments'));\n    return onSnapshot(q, (snap) => setPaymentsSnapshot(snap.docs));\n  }, [activeTab]);`
);

// 3. Update activeDays calculation loop
const loopSearchStr = `      // Calculate base salary days\n      let activeDays = new Set();\n      for (let d = new Date(dateRange.start); d <= dateRange.end; d.setDate(d.getDate() + 1)) {\n        const dateKey = toLocalDate(d);`;
content = content.replace(
  loopSearchStr,
  `      const empPayments = paymentsSnapshot.filter(p => p.data().employeeId === emp.id).map(p => ({\n        start: p.data().dateRangeStart?.toDate ? p.data().dateRangeStart.toDate().getTime() : new Date(p.data().dateRangeStart).getTime(),\n        end: p.data().dateRangeEnd?.toDate ? p.data().dateRangeEnd.toDate().getTime() : new Date(p.data().dateRangeEnd).getTime()\n      }));\n\n      // Calculate base salary days\n      let activeDays = new Set();\n      for (let d = new Date(dateRange.start); d <= dateRange.end; d.setDate(d.getDate() + 1)) {\n        const dTime = d.getTime();\n        const isDayPaid = empPayments.some(p => dTime >= p.start && dTime <= p.end);\n        if (isDayPaid) continue;\n\n        const dateKey = toLocalDate(d);`
);

// 4. Filter deductions and bonuses
content = content.replace(
  `deductionsSnapshot.filter(d => d.data().employeeId === emp.id).forEach`,
  `deductionsSnapshot.filter(d => d.data().employeeId === emp.id && !d.data().isPaid).forEach`
);
content = content.replace(
  `bonusesSnapshot.filter(b => b.data().employeeId === emp.id).forEach`,
  `bonusesSnapshot.filter(b => b.data().employeeId === emp.id && !b.data().isPaid).forEach`
);

// 5. Update dependency array
content = content.replace(
  `  }, [activeTab, dateRange, employees, ordersSnapshot, overridesSnapshot, deductionsSnapshot, bonusesSnapshot]);`,
  `  }, [activeTab, dateRange, employees, ordersSnapshot, overridesSnapshot, deductionsSnapshot, bonusesSnapshot, paymentsSnapshot]);`
);

// 6. Update handlePaySalary
const batchCommitSearchStr = `        paymentDate: serverTimestamp()\n      });\n\n      await batch.commit();`;
content = content.replace(
  batchCommitSearchStr,
  `        paymentDate: serverTimestamp()\n      });\n\n      // 3. Mark deductions and bonuses as paid\n      deductionsSnapshot.filter(d => d.data().employeeId === empId && !d.data().isPaid).forEach(d => {\n        const ref = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'deductions', d.id);\n        batch.update(ref, { isPaid: true });\n      });\n\n      bonusesSnapshot.filter(b => b.data().employeeId === empId && !b.data().isPaid).forEach(b => {\n        const ref = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'bonuses', b.id);\n        batch.update(ref, { isPaid: true });\n      });\n\n      await batch.commit();`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated payment zeroing logic.');
