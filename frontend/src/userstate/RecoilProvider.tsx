'use client';

import { ReactNode } from 'react';
import { RecoilRoot } from 'recoil';

interface RecoilProviderProps {
  children: ReactNode;
}

export default function RecoilProvider({ children }: RecoilProviderProps) {
  return <RecoilRoot>{children}</RecoilRoot>;
}
