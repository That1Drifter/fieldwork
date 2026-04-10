import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'fieldwork',
  description: 'Practice forward-deployed engineering against simulated customer environments.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
