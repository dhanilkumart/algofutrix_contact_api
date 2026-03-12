const API_URL = process.env.API_URL || "http://localhost:3000/api/contact";
const CAPTCHA_TOKEN = process.env.CAPTCHA_TOKEN || "";

async function testWithOrigin(origin) {
  try {
    console.log(`Testing with Origin: ${origin || 'none'}`);
    const headers = { 'Content-Type': 'application/json' };
    if (origin) headers['Origin'] = origin;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        service: 'Web Dev',
        details: 'Testing locally',
        captchaToken: CAPTCHA_TOKEN
      })
    });
    const data = await response.json().catch(() => 'no json');
    console.log('Response status:', response.status);
    console.log('Response body:', data);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

async function runTests() {
  if (!CAPTCHA_TOKEN) {
    console.log("Set CAPTCHA_TOKEN env var before running this test.");
    return;
  }
  await testWithOrigin('https://algofutrix.com'); // Should be OK
  await testWithOrigin('https://invalid.com');   // Should be 403 or 500?
}

runTests();
