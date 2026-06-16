const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'employees', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines to \n
content = content.replace(/\r\n/g, '\n');

// Block 1
content = content.replace(
  `  const [activeTab, setActiveTab] = useState<'management' | 'payroll' | 'attendance' | 'deductions'>('management');\n\n  // Deductions State`,
  `  const [activeTab, setActiveTab] = useState<'management' | 'payroll' | 'attendance' | 'deductions' | 'bonuses'>('management');\n\n  // Bonuses State\n  const [bonusesList, setBonusesList] = useState<any[]>([]);\n  const [bonusForm, setBonusForm] = useState({\n    employeeId: '',\n    amount: '',\n    reason: '',\n    date: new Date().toISOString().split('T')[0],\n    notes: ''\n  });\n\n  // Deductions State`
);

// Block 4: state
content = content.replace(
  `  const [deductionsSnapshot, setDeductionsSnapshot] = useState<any[]>([]);\n\n  // Form State`,
  `  const [deductionsSnapshot, setDeductionsSnapshot] = useState<any[]>([]);\n  const [bonusesSnapshot, setBonusesSnapshot] = useState<any[]>([]);\n\n  // Form State`
);

// Block 2: Functions
content = content.replace(
  `  const handleDeleteDeduction = async (id: string) => {\n    if (!window.confirm("هل أنت متأكد من حذف هذا الخصم؟")) return;\n    try {\n      await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'deductions', id));\n      showToastMsg("تم حذف الخصم بنجاح");\n    } catch (err) {\n      console.error(err);\n      showToastMsg("حدث خطأ أثناء الحذف", "error");\n    }\n  };\n\n  useEffect(() => {`,
  `  const handleDeleteDeduction = async (id: string) => {\n    if (!window.confirm("هل أنت متأكد من حذف هذا الخصم؟")) return;\n    try {\n      await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'deductions', id));\n      showToastMsg("تم حذف الخصم بنجاح");\n    } catch (err) {\n      console.error(err);\n      showToastMsg("حدث خطأ أثناء الحذف", "error");\n    }\n  };\n\n  const handleSaveBonus = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!bonusForm.employeeId || !bonusForm.amount || !bonusForm.reason) {\n      showToastMsg("يرجى تعبئة الحقول الإجبارية", "error");\n      return;\n    }\n    \n    try {\n      const emp = employees.find(e => e.id === bonusForm.employeeId);\n      await addDoc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'bonuses'), {\n        ...bonusForm,\n        employeeName: emp?.name || '',\n        amount: parseFloat(bonusForm.amount),\n        createdAt: serverTimestamp()\n      });\n      showToastMsg("تم حفظ المكافأة بنجاح");\n      setBonusForm({\n        employeeId: '',\n        amount: '',\n        reason: '',\n        date: new Date().toISOString().split('T')[0],\n        notes: ''\n      });\n    } catch (err) {\n      console.error(err);\n      showToastMsg("حدث خطأ أثناء الحفظ", "error");\n    }\n  };\n\n  const handleDeleteBonus = async (id: string) => {\n    if (!window.confirm("هل أنت متأكد من حذف هذه المكافأة؟")) return;\n    try {\n      await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'bonuses', id));\n      showToastMsg("تم حذف المكافأة بنجاح");\n    } catch (err) {\n      console.error(err);\n      showToastMsg("حدث خطأ أثناء الحذف", "error");\n    }\n  };\n\n  useEffect(() => {`
);

// Block 3: Effects
content = content.replace(
  `    const unsub = onSnapshot(q, (snap) => {\n      setDeductionsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));\n    });\n    return () => unsub();\n  }, [activeTab]);\n\n\n\n  useEffect(() => {`,
  `    const unsub = onSnapshot(q, (snap) => {\n      setDeductionsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));\n    });\n    return () => unsub();\n  }, [activeTab]);\n\n  useEffect(() => {\n    if (activeTab !== 'bonuses') return;\n    const q = query(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'bonuses'), orderBy('createdAt', 'desc'));\n    const unsub = onSnapshot(q, (snap) => {\n      setBonusesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));\n    });\n    return () => unsub();\n  }, [activeTab]);\n\n  useEffect(() => {`
);

// Block 4: Fetchers
content = content.replace(
  `    return onSnapshot(deductionsQ, (snap) => {\n      setDeductionsSnapshot(snap.docs);\n    }, (error) => {\n      console.error("Deductions Snapshot Error:", error);\n    });\n  }, [dateRange, activeTab]);\n\n  // --- Global Payroll & Attendance Calculation Effect ---`,
  `    return onSnapshot(deductionsQ, (snap) => {\n      setDeductionsSnapshot(snap.docs);\n    }, (error) => {\n      console.error("Deductions Snapshot Error:", error);\n    });\n  }, [dateRange, activeTab]);\n\n  useEffect(() => {\n    if (activeTab === 'management') return;\n    \n    const bonusesQ = query(\n      collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'bonuses'),\n      where('date', '>=', dateRange.start.toISOString().split('T')[0]),\n      where('date', '<=', dateRange.end.toISOString().split('T')[0])\n    );\n\n    return onSnapshot(bonusesQ, (snap) => {\n      setBonusesSnapshot(snap.docs);\n    }, (error) => {\n      console.error("Bonuses Snapshot Error:", error);\n    });\n  }, [dateRange, activeTab]);\n\n  // --- Global Payroll & Attendance Calculation Effect ---`
);

// Block 5: Calc 1
content = content.replace(
  `        deductions: 0,\n        manualDeductions: 0,\n        netDue: 0,\n        unpaidOrderIds: [] as string[]`,
  `        deductions: 0,\n        manualDeductions: 0,\n        manualBonuses: 0,\n        netDue: 0,\n        unpaidOrderIds: [] as string[]`
);

// Block 5: Calc 2
content = content.replace(
  `      let manualDeductionsSum = 0;\n      deductionsSnapshot.filter(d => d.data().employeeId === emp.id).forEach(doc => {\n        manualDeductionsSum += (Number(doc.data().amount) || 0);\n      });\n      payrollMap[emp.id].manualDeductions = manualDeductionsSum;\n\n      let baseToUse = emp.paymentType !== 'commission' ? payrollMap[emp.id].proRatedBase : 0;\n      let comm = emp.paymentType !== 'salary' ? payrollMap[emp.id].payableCommission : 0;\n      payrollMap[emp.id].netDue = baseToUse + comm - payrollMap[emp.id].deductions - manualDeductionsSum;\n      if (payrollMap[emp.id].netDue < 0) payrollMap[emp.id].netDue = 0;`,
  `      let manualDeductionsSum = 0;\n      deductionsSnapshot.filter(d => d.data().employeeId === emp.id).forEach(doc => {\n        manualDeductionsSum += (Number(doc.data().amount) || 0);\n      });\n      payrollMap[emp.id].manualDeductions = manualDeductionsSum;\n\n      let manualBonusesSum = 0;\n      bonusesSnapshot.filter(b => b.data().employeeId === emp.id).forEach(doc => {\n        manualBonusesSum += (Number(doc.data().amount) || 0);\n      });\n      payrollMap[emp.id].manualBonuses = manualBonusesSum;\n\n      let baseToUse = emp.paymentType !== 'commission' ? payrollMap[emp.id].proRatedBase : 0;\n      let comm = emp.paymentType !== 'salary' ? payrollMap[emp.id].payableCommission : 0;\n      payrollMap[emp.id].netDue = baseToUse + comm + manualBonusesSum - payrollMap[emp.id].deductions - manualDeductionsSum;\n      if (payrollMap[emp.id].netDue < 0) payrollMap[emp.id].netDue = 0;`
);

// Block 6: Payment Record Details
content = content.replace(
  `          absentDays: pData.absentDays,\n          deductions: pData.deductions,\n          basicSalary: pData.empDetails.paymentType !== 'commission' ? pData.empDetails.basicSalary : 0,`,
  `          absentDays: pData.absentDays,\n          deductions: pData.deductions,\n          manualBonuses: pData.manualBonuses || 0,\n          basicSalary: pData.empDetails.paymentType !== 'commission' ? pData.empDetails.basicSalary : 0,`
);

// Block 7: Tabs UI
content = content.replace(
  `        <button \n          className={\`\${styles.tabButton} \${activeTab === 'deductions' ? styles.tabButtonActive : ''}\`}\n          onClick={() => setActiveTab('deductions')}\n        >\n          الخصومات\n        </button>\n      </div>\n\n      <header className={styles.header}>\n        <h1 className={styles.title}>\n          {activeTab === 'management' ? 'قائمة الموظفين' : \n           activeTab === 'payroll' ? 'الرواتب والعمولات' : \n           activeTab === 'deductions' ? 'خصومات الموظفين' : 'سجل الغيابات والحضور'}\n        </h1>`,
  `        <button \n          className={\`\${styles.tabButton} \${activeTab === 'deductions' ? styles.tabButtonActive : ''}\`}\n          onClick={() => setActiveTab('deductions')}\n        >\n          الخصومات\n        </button>\n        <button \n          className={\`\${styles.tabButton} \${activeTab === 'bonuses' ? styles.tabButtonActive : ''}\`}\n          onClick={() => setActiveTab('bonuses')}\n        >\n          المكافآت والزيادات\n        </button>\n      </div>\n\n      <header className={styles.header}>\n        <h1 className={styles.title}>\n          {activeTab === 'management' ? 'قائمة الموظفين' : \n           activeTab === 'payroll' ? 'الرواتب والعمولات' : \n           activeTab === 'deductions' ? 'خصومات الموظفين' : \n           activeTab === 'bonuses' ? 'مكافآت وزيادات الموظفين' : 'سجل الغيابات والحضور'}\n        </h1>`
);

// Block 8: Table UI Header
content = content.replace(
  `                  <th>إجمالي العمولات</th>\n                  <th>الخصميات (أيام الغياب)</th>\n                  <th>الصافي المستحق</th>\n                  <th>العمليات</th>`,
  `                  <th>إجمالي العمولات</th>\n                  <th>الخصميات (والغياب)</th>\n                  <th>المكافآت والزيادات</th>\n                  <th>الصافي المستحق</th>\n                  <th>العمليات</th>`
);

// Block 8: Table UI Body
content = content.replace(
  `                      <td style={{ color: (pData.deductions + pData.manualDeductions) > 0 ? '#ef4444' : 'inherit' }}>\n                        {formatCurrency(pData.deductions + pData.manualDeductions)} \n                        {pData.absentDays > 0 && (\n                          <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '4px' }}>({pData.absentDays} يوم غياب)</span>\n                        )}\n                        {pData.manualDeductions > 0 && (\n                          <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '4px' }}>+ يدوي</span>\n                        )}\n                      </td>\n                      <td style={{ color: '#10b981', fontWeight: 'bold' }}>{formatCurrency(pData.netDue)}</td>`,
  `                      <td style={{ color: (pData.deductions + pData.manualDeductions) > 0 ? '#ef4444' : 'inherit' }}>\n                        {formatCurrency(pData.deductions + pData.manualDeductions)} \n                        {pData.absentDays > 0 && (\n                          <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '4px' }}>({pData.absentDays} يوم غياب)</span>\n                        )}\n                        {pData.manualDeductions > 0 && (\n                          <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '4px' }}>+ يدوي</span>\n                        )}\n                      </td>\n                      <td style={{ color: pData.manualBonuses > 0 ? '#10b981' : 'inherit' }}>\n                        {formatCurrency(pData.manualBonuses)}\n                      </td>\n                      <td style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}>{formatCurrency(pData.netDue)}</td>`
);

// Block 8: Table UI Footer
content = content.replace(
  `                  <td colSpan={3} style={{ textAlign: 'left', padding: '1rem' }}>الإجمالي الكلي:</td>\n                  <td style={{ color: '#ef4444' }}>\n                    {formatCurrency(employees.reduce((sum, emp) => sum + (globalPayrollData[emp.id]?.deductions || 0) + (globalPayrollData[emp.id]?.manualDeductions || 0), 0))}\n                  </td>\n                  <td style={{ color: '#10b981', fontSize: '1.1rem' }}>\n                    {formatCurrency(employees.reduce((sum, emp) => sum + (globalPayrollData[emp.id]?.netDue || 0), 0))}\n                  </td>\n                  <td></td>\n                </tr>`,
  `                  <td colSpan={3} style={{ textAlign: 'left', padding: '1rem' }}>الإجمالي الكلي:</td>\n                  <td style={{ color: '#ef4444' }}>\n                    {formatCurrency(employees.reduce((sum, emp) => sum + (globalPayrollData[emp.id]?.deductions || 0) + (globalPayrollData[emp.id]?.manualDeductions || 0), 0))}\n                  </td>\n                  <td style={{ color: '#10b981' }}>\n                    {formatCurrency(employees.reduce((sum, emp) => sum + (globalPayrollData[emp.id]?.manualBonuses || 0), 0))}\n                  </td>\n                  <td style={{ color: '#10b981', fontSize: '1.1rem' }}>\n                    {formatCurrency(employees.reduce((sum, emp) => sum + (globalPayrollData[emp.id]?.netDue || 0), 0))}\n                  </td>\n                  <td></td>\n                </tr>`
);

// Block 10: Payroll Modal UI
content = content.replace(
  `                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}>\n                            <span>إجمالي العمولات:</span>\n                            <span style={{ fontWeight: 'bold' }}>+ {formatCurrency(attendanceData.totalCommission)}</span>\n                          </div>\n                        </>\n                      )}\n\n                      {/* Total Calculation */}`,
  `                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}>\n                            <span>إجمالي العمولات:</span>\n                            <span style={{ fontWeight: 'bold' }}>+ {formatCurrency(attendanceData.totalCommission)}</span>\n                          </div>\n                        </>\n                      )}\n\n                      {/* Manual Deductions & Bonuses Row */}\n                      {globalPayrollData[selectedAttendanceEmployee.id]?.manualDeductions > 0 && (\n                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', marginTop: '0.5rem' }}>\n                          <span>الخصومات والسلف:</span>\n                          <span style={{ fontWeight: 'bold' }}>- {formatCurrency(globalPayrollData[selectedAttendanceEmployee.id]?.manualDeductions)}</span>\n                        </div>\n                      )}\n                      \n                      {globalPayrollData[selectedAttendanceEmployee.id]?.manualBonuses > 0 && (\n                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', marginTop: '0.5rem' }}>\n                          <span>المكافآت والزيادات:</span>\n                          <span style={{ fontWeight: 'bold' }}>+ {formatCurrency(globalPayrollData[selectedAttendanceEmployee.id]?.manualBonuses)}</span>\n                        </div>\n                      )}\n\n                      {/* Total Calculation */}`
);

// Block 10: Payroll Modal Math
content = content.replace(
  `                            {formatCurrency(\n                              (selectedAttendanceEmployee.paymentType !== 'commission' ? (globalPayrollData[selectedAttendanceEmployee.id]?.proRatedBase || 0) : 0) +\n                              (selectedAttendanceEmployee.paymentType !== 'salary' ? attendanceData.totalCommission : 0) -\n                              (selectedAttendanceEmployee.paymentType !== 'commission' ? (globalPayrollData[selectedAttendanceEmployee.id]?.deductions || 0) : 0)\n                            )}`,
  `                            {formatCurrency(\n                              globalPayrollData[selectedAttendanceEmployee.id]?.netDue || 0\n                            )}`
);

// Block 9: Bonuses full UI section
// Extract the deductions block exactly
const deductionsStartStr = "{activeTab === 'deductions' && (";
const deductionsStartIdx = content.indexOf(deductionsStartStr);
if (deductionsStartIdx !== -1) {
  const attendanceStartStr = "{activeTab === 'attendance' && (";
  const attendanceStartIdx = content.indexOf(attendanceStartStr, deductionsStartIdx);
  if (attendanceStartIdx !== -1) {
    const deductionsHtml = content.substring(deductionsStartIdx, attendanceStartIdx);
    
    // Build bonusesHtml
    let bonusesHtml = deductionsHtml
      .replace(/'deductions'/g, "'bonuses'")
      .replace(/تسجيل خصم جديد/g, 'تسجيل مكافأة جديدة (أو زيادة)')
      .replace(/handleSaveDeduction/g, 'handleSaveBonus')
      .replace(/deductionForm/g, 'bonusForm')
      .replace(/setDeductionForm/g, 'setBonusForm')
      .replace(/مبلغ الخصم/g, 'مبلغ المكافأة')
      .replace(/تاريخ الخصم/g, 'تاريخ المكافأة')
      .replace(/سبب الخصم/g, 'سبب المكافأة \\/ الزيادة')
      .replace(/مثال: تأخير، غياب، خطأ في طلب.../g, 'مثال: مكافأة الأداء، زيادة يومية، تعويض...')
      .replace(/حفظ الخصم/g, 'حفظ المكافأة')
      .replace(/الخصومات المسجلة/g, 'المكافآت والزيادات المسجلة')
      .replace(/تاريخ الخصم/g, 'التاريخ')
      .replace(/deductionsList/g, 'bonusesList')
      .replace(/لا توجد خصومات مسجلة/g, 'لا توجد مكافآت مسجلة')
      .replace(/handleDeleteDeduction/g, 'handleDeleteBonus')
      .replace(/حذف الخصم/g, 'حذف المكافأة')
      .replace(/#ef4444/g, '#10b981'); // Change red to green

    // Now insert it right before the attendance start
    content = content.substring(0, attendanceStartIdx) + bonusesHtml + "\\n\\n      " + content.substring(attendanceStartIdx);
  }
}

// Ensure Windows CRLF is maintained if needed, or just let git handle it. 
// Writing with \n is fine, git will convert to CRLF on checkout if configured, 
// but saving as \n is standard for modern web.
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully modified page.tsx');
