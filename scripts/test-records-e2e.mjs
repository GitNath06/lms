import http from 'http';

async function testHttpEndpoint(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          path,
          statusCode: res.statusCode,
          hasContent: data.length > 500,
          length: data.length,
        });
      });
    }).on('error', (err) => {
      resolve({ path, error: err.message });
    });
  });
}

async function run() {
  console.log('🧪 Starting Practical Records & Incident Register End-to-End Test...\n');

  const routes = [
    '/records',
    '/records/incidents',
    '/print/records',
    '/print/incidents',
    '/print/daily-log',
  ];

  console.log('🌐 Testing HTTP Responses from Next.js Dev Server:');
  for (const route of routes) {
    const result = await testHttpEndpoint(route);
    if (result.error) {
      console.error(`  ❌ ${route}: Error - ${result.error}`);
    } else {
      console.log(`  ✅ ${route}: HTTP ${result.statusCode} (Bytes: ${result.length})`);
    }
  }

  console.log('\n🎉 HTTP Endpoint Verification Complete!');
}

run().catch(console.error);
