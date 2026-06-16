import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create the upload directory in public/uploads/expenses
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'expenses');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename to prevent overwrites
    const ext = path.extname(file.name) || '.png';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${Date.now()}_${cleanFileName}${ext}`;
    const filePath = path.join(uploadDir, filename);

    // Write file to filesystem
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/uploads/expenses/${filename}`;
    return NextResponse.json({ url: fileUrl });
  } catch (error: any) {
    console.error('Local upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
