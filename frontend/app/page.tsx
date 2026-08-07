import React from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { LandingPageSections } from '@/components/landing/LandingPageSections';
async function getSpecialties(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/public/specialties/`,
      {
        next: { revalidate: 60 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}


export default async function LandingPage() {
  const specialties = await getSpecialties();

  return (
    <div className="min-h-screen bg-paper font-sans text-ink selection:bg-primary/10 selection:text-primary">
      <Navbar />
      <HeroSection />
      <LandingPageSections specialties={specialties} />
    </div>
  );
}
