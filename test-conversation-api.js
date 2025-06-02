// Test script for conversation API
const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api';

// Test data - replace with actual user IDs from your database
const testData = {
  // You'll need to replace these with actual user IDs from your database
  donorUserId: '68382dbf0060c3ec49a0e78f', // From the logs
  organizationUserId: '6838302f0060c3ec49a0e80e', // From the logs
  causeId: '683c1e7e72348658779ebecd', // From the logs
};

// Test with exact same format as RTK Query
async function testWithRTKQueryFormat() {
  try {
    console.log('🧪 Testing with RTK Query format...');

    const requestData = {
      participantId: testData.organizationUserId,
      initialMessage: 'Hello! I have a question about your cause.',
      relatedCause: testData.causeId
    };

    console.log('Request data:', JSON.stringify(requestData, null, 2));

    const response = await axios.post(`${BASE_URL}/messages/conversations`, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
        // Note: No auth token - we expect 401 error
      }
    });

    console.log('✅ Unexpected success!', response.data);

  } catch (error) {
    console.log('Response status:', error.response?.status);
    console.log('Response data:', error.response?.data);

    if (error.response?.status === 401) {
      console.log('✅ Expected 401 - authentication required');
    } else if (error.response?.status === 400) {
      console.log('❌ 400 Bad Request - this suggests the data format is wrong');
      console.log('Error message:', error.response?.data?.message);
    } else {
      console.log('❌ Unexpected error:', error.response?.status);
    }
  }
}

async function testConversationCreation() {
  try {
    console.log('🧪 Testing Conversation Creation API...');

    // First, let's test authentication
    console.log('\n1. Testing authentication...');

    // You'll need to get a valid JWT token first
    // For now, let's test without auth to see the error

    const conversationData = {
      participantId: testData.organizationUserId,
      initialMessage: 'Hello! I have a question about your cause.',
      relatedCause: testData.causeId
    };

    console.log('2. Testing conversation creation...');
    console.log('Request data:', conversationData);

    const response = await axios.post(`${BASE_URL}/messages/conversations`, conversationData, {
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
      }
    });

    console.log('✅ Success!', response.data);

  } catch (error) {
    console.log('❌ Error details:');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Error Data:', error.response?.data);
    console.log('Request URL:', error.config?.url);
    console.log('Request Method:', error.config?.method);
    console.log('Request Headers:', error.config?.headers);
    console.log('Request Data:', error.config?.data);

    if (error.response?.status === 401) {
      console.log('\n💡 This is expected - you need a valid JWT token');
      console.log('The API is working, but authentication is required');
    } else if (error.response?.status === 400) {
      console.log('\n💡 Bad Request - check the request data format');
    }
  }
}

async function testWithoutAuth() {
  try {
    console.log('\n🧪 Testing API endpoint accessibility...');

    // Test if the endpoint exists
    const response = await axios.post(`${BASE_URL}/messages/conversations`, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ API endpoint exists and requires authentication (expected)');
    } else if (error.response?.status === 400) {
      console.log('✅ API endpoint exists but request data is invalid');
      console.log('Error message:', error.response?.data?.message);
    } else {
      console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
    }
  }
}

// Run tests
testWithRTKQueryFormat()
  .then(() => testWithoutAuth())
  .then(() => testConversationCreation())
  .then(() => {
    console.log('\n🎉 API Test Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Check server logs for debug information');
    console.log('2. Compare request format with what RTK Query sends');
    console.log('3. Get a valid JWT token from login');
    console.log('4. Test with valid user IDs');
  });
