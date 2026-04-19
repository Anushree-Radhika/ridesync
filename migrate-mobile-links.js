const { initializeApp, credential } = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin (assuming you have your service account keys set up)
// For simple config updates via Admin SDK, sometimes default credentials work,
// but usually it requires a service_account.json. We will try initializing empty first:
try {
  initializeApp(); // If running locally, you might need to export GOOGLE_APPLICATION_CREDENTIALS
} catch (err) {
  if (err.message.includes('already exists')) {
    // ignore
  } else {
    console.warn("⚠️ Ensure you have authenticated with the Firebase CLI using 'firebase login' and 'firebase use <project-id>' or set GOOGLE_APPLICATION_CREDENTIALS.");
  }
}

const updateEmailAuthDomain = async () => {
  console.log("Starting mobile link migration to Firebase Hosting domain...");
  // Use the default hosting domain for your project. 
  // It is usually PROJECT_ID.firebaseapp.com
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error("❌ Could not find NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local");
    return;
  }
  
  const hostingDomain = `${projectId}.firebaseapp.com`;
  
  const updateRequest = {
    mobileLinksConfig: {
      domain: hostingDomain,
    },
  };

  try {
    const projectConfigManager = getAuth().projectConfigManager();
    const response = await projectConfigManager.updateProjectConfig(updateRequest);
    console.log('✅ Project configuration updated successfully. You have migrated to Firebase Hosting links!');
    console.log(response);
  } catch (error) {
    console.error('❌ Error updating the project:', error.message);
    console.log("Tip: You may need to run this command securely using your Firebase Service Account.");
  }
};

updateEmailAuthDomain();
