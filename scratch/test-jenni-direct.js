async function testJenni() {
  const username = '07768789880';
  const password = '11223344';

  console.log(`Testing Jenni API login for user: ${username}...`);
  try {
    const loginRes = await fetch('https://almasara.jenni.delivery/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    console.log(`Login response status: ${loginRes.status}`);
    const loginData = await loginRes.json();
    console.log('Login response data:', loginData);
    
    if (loginRes.ok && loginData.token) {
      console.log('Login successful! Testing shipment query...');
      const token = loginData.token.replace('Bearer ', '').trim();
      const queryRes = await fetch('https://almasara.jenni.delivery/api/v2/shipments/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_numbers: ['100000'] })
      });
      console.log(`Query response status: ${queryRes.status}`);
      const queryData = await queryRes.json();
      console.log('Query response data:', queryData);
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}

testJenni().then(() => process.exit(0));
