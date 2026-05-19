/**
 * Local Cron Worker for CPO Alerts
 * 
 * This script is designed to run in the background (e.g., via pm2 or node)
 * It periodically calls the Next.js API route to trigger the automated CPO reports.
 * 
 * Usage: node cron-worker.js
 */

const http = require('http');

// The local URL of your Next.js application
const API_URL = 'http://localhost:3000/api/cron/cpo-alert';

// Interval to check (Default: every 5 minutes). 
// Note: The actual logic for whether to send or not is handled by the API itself if you implement interval checks, 
// OR the API will simply execute every time it is called.
// To perfectly match the user's dynamic setting, this script fetches the setting from Firebase, 
// but since this is a simple HTTP caller, we will just call it every X minutes. 
// For production, it's better to fetch the interval from the API.

let intervalMinutes = 60; // Default 60 minutes
let isRunning = false;

const triggerApi = () => {
  console.log(`[${new Date().toLocaleString()}] Triggering CPO Alert API...`);
  
  http.get(API_URL, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (res.statusCode === 200) {
          console.log(`[SUCCESS] API Response:`, response.message || response);
        } else {
          console.log(`[SKIPPED/ERROR] API Response (${res.statusCode}):`, response.message || response.error);
        }
      } catch (e) {
        console.log(`[ERROR] Failed to parse response:`, data);
      }
    });
  }).on('error', (err) => {
    console.log(`[ERROR] Network request failed (Is the Next.js server running on localhost:3000?):`, err.message);
  });
};

console.log(`🚀 Starting Local Cron Worker for CPO Alerts...`);
console.log(`⏱️  First trigger will occur in ${intervalMinutes} minutes.`);

// Call immediately once (Optional)
// triggerApi();

setInterval(triggerApi, intervalMinutes * 60 * 1000);
