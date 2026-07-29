const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'orders', 'list', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Hide returned_warehouse from dropdowns
content = content.replace(
  `if (key === 'delivered_settled' || key === 'partial_settled') return null;`,
  `if (key === 'returned_warehouse' || key === 'delivered_settled' || key === 'partial_settled') return null;`
);
content = content.replace(
  `if (key === 'delivered_settled' || key === 'partial_settled') return null;`,
  `if ((key === 'returned_warehouse' && order.status !== 'returned_warehouse') || key === 'delivered_settled' || key === 'partial_settled') return null;`
);

// 2. Add handleConfirmStagedReturns and modify handleReturnScan
const originalScanFunc = `  const handleReturnScan = async (scanned: string) => {
    if (isReceivingReturn || !scanned.trim()) return;
    setIsReceivingReturn(true);
    try {
      const found = orders.find(o => 
        o.id.toLowerCase() === scanned.toLowerCase() || 
        o.id.slice(-6).toLowerCase() === scanned.toLowerCase()
      );

      if (!found) {
        alert("❌ لم يتم العثور على الطلب");
        return;
      }

      if (found.status === 'returned_warehouse') {
        alert("⚠️ هذا الطلب مستلم كراجع مسبقاً.");
        return;
      }

      await confirmBulkStatusChange([found.id], 'returned_warehouse', true);
      
      setRecentlyReceivedReturns(prev => [found, ...prev].slice(0, 50));
      setReturnsScannerInput('');
      if (returnsScannerInputRef.current) returnsScannerInputRef.current.focus();

      const audio = new Audio('/success-beep.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));

    } catch (e: any) {
      alert(\`خطأ: \${e.message}\`);
    } finally {
      setIsReceivingReturn(false);
    }
  };`;

const newScanFunc = `  const handleConfirmStagedReturns = async () => {
    if (!receiverEmployee) {
      alert("الرجاء تحديد الموظف المستلم.");
      return;
    }
    if (recentlyReceivedReturns.length === 0) {
      alert("لم تقم بمسح أي طلبات لتأكيدها.");
      return;
    }

    setIsReceivingReturn(true);
    try {
      const targetOrderIds = recentlyReceivedReturns.map(o => o.id);

      await confirmBulkStatusChange(targetOrderIds, 'returned_warehouse', true);

      const counterRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'metadata', 'returnBatchCounter');
      const batchId = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let currentId = 1000;
        if (counterSnap.exists()) {
          currentId = counterSnap.data().lastId;
        }
        const newId = currentId + 1;
        transaction.set(counterRef, { lastId: newId }, { merge: true });
        return \`BATCH-\${newId}\`;
      });

      const batch = writeBatch(db);
      const batchDocRef = doc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'return_batches'));
      const orderDetailsForBatch = [];

      for (const orderId of targetOrderIds) {
        const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId);
        const orderData = orders.find(o => o.id === orderId);
        
        const currentTotal = orderData?.totalAmount || orderData?.price || 0;
        const currentDeliveryCost = orderData?.deliveryCost || 0;
        const restoredTotal = currentTotal + currentDeliveryCost;

        batch.update(orderRef, { 
          returnStatus: 'in_warehouse',
          isArchived: true,
          archivedAt: serverTimestamp(),
          deliveryCost: 0,
          totalAmount: restoredTotal
        });

        if (orderData) {
          orderDetailsForBatch.push({
            id: orderId,
            customerName: orderData.customerName || '---',
            totalAmount: restoredTotal,
            status: orderData.status
          });
        }
      }

      batch.set(batchDocRef, {
        batchId,
        timestamp: serverTimestamp(),
        receiverEmployee,
        deliveryAgent: deliveryAgent || 'غير محدد',
        ordersCount: targetOrderIds.length,
        orders: orderDetailsForBatch,
        notes: 'تم إنشاؤه عبر ماسح الباركود'
      });

      await batch.commit();

      setNotificationModal({ show: true, message: \`✅ تم استلام \${targetOrderIds.length} طلب وإنشاء وثيقة (رقم \${batchId}) بنجاح.\` });
      setRecentlyReceivedReturns([]);
      setShowReturnsModal(false);
      setReceiverEmployee('');
      setDeliveryAgent('');
    } catch (error) {
      alert(\`خطأ: \${error.message}\`);
    } finally {
      setIsReceivingReturn(false);
    }
  };

  const handleReturnScan = async (scanned) => {
    if (isReceivingReturn || !scanned.trim()) return;
    setIsReceivingReturn(true);
    try {
      const found = orders.find(o => 
        o.id.toLowerCase() === scanned.toLowerCase() || 
        o.id.slice(-6).toLowerCase() === scanned.toLowerCase()
      );

      if (!found) {
        alert("❌ لم يتم العثور على الطلب");
        return;
      }

      if (found.status === 'returned_warehouse') {
        alert("⚠️ هذا الطلب مستلم كراجع مسبقاً.");
        return;
      }
      
      if (recentlyReceivedReturns.some(o => o.id === found.id)) {
        alert("⚠️ تم مسح هذا الطلب للتو في هذه الجلسة.");
        return;
      }

      setRecentlyReceivedReturns(prev => [found, ...prev]);
      setReturnsScannerInput('');
      if (returnsScannerInputRef.current) returnsScannerInputRef.current.focus();

      const audio = new Audio('/success-beep.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));

    } catch (e) {
      alert(\`خطأ: \${e.message}\`);
    } finally {
      setIsReceivingReturn(false);
    }
  };`;

content = content.replace(originalScanFunc, newScanFunc);

// 3. Update the showReturnsModal UI
const originalUI = `<p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                  يمكنك استخدام جهاز الباركود لتمرير الطرود مباشرة. سيتم تغيير حالة الطلب إلى "راجع مخزن" وتأكيد الاستلام فوراً.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
                  <input
                    ref={returnsScannerInputRef}`;

const newUI = `<p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                  يرجى تحديد الموظف المستلم واسم المندوب، ثم امسح الطلبات بالباركود ليتم جمعها في كشف واحد.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', textAlign: 'right' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)' }}>الموظف المستلم <span style={{color: 'red'}}>*</span></label>
                    <select 
                      value={receiverEmployee} 
                      onChange={e => setReceiverEmployee(e.target.value)}
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="">اختر...</option>
                      {employeesList.map((name, idx) => (
                        <option key={idx} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)' }}>اسم المندوب المسلم</label>
                    <input 
                      type="text" 
                      value={deliveryAgent}
                      onChange={e => setDeliveryAgent(e.target.value)}
                      placeholder="اختياري..."
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
                  <input
                    ref={returnsScannerInputRef}`;

content = content.replace(originalUI, newUI);

// Add the Save Button UI
const originalFooter = `                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}`;

const newFooter = `                      </tbody>
                    </table>
                  </div>
                  
                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={handleConfirmStagedReturns}
                      disabled={isReceivingReturn || recentlyReceivedReturns.length === 0 || !receiverEmployee}
                      style={{
                        padding: '1rem 2rem',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#10b981',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        cursor: (isReceivingReturn || recentlyReceivedReturns.length === 0 || !receiverEmployee) ? 'not-allowed' : 'pointer',
                        opacity: (isReceivingReturn || recentlyReceivedReturns.length === 0 || !receiverEmployee) ? 0.5 : 1,
                        width: '100%'
                      }}
                    >
                      {isReceivingReturn ? 'جاري المعالجة...' : \`تأكيد وحفظ الكشف (\${recentlyReceivedReturns.length} طلبات)\`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}`;

content = content.replace(originalFooter, newFooter);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Update completed successfully.');
