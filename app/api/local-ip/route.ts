import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  const interfaces = os.networkInterfaces();
  let ipAddress = '127.0.0.1';

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (iface) {
      for (const net of iface) {
        // Skip over non-IPv4 and internal loopback addresses
        if (net.family === 'IPv4' && !net.internal) {
          ipAddress = net.address;
          break;
        }
      }
    }
    if (ipAddress !== '127.0.0.1') {
      break;
    }
  }

  return NextResponse.json({ ip: ipAddress });
}
