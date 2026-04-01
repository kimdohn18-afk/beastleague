'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PlacementPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/match');
  }, [router]);
  return null;
}
