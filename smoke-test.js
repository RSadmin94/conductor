// Smoke test script for deployment verification
// Only 3 checks: landing page, create idea, report endpoint

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function smokeTest() {
  console.log('=== Smoke Test ===\n');
  let passed = 0;
  let failed = 0;

  // Test 1: Landing page loads
  try {
    console.log('1. Testing landing page...');
    const response = await fetch(`${BASE_URL}/`);
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      console.log('   ✓ Landing page loads\n');
      passed++;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`   ✗ Landing page failed: ${error.message}\n`);
    failed++;
  }

  // Test 2: Create idea works
  try {
    console.log('2. Testing create idea...');
    const response = await fetch(`${BASE_URL}/api/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Smoke test idea' }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (data.projectId && data.ideaId) {
      console.log(`   ✓ Create idea works (projectId: ${data.projectId})\n`);
      passed++;
      global.testProjectId = data.projectId;
    } else {
      throw new Error('Missing projectId or ideaId in response');
    }
  } catch (error) {
    console.error(`   ✗ Create idea failed: ${error.message}\n`);
    failed++;
  }

  // Test 3: Report endpoint returns Markdown
  try {
    console.log('3. Testing report endpoint...');
    if (!global.testProjectId) {
      throw new Error('No projectId from previous test');
    }
    
    const response = await fetch(`${BASE_URL}/api/projects/${global.testProjectId}/report`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    if (contentType?.includes('text/markdown') || contentType?.includes('text/plain')) {
      if (text.includes('# Project Report') || text.includes('Project Report')) {
        console.log('   ✓ Report endpoint returns Markdown\n');
        passed++;
      } else {
        throw new Error('Report content missing expected header');
      }
    } else {
      throw new Error(`Wrong content type: ${contentType}`);
    }
  } catch (error) {
    console.error(`   ✗ Report endpoint failed: ${error.message}\n`);
    failed++;
  }

  // Summary
  console.log('=== Summary ===');
  console.log(`Passed: ${passed}/3`);
  console.log(`Failed: ${failed}/3`);
  
  if (failed === 0) {
    console.log('\n✓ All smoke tests passed!');
    process.exit(0);
  } else {
    console.log('\n✗ Some smoke tests failed');
    process.exit(1);
  }
}

// Use node-fetch if available, otherwise use built-in fetch (Node 18+)
if (typeof fetch === 'undefined') {
  const { default: fetch } = require('node-fetch');
  global.fetch = fetch;
}

smokeTest().catch(error => {
  console.error('Smoke test error:', error);
  process.exit(1);
});

