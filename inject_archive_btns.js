const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'employees', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Inject functions below handleRestoreFromFinal
const functionsStr = `  const handleHideArchiveRecord = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من إخفاء هذه العملية من الأرشيف النهائي؟ (لن يتم استرجاع الراتب للموظف، فقط تنظيف الشاشة)")) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'salary_payments', id), { isHidden: true });
      showToastMsg("تم إخفاء العملية بنجاح");
    } catch (error) {
      console.error(error);
      showToastMsg("حدث خطأ أثناء المحاولة", "error");
    }
  };

  const handleUndoSalaryPayment = async (item: any) => {
    if (!window.confirm("تحذير ⚠️: هل أنت متأكد من إلغاء تسديد هذا الراتب بالكامل؟ سيتم إرجاع كافة الطلبات والرواتب للموظف ليتم الدفع له من جديد.")) return;
    
    try {
      const batch = writeBatch(db);
      
      // Unpay Orders
      if (item.orderIds && item.orderIds.length > 0) {
        item.orderIds.forEach((orderId: string) => {
          const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
          batch.update(orderRef, { isPaidToStaff: false });
        });
      }

      // Delete the payment document entirely
      const paymentRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'salary_payments', item.id);
      batch.delete(paymentRef);
      
      await batch.commit();
      showToastMsg("تم إلغاء العملية واسترجاع الراتب! يرجى إلغاء حركة الخزنة يدوياً.", "success");
    } catch (error) {
      console.error(error);
      showToastMsg("حدث خطأ أثناء الإلغاء", "error");
    }
  };
`;

const insertAfterStr = `  const handleRestoreFromFinal = async (id: string) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'salary_payments', id), { isArchivedFinal: false });
      await batch.commit();
      showToastMsg("تمت استعادة العملية للأرشيف النشط");
    } catch (error) {
      console.error(error);
      showToastMsg("حدث خطأ أثناء المحاولة", "error");
    }
  };\n`;

if (content.includes(insertAfterStr)) {
  content = content.replace(insertAfterStr, insertAfterStr + '\n' + functionsStr);
  console.log("Functions injected.");
} else {
  console.log("Could not find insertAfterStr!");
}

// 2. Inject filter
const oldFilter = `                    {archiveData
                      .filter(item => archiveTab === 'final' ? item.isArchivedFinal === true : !item.isArchivedFinal)
                      .length > 0 ? archiveData
                      .filter(item => archiveTab === 'final' ? item.isArchivedFinal === true : !item.isArchivedFinal)
                      .map((item) => {`;
const newFilter = `                    {archiveData
                      .filter(item => !item.isHidden)
                      .filter(item => archiveTab === 'final' ? item.isArchivedFinal === true : !item.isArchivedFinal)
                      .length > 0 ? archiveData
                      .filter(item => !item.isHidden)
                      .filter(item => archiveTab === 'final' ? item.isArchivedFinal === true : !item.isArchivedFinal)
                      .map((item) => {`;
content = content.replace(oldFilter, newFilter);

// 3. Inject buttons
const oldButtons = `                              ) : (
                                <button 
                                  className={styles.actionBtn} 
                                  style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}
                                  onClick={() => handleRestoreFromFinal(item.id)}
                                  title="استعادة"
                                >
                                  🔄
                                </button>
                              )}`;
const newButtons = `                              ) : (
                                <>
                                  <button 
                                    className={styles.actionBtn} 
                                    style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}
                                    onClick={() => handleRestoreFromFinal(item.id)}
                                    title="استعادة للأرشيف النشط"
                                  >
                                    🔄
                                  </button>
                                  <button 
                                    className={styles.actionBtn} 
                                    style={{ background: 'rgba(75, 85, 99, 0.15)', borderColor: 'rgba(75, 85, 99, 0.3)', color: '#9ca3af' }}
                                    onClick={() => handleHideArchiveRecord(item.id)}
                                    title="إخفاء من الشاشة"
                                  >
                                    👁‍🗨
                                  </button>
                                  <button 
                                    className={styles.actionBtn} 
                                    style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                                    onClick={() => handleUndoSalaryPayment(item)}
                                    title="إلغاء العملية بالكامل (استرجاع الراتب)"
                                  >
                                    ⚠️
                                  </button>
                                </>
                              )}`;
content = content.replace(oldButtons, newButtons);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done.");
