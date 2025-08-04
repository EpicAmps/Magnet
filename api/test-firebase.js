// Create this file as: api/test-firebase.js

export default async function handler(req, res) {
  console.log('=== TESTING FIREBASE IMPORTS ===');
  
  try {
    // Test 1: Basic imports
    console.log('Step 1: Testing Firebase imports...');
    const { initializeApp } = await import("firebase/app");
    const { getFirestore, collection, addDoc } = await import("firebase/firestore");
    console.log('✅ Firebase imports successful');

    // Test 2: Environment variables
    console.log('Step 2: Testing environment variables...');
    const envCheck = {
      hasApiKey: !!process.env.FIREBASE_API_KEY,
      hasAuthDomain: !!process.env.FIREBASE_AUTH_DOMAIN,
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasStorageBucket: !!process.env.FIREBASE_STORAGE_BUCKET,
      hasMessagingSenderId: !!process.env.FIREBASE_MESSAGING_SENDER_ID,
      hasAppId: !!process.env.FIREBASE_APP_ID,
      projectId: process.env.FIREBASE_PROJECT_ID
    };
    console.log('Environment check:', envCheck);

    // Test 3: Firebase initialization
    console.log('Step 3: Testing Firebase initialization...');
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('✅ Firebase initialized successfully');

    // Test 4: Test marked import
    console.log('Step 4: Testing marked import...');
    const { marked } = await import("marked");
    const testMarkdown = marked("# Test\n- [ ] Test item");
    console.log('✅ Marked library working, output:', testMarkdown.substring(0, 50));

    return res.json({
      success: true,
      message: 'All Firebase tests passed!',
      results: {
        importsWorking: true,
        environmentVariables: envCheck,
        firebaseInitialized: true,
        markedWorking: true,
        testMarkdownOutput: testMarkdown
      }
    });

  } catch (error) {
    console.error('❌ Firebase test failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Firebase test failed',
      details: error.message,
      stack: error.stack,
      step: 'Check console logs for which step failed'
    });
  }
}