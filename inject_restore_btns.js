const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'employees', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add handleRestoreDeduction and handleRestoreBonus
const deleteDeductionStr = `  const handleDeleteDeduction = async (id: string) => {`;
const restoreDeductionStr = `  const handleRestoreDeduction = async (id: string) => {
    if (!window.confirm("هل تريد إرجاع هذا الخصم كخصم (غير مدفوع) ليتم خصمه من الراتب القادم؟")) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'deductions', id), { isPaid: false });
      showToastMsg("تم إرجاع الخصم بنجاح، سيتم احتسابه في الراتب القادم.");
    } catch (err) {
      console.error(err);
      showToastMsg("حدث خطأ أثناء الإرجاع", "error");
    }
  };\n\n`;
content = content.replace(deleteDeductionStr, restoreDeductionStr + deleteDeductionStr);

const deleteBonusStr = `  const handleDeleteBonus = async (id: string) => {`;
const restoreBonusStr = `  const handleRestoreBonus = async (id: string) => {
    if (!window.confirm("هل تريد إرجاع هذه المكافأة كمكافأة (غير مدفوعة) ليتم إضافتها للراتب القادم؟")) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'bonuses', id), { isPaid: false });
      showToastMsg("تم إرجاع المكافأة بنجاح، سيتم احتسابها في الراتب القادم.");
    } catch (err) {
      console.error(err);
      showToastMsg("حدث خطأ أثناء الإرجاع", "error");
    }
  };\n\n`;
content = content.replace(deleteBonusStr, restoreBonusStr + deleteBonusStr);

// 2. Add the buttons to the Deductions table
const deductionBtnUI = `                        <button 
                          onClick={() => handleDeleteDeduction(d.id)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.4rem 0.6rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid' }}
                          title="حذف الخصم"
                        >
                          🗑️
                        </button>`;
const newDeductionBtnUI = `                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button 
                            onClick={() => handleRestoreDeduction(d.id)}
                            style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#3b82f6', padding: '0.4rem 0.6rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid' }}
                            title="إرجاع الخصم كغير مدفوع"
                          >
                            🔄
                          </button>
                          <button 
                            onClick={() => handleDeleteDeduction(d.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.4rem 0.6rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid' }}
                            title="حذف الخصم نهائياً"
                          >
                            🗑️
                          </button>
                        </div>`;
content = content.replace(deductionBtnUI, newDeductionBtnUI);

// 3. Add the buttons to the Bonuses table
const bonusBtnUI = `                        <button 
                          onClick={() => handleDeleteBonus(d.id)}
                          style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '0.4rem 0.6rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid' }}
                          title="حذف المكافأة"
                        >
                          🗑️
                        </button>`;
const newBonusBtnUI = `                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button 
                            onClick={() => handleRestoreBonus(d.id)}
                            style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#3b82f6', padding: '0.4rem 0.6rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid' }}
                            title="إرجاع المكافأة كغير مدفوعة"
                          >
                            🔄
                          </button>
                          <button 
                            onClick={() => handleDeleteBonus(d.id)}
                            style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '0.4rem 0.6rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid' }}
                            title="حذف المكافأة نهائياً"
                          >
                            🗑️
                          </button>
                        </div>`;
content = content.replace(bonusBtnUI, newBonusBtnUI);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script completed.');
