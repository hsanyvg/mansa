const payload = {
  system_code: "TAJER_PRO_2026",
  username: "test",
  password: "123",
  updates: [
    {
      shipment_number: "SHIP-TEST-123",
      action_code: "SUCCESSFUL_DELIVERY",
      current_step: "DELIVERED",
      note: "تم التسليم بنجاح",
      amount_iqd: 50000
    }
  ]
};

fetch('http://localhost:3000/v2/push/update-status', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
.then(res => {
  console.log('Status:', res.status);
  return res.text();
})
.then(text => console.log('Response:', text))
.catch(err => console.error('Fetch Error:', err));
