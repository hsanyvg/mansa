import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mansa.inventory',
  appName: 'Mansa Inventory',
  webDir: 'out', // The CLI requires this field even when using a server URL
  server: {
    // Replace this with your official platform website URL, e.g., https://mansa-inventory.com
    url: 'https://your-official-website.com/mobile', 
    cleartext: true
  }
};

export default config;
