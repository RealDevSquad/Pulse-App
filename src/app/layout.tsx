import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { MotionProvider } from '@/components/motion-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pulse - Real Dev Squad',
  description: 'Dashboard for monitoring team activity and task progress',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
