const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'employees', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state
const stateInjectionStr = `  const [wallets, setWallets] = useState<any[]>([]);`;
content = content.replace(
  stateInjectionStr,
  stateInjectionStr + `\n  const [treasuryTransactions, setTreasuryTransactions] = useState<any[]>([]);`
);

// 2. Add effect
const effectInjectionStr = `  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'wallets'), (snap) => {
      setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);`;
const newEffectInjectionStr = `  useEffect(() => {
    const unsubWallets = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'wallets'), (snap) => {
      setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTreasury = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions'), (snap) => {
      setTreasuryTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubWallets(); unsubTreasury(); };
  }, []);`;
content = content.replace(effectInjectionStr, newEffectInjectionStr);

// 3. Add getWalletBalance function before handlePaySalary
const handlePayStr = `  const handlePaySalary = (empId: string) => {`;
const getWalletBalanceStr = `  const getWalletBalance = (walletId: string, curr: string = 'IQD') => {
    return treasuryTransactions.reduce((total, t) => {
      if (t.currency !== curr) return total;
      if (t.type === 'deposit' && t.walletId === walletId) return total + t.amount;
      if (t.type === 'withdraw' && t.walletId === walletId) return total - t.amount;
      if (t.type === 'transfer') {
        if (t.fromWalletId === walletId) return total - t.amount;
        if (t.toWalletId === walletId) return total + t.amount;
      }
      return total;
    }, 0);
  };\n\n`;
content = content.replace(handlePayStr, getWalletBalanceStr + handlePayStr);

// 4. Add validation in confirmPaySalary
const confirmPayStart = `  const confirmPaySalary = async () => {
    if (!payModal) return;
    if (!payModal.walletId && payModal.netDue > 0) {
      showToastMsg("يرجى اختيار المحفظة", "error");
      return;
    }`;
const validationStr = `\n
    if (payModal.netDue > 0 && payModal.walletId) {
      const currentBalance = getWalletBalance(payModal.walletId, 'IQD');
      if (payModal.netDue > currentBalance) {
        showToastMsg("عذراً، الرصيد المتوفر في هذه المحفظة غير كافٍ لتسديد الراتب.", "error");
        return;
      }
    }`;
content = content.replace(confirmPayStart, confirmPayStart + validationStr);

// 5. Update dropdown to show balance
const oldOption = `<option key={w.id} value={w.id}>{w.name}</option>`;
const newOption = `<option key={w.id} value={w.id}>{w.name} (الرصيد: {formatCurrency(getWalletBalance(w.id, 'IQD'))})</option>`;
content = content.replace(oldOption, newOption);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully injected balance validation logic.');
