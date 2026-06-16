const fetch = require('node-fetch');

async function checkBuild() {
  const url = 'https://expo.dev/accounts/hsanyvg/projects/mansa-mobile/builds/d0796ad8-fd90-4dd3-a461-3c4ffa662ca6';
  console.log("Fetching build page...");
  const res = await fetch(url);
  const text = await res.text();
  
  console.log("Page size:", text.length);
  
  // Look for "status" or "state" or "FINISHED" / "PENDING" / "BUILDING"
  const states = ['FINISHED', 'PENDING', 'BUILDING', 'FAILED', 'COMPLETED', 'CANCELED', 'error', 'success'];
  for (const state of states) {
    const idx = text.indexOf(state);
    if (idx !== -1) {
      console.log(`Found state keyword '${state}' at index ${idx}. Context:`, text.substring(idx - 50, idx + 150));
    }
  }

  // Look for APK download link
  const apkMatches = text.match(/https:\/\/expo\.dev\/artifacts\/eas\/[^"]+\.apk/g);
  if (apkMatches) {
    console.log("Found APK matches:", apkMatches);
  } else {
    console.log("No direct APK matches found.");
  }
}

checkBuild().catch(console.error);
