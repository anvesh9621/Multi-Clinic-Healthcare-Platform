import React from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { LandingPageSections } from '@/components/landing/LandingPageSections';
import { HeartPulse, Stethoscope, ShieldCheck, Bone, Brain, type LucideIcon } from 'lucide-react';

async function getSpecialties(): Promise<string[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/public/specialties/`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function getSpecialtyIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes('cardio')) return HeartPulse;
  if (n.includes('neuro'))  return Brain;
  if (n.includes('pedia'))  return ShieldCheck;
  if (n.includes('ortho'))  return Bone;
  if (n.includes('ophtha') || n.includes('eye')) return Stethoscope;
  return Stethoscope;
}

function getSpecialtyDescription(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('cardio')) return "Advanced heart care, diagnostics, and customized treatment plans.";
  if (n.includes('neuro'))  return "Comprehensive care for brain, spine, and nervous system disorders.";
  if (n.includes('pedia'))  return "Compassionate and expert healthcare tailored for children.";
  if (n.includes('ortho'))  return "Specialized treatments for bone, joint, and muscle conditions.";
  return `Expert doctors providing specialized care in ${name}.`;
}

export default async function LandingPage() {
  const specialties = await getSpecialties();

  return (
    <div className="min-h-screen bg-paper font-sans text-ink selection:bg-primary/10 selection:text-primary">
      <Navbar />
      <HeroSection />
      <LandingPageSections
        specialties={specialties}
        getIcon={getSpecialtyIcon}
        getDescription={getSpecialtyDescription}
      />
    </div>
  );
}
