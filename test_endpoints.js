const http = require('http');

// Color codes for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';

// Test endpoints with HTTP requests
const endpoints = [
  { path: '/menu', method: 'GET', shouldContain: ['price', '50,000', 'Thực'] },
  { path: '/about', method: 'GET', shouldContain: ['html'] },
  { path: '/blog', method: 'GET', shouldContain: ['html'] },
  { path: '/login', method: 'GET', shouldContain: ['username'] }
];

const testEndpoint = (path, method, shouldContain) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: method,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const success = shouldContain.every(keyword => 
          data.toLowerCase().includes(keyword.toLowerCase())
        );
        
        resolve({
          path,
          statusCode: res.statusCode,
          success: res.statusCode === 200 && (shouldContain.length === 0 || success),
          hasErrors: data.includes('[object Object]') || data.includes('undefined') || data.includes('Error'),
          dataLength: data.length,
          message: success ? 'Content verified' : `Missing: ${shouldContain.join(', ')}`
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        path,
        statusCode: 0,
        success: false,
        hasErrors: true,
        message: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        path,
        statusCode: 0,
        success: false,
        hasErrors: true,
        message: 'Timeout'
      });
    });

    req.end();
  });
};

const runTests = async () => {
  console.log(YELLOW + '\n========== ENDPOINT TESTS ==========\n' + RESET);

  let passed = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.path, endpoint.method, endpoint.shouldContain);
    
    if (result.success && !result.hasErrors) {
      console.log(GREEN + `✓ ${result.path}` + RESET);
      console.log(`  Status: ${result.statusCode}  |  Size: ${result.dataLength}b  |  ${result.message}`);
      passed++;
    } else {
      console.log(RED + `✗ ${result.path}` + RESET);
      console.log(`  Status: ${result.statusCode}  |  ${result.message}`);
      if (result.hasErrors) console.log('  ⚠️  Found error markers in response');
      failed++;
    }
    console.log('');
  }

  console.log(YELLOW + '========== SUMMARY ==========' + RESET);
  console.log(`Passed: ${GREEN}${passed}${RESET}  |  Failed: ${RED}${failed}${RESET}`);
  console.log(`Total: ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
};

runTests().catch(console.error);
