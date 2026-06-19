const input = "قاصة التحدي مليون";
const dbValue = "قاصة التحدي  مليون";

const normalizeStr = (str) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();

console.log("Input normalized:", normalizeStr(input));
console.log("DB value normalized:", normalizeStr(dbValue));
console.log("Matches?", normalizeStr(dbValue).includes(normalizeStr(input)));

// Let's also check if there is any hidden unicode char
console.log(Buffer.from(normalizeStr(input)).toString('hex'));
console.log(Buffer.from(normalizeStr(dbValue)).toString('hex'));
