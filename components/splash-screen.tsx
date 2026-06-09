import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashScreen() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      router.push('/dashboard');
    }, 3000); // 3 seconds

    return () => clearTimeout(timer);
  }, [router]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="relative h-32 w-32 animate-pulse">
        <Image
          src="/logo 3.jpeg"
          alt="WMS Logo"
          fill
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
