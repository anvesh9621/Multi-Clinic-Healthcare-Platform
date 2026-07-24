import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Search, Calendar, Phone, Activity, ShieldCheck, HeartPulse, Stethoscope, Eye, Bone, Brain } from 'lucide-react';

async function getSpecialties() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/public/specialties/`, {
      next: { revalidate: 60 }
    });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

const getSpecialtyIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('cardio')) return HeartPulse;
  if (n.includes('neuro')) return Brain;
  if (n.includes('pedia')) return ShieldCheck;
  if (n.includes('ortho')) return Bone;
  if (n.includes('ophtha') || n.includes('eye')) return Eye;
  return Stethoscope;
};

const getSpecialtyDescription = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('cardio')) return "Advanced heart care, diagnostics, and customized treatment plans.";
  if (n.includes('neuro')) return "Comprehensive care for brain, spine, and nervous system disorders.";
  if (n.includes('pedia')) return "Compassionate and expert healthcare tailored for children.";
  if (n.includes('ortho')) return "Specialized treatments for bone, joint, and muscle conditions.";
  return `Expert doctors providing specialized care in ${name}.`;
};

export default async function LandingPage() {
  const specialties: string[] = await getSpecialties();

  return (
    <div className="min-h-screen bg-paper font-sans text-ink selection:bg-primary/10 selection:text-primary">
      <Navbar />
      
      <HeroSection />

      {/* Quick Services */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
           <div className="mb-14 text-center">
             <h2 className="text-3xl font-semibold text-gray-900 mb-4">Quick Services</h2>
             <p className="text-gray-600 max-w-2xl mx-auto">Access our most fundamental services instantly.</p>
           </div>
           
           <div className="grid md:grid-cols-3 gap-8">
             <Card hoverable className="p-8 text-center border-t-4 border-t-blue-500">
                <div className="w-16 h-16 mx-auto bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <Calendar className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Book Appointment</h3>
                <p className="text-gray-600 mb-8 leading-relaxed">Schedule your visit with top rated professionals across various specialties.</p>
                <Link href="/login" className="block w-full">
                  <Button variant="outline" className="w-full">Book Now</Button>
                </Link>
             </Card>
             <Card hoverable className="p-8 text-center border-t-4 border-t-red-500">
                <div className="w-16 h-16 mx-auto bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6">
                  <Activity className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Emergency Care</h3>
                <p className="text-gray-600 mb-8 leading-relaxed">Get immediate assistance for urgent medical care and emergencies.</p>
                <Link href="/login" className="block w-full">
                  <Button variant="outline" className="w-full">Call Now</Button>
                </Link>
             </Card>
             <Card hoverable className="p-8 text-center border-t-4 border-t-green-500">
                <div className="w-16 h-16 mx-auto bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                  <Phone className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Online Consultation</h3>
                <p className="text-gray-600 mb-8 leading-relaxed">Consult with doctors remotely from the comfort of your home anytime.</p>
                <Link href="/login" className="block w-full">
                  <Button variant="outline" className="w-full">Start Consult</Button>
                </Link>
             </Card>
           </div>
        </div>
      </section>

      {/* Premium Specialties */}
      <section className="py-24 bg-white border-t border-gray-100" id="specialties">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start mb-12 gap-6">
            <div>
              <h2 className="text-3xl font-semibold text-gray-900 mb-4">Our Premium Specialties</h2>
              <p className="text-gray-600 max-w-2xl">Experience world-class healthcare across numerous medical disciplines.</p>
            </div>
          </div>
          
          {specialties.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
               {specialties.map((spec, i) => {
                 const Icon = getSpecialtyIcon(spec);
                 return (
                   <div key={i} className="group border border-gray-100 rounded-2xl p-6 hover:shadow-xl hover:border-blue-100 transition-all bg-white flex flex-col h-full">
                     <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                       <Icon className="w-7 h-7" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">{spec}</h3>
                     <p className="text-gray-500 text-sm leading-relaxed mb-6 flex-grow">{getSpecialtyDescription(spec)}</p>
                     
                     <div className="mt-auto">
                       <Link href={`/specialties/${encodeURIComponent(spec)}`} className="block w-full">
                         <Button variant="outline" className="w-full">Find Doctor</Button>
                       </Link>
                     </div>
                   </div>
                 );
               })}
            </div>
          ) : (
             <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
               <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-4" />
               <h3 className="text-lg font-medium text-gray-900 mb-2">No Specialties Available</h3>
               <p className="text-gray-500">Currently there are no doctors available. Please check back later.</p>
             </div>
          )}
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 bg-gray-50 border-t border-gray-200" id="about">
        <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-semibold text-gray-900 mb-16">How It Works</h2>
            
            <div className="grid md:grid-cols-3 gap-12 relative">
               {/* Decorative Line hidden on mobile */}
               <div className="hidden md:block absolute top-1/2 left-0 w-full h-[2px] bg-gray-200 -z-10 -translate-y-[45px]"></div>
               
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                 <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl mb-6 shadow-md shadow-blue-200 ring-8 ring-white">
                   1
                 </div>
                 <h3 className="text-xl font-semibold text-gray-900 mb-3">Search Doctor</h3>
                 <p className="text-gray-600 leading-relaxed">Find the right specialist based on symptoms or specialty.</p>
               </div>
               
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                 <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl mb-6 shadow-md shadow-blue-200 ring-8 ring-white">
                   2
                 </div>
                 <h3 className="text-xl font-semibold text-gray-900 mb-3">Book Appointment</h3>
                 <p className="text-gray-600 leading-relaxed">Select a convenient time slot and confirm your visit instantly.</p>
               </div>

               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                 <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl mb-6 shadow-md shadow-blue-200 ring-8 ring-white">
                   3
                 </div>
                 <h3 className="text-xl font-semibold text-gray-900 mb-3">Get Treatment</h3>
                 <p className="text-gray-600 leading-relaxed">Receive premium medical care and manage your health records.</p>
               </div>
            </div>
        </div>
      </section>

      {/* ── Pricing / Subscription Section ──────────────────────────────────── */}
      <section className="py-28 bg-gray-50 border-t border-gray-100" id="pricing">
        <div className="max-w-7xl mx-auto px-6">
          {/* Heading */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium text-sm mb-6 border border-blue-100">
              Simple, Transparent Pricing
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
              Plans for Every Clinic
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              From solo practitioners to large multi-specialty hospitals — scale your practice with the right plan.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 items-start">

            {/* Starter */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col">
              <div className="mb-8">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Starter</p>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-5xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-500 mb-1.5">/month</span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">Perfect for solo practitioners getting started with digital scheduling.</p>
              </div>
              <ul className="space-y-3.5 mb-10 flex-grow">
                {[
                  '1 Doctor account',
                  'Up to 50 appointments/month',
                  'Basic patient records',
                  'Email notifications',
                  'Community support',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">✓</span>
                    {f}
                  </li>
                ))}
                {['Analytics & reporting', 'Billing & invoicing', 'Multi-clinic support'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 text-xs font-bold">✕</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <Button variant="outline" className="w-full">Get Started Free</Button>
              </Link>
            </div>

            {/* Professional — highlighted */}
            <div className="bg-blue-600 rounded-2xl shadow-2xl shadow-blue-600/30 p-8 flex flex-col relative ring-2 ring-blue-600 -mt-4 -mb-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-orange-400 to-pink-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
                  Most Popular
                </span>
              </div>
              <div className="mb-8 pt-2">
                <p className="text-sm font-bold text-blue-200 uppercase tracking-widest mb-3">Professional</p>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-5xl font-bold text-white">$49</span>
                  <span className="text-blue-200 mb-1.5">/month</span>
                </div>
                <p className="text-blue-100 text-sm leading-relaxed">For growing clinics that need powerful tools to manage teams and patients.</p>
              </div>
              <ul className="space-y-3.5 mb-10 flex-grow">
                {[
                  'Up to 10 Doctor accounts',
                  'Unlimited appointments',
                  'Full patient records & EHR',
                  'SMS + Email notifications',
                  'Billing & auto-invoicing',
                  'Advanced analytics',
                  'Receptionist & staff roles',
                  'Priority support',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white">
                    <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0 text-xs font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/subscribe?plan=professional">
                <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold shadow-lg">
                  Start Free Trial
                </Button>
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col">
              <div className="mb-8">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Enterprise</p>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-5xl font-bold text-gray-900">$199</span>
                  <span className="text-gray-500 mb-1.5">/month</span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">For hospital networks and multi-branch clinics requiring custom configurations.</p>
              </div>
              <ul className="space-y-3.5 mb-10 flex-grow">
                {[
                  'Unlimited Doctor accounts',
                  'Unlimited appointments',
                  'Multi-clinic management',
                  'Super Admin dashboard',
                  'Custom integrations & API',
                  'White-label branding',
                  'Dedicated account manager',
                  'SLA-backed 24/7 support',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/subscribe?plan=enterprise">
                <Button variant="outline" className="w-full">Get Enterprise</Button>
              </Link>
            </div>

          </div>

          {/* Money-back note */}
          <p className="text-center text-sm text-gray-500 mt-10">
            🔒 14-day free trial on all paid plans. No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}

      <footer className="bg-white pt-16 pb-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
               <div className="flex items-center gap-2 mb-6">
                 <HeartPulse className="text-blue-600 w-6 h-6" />
                 <span className="text-xl font-bold text-gray-900 tracking-tight">Mediclinic</span>
               </div>
               <p className="text-gray-500 text-sm leading-relaxed mb-6">
                 Smarter scheduling, premium care, and seamless healthcare experiences for modern patients.
               </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-5">Patients</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Find Doctors</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Search Clinics</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Book Appointment</a></li>
                 <li><a href="#" className="hover:text-blue-600 transition-colors">Patient Dashboard</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-5">Clinics</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Partner With Us</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Clinic Login</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Pricing</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-5">Legal</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 gap-4">
            <p suppressHydrationWarning>&copy; {new Date().getFullYear()} Mediclinic. All rights reserved.</p>
            <div className="flex space-x-6">
              <a href="#" className="hover:text-gray-900 transition-colors font-medium">Twitter</a>
              <a href="#" className="hover:text-gray-900 transition-colors font-medium">LinkedIn</a>
              <a href="#" className="hover:text-gray-900 transition-colors font-medium">Instagram</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
