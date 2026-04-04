import './globals.css';
import type { Metadata } from 'next';
import ClientLayout from '../components/ClientLayout';

export const metadata: Metadata = {
  title: 'نظام المخازن والمبيعات',
  description: 'إدارة المخزون والمنتجات التجميعية المتقدمة',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
