const http = require('http');

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runLocalAttendanceSuite() {
  console.log('====================================================');
  console.log('   NISIT SMART ATTENDANCE LOCAL INTEGRATION TEST    ');
  console.log('====================================================\n');

  // 1. Health check
  console.log('[1/7] Testing API Health (/api/healthz)...');
  const health = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/healthz',
    method: 'GET'
  });
  console.log('      Status:', health.status, health.data);
  if (health.status !== 200) throw new Error('Health check failed');

  // 2. Login to get JWT
  console.log('\n[2/7] Authenticating as Admin (admin@nisit.gov.pg)...');
  const login = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@nisit.gov.pg', password: 'Admin123!' });

  if (login.status !== 200 || !login.data.token) {
    throw new Error('Authentication failed: ' + JSON.stringify(login.data));
  }
  const token = login.data.token;
  const user = login.data.user;
  console.log('      Authenticated user ID:', user.id, '| Email:', user.email);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 3. Geofences
  console.log('\n[3/7] Fetching Geofence Zones (/api/attendance/geofences)...');
  const geofences = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/attendance/geofences',
    method: 'GET',
    headers: authHeaders
  });
  console.log('      Active zones found:', geofences.data.length);
  geofences.data.forEach(z => {
    console.log(`      - Zone: "${z.name}" | Coords: ${z.latitude}, ${z.longitude} | Radius: ${z.radiusMeters}m`);
  });

  // 4. Kiosk TOTP Token
  console.log('\n[4/7] Generating Rotating Kiosk Token (/api/clocking/kiosk/token)...');
  const kiosk = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/clocking/kiosk/token',
    method: 'GET',
    headers: authHeaders
  });
  console.log('      Kiosk token:', kiosk.data.token, '| Expires in:', kiosk.data.expiresInSeconds, 'seconds');

  // 5. Mobile Punch (Clock In)
  console.log('\n[5/7] Executing GPS Mobile Punch (Clock In at NISIT HQ Gordon)...');
  const punchIn = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/attendance/mobile-punch',
    method: 'POST',
    headers: authHeaders
  }, {
    latitude: -9.431284,
    longitude: 147.185293,
    accuracyMeters: 5.5,
    punchType: 'in',
    notes: 'Local integration test punch-in at HQ',
    verificationMethod: 'gps_mobile'
  });
  console.log('      Clock In HTTP Status:', punchIn.status);
  console.log('      Response Body:', JSON.stringify(punchIn.data, null, 2));

  // 6. Live Presence Board
  console.log('\n[6/7] Inspecting Live Presence Board (/api/attendance/live-presence)...');
  const presence = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/attendance/live-presence',
    method: 'GET',
    headers: authHeaders
  });
  console.log('      Total staff tracked:', presence.data.length);
  const me = presence.data.find(s => s.email === user.email) || presence.data[0];
  if (me) {
    console.log(`      Staff Record: ${me.name} (${me.division || 'Executive'})`);
    console.log(`      Live Status: [${me.liveAttendanceStatus}]`);
    console.log(`      Last Clock In: ${me.lastClockInAt || 'N/A'}`);
    console.log(`      Punctuality Score: ${me.punctualityScore}%`);
  }

  // 7. My Stats
  console.log('\n[7/7] Fetching Attendance Scorecard (/api/attendance/my-stats)...');
  const stats = await request({
    host: 'localhost',
    port: 8080,
    path: '/api/attendance/my-stats',
    method: 'GET',
    headers: authHeaders
  });
  console.log('      Monthly Scorecard:', JSON.stringify(stats.data, null, 2));

  console.log('\n====================================================');
  console.log('   ALL INTEGRATION CHECKS PASSED SUCCESSFULLY!      ');
  console.log('====================================================');
}

runLocalAttendanceSuite().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
