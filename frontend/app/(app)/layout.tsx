import { Navbar } from '@/components/Navbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '40px 24px 80px',
        }}
      >
        {children}
      </main>
    </>
  );
}
