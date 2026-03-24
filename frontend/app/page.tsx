import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { Button } from '@/components/landing/Button';
import { Input } from '@/components/landing/Input';
import { Card } from '@/components/landing/Card';
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
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-16 pb-32 overflow-hidden bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-[1.2fr_0.8fr] lg:grid-cols-2 gap-12 items-center">
          {/* Left Side: Content & Search */}
          <div className="max-w-2xl z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium text-sm mb-6 border border-blue-100 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Modern Healthcare Platform
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-semibold text-gray-900 leading-[1.15] tracking-tight mb-6">
              Smarter Healthcare Starts Here
            </h1>
            
            <p className="text-lg text-gray-600 mb-10 leading-relaxed max-w-xl">
              Book appointments with top doctors, manage your health records, and experience premium clinical care effortlessly.
            </p>

            {/* Smart Search */}
            <div className="bg-white p-3 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col sm:flex-row gap-3 mb-10 w-full max-w-xl relative group">
               <div className="absolute inset-0 rounded-2xl bg-blue-50/50 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
               <div className="flex-1 relative z-10">
                 <Input 
                   icon={<Search className="w-5 h-5 text-gray-400" />} 
                   placeholder="Search doctors, clinics, or symptoms"
                   className="border-none bg-gray-50 focus:bg-white h-14 text-base shadow-inner w-full"
                 />
               </div>
               <Link href="/login" className="z-10 sm:w-auto w-full">
                 <Button size="lg" className="w-full h-14 px-8 text-base shadow-md">
                   Search
                 </Button>
               </Link>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/login">
                <Button size="lg" variant="primary" className="h-14 px-8 text-base">Book Appointment</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="h-14 px-8 text-base bg-white">Find Doctors</Button>
              </Link>
            </div>
          </div>
          
          {/* Right Side: Image */}
          <div className="relative hidden md:block h-[500px] lg:h-[600px] w-full bg-gray-100 rounded-3xl overflow-hidden shadow-2xl border-4 border-white mb-8 md:mb-0">
             <div className="absolute inset-0 bg-blue-600/5 mix-blend-multiply z-10 pointer-events-none"></div>
             <img 
               src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2070&auto=format&fit=crop" 
               alt="Professional Doctor" 
               className="w-full h-full object-cover"
             />
             
             {/* Floating badge */}
             <div className="absolute bottom-8 left-[-30px] lg:left-[-40px] z-20 bg-white p-4 rounded-xl shadow-xl border border-gray-100 flex items-center gap-4 hover:-translate-y-1 transition-transform cursor-default">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Verified Doctors</p>
                  <p className="text-xs text-gray-500">100% Expert Verified</p>
                </div>
             </div>
          </div>
        </div>
      </section>

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
            <p>&copy; {new Date().getFullYear()} Mediclinic. All rights reserved.</p>
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
