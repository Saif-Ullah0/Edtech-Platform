// Create a file: backend/debug/testApi.js
const fetch = require('node-fetch'); // You might need: npm install node-fetch

async function testProgressAPI() {
  console.log('🧪 Testing Progress API Endpoints...\n');

  try {
    // Step 1: Login to get authentication
    console.log('1️⃣ Logging in...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'user@example.com', 
        password: 'user123' 
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }

    // Get cookies from login response
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login successful');
    console.log('🍪 Cookies:', cookies ? 'Present' : 'Missing');

    // Step 2: Test get all progress
    console.log('\n2️⃣ Testing GET /api/progress/all...');
    const allProgressResponse = await fetch('http://localhost:5000/api/progress/all', {
      method: 'GET',
      headers: { 
        'Cookie': cookies || ''
      }
    });

    if (allProgressResponse.ok) {
      const allProgress = await allProgressResponse.json();
      console.log('✅ GET /api/progress/all successful');
      console.log('📊 Data:', JSON.stringify(allProgress, null, 2));
    } else {
      console.error('❌ GET /api/progress/all failed:', allProgressResponse.status);
      console.error('Error:', await allProgressResponse.text());
    }

    // Step 3: Test get course progress (assuming course ID 1)
    console.log('\n3️⃣ Testing GET /api/progress/course/1...');
    const courseProgressResponse = await fetch('http://localhost:5000/api/progress/course/1', {
      method: 'GET',
      headers: { 
        'Cookie': cookies || ''
      }
    });

    if (courseProgressResponse.ok) {
      const courseProgress = await courseProgressResponse.json();
      console.log('✅ GET /api/progress/course/1 successful');
      console.log('📊 Data:', JSON.stringify(courseProgress, null, 2));
    } else {
      console.error('❌ GET /api/progress/course/1 failed:', courseProgressResponse.status);
      console.error('Error:', await courseProgressResponse.text());
    }

    // Step 4: Test update module progress
    console.log('\n4️⃣ Testing PUT /api/progress/module...');
    const updateResponse = await fetch('http://localhost:5000/api/progress/module', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify({
        courseId: 1,
        moduleId: 2, // Try to complete module 2
        isCompleted: true,
        watchTime: 900,
        completionPercentage: 100
      })
    });

    if (updateResponse.ok) {
      const updateResult = await updateResponse.json();
      console.log('✅ PUT /api/progress/module successful');
      console.log('📊 Data:', JSON.stringify(updateResult, null, 2));
    } else {
      console.error('❌ PUT /api/progress/module failed:', updateResponse.status);
      console.error('Error:', await updateResponse.text());
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testProgressAPI();