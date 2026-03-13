import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ACCL - American Correspondence Chess League',
  description: 'Online correspondence chess platform with long time controls',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
