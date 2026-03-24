import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { Button } from '@/components/landing/Button';
import { Star, Clock, MapPin, ChevronLeft } from 'lucide-react';

async function getDoctors(specialty: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/public/doctors/?specialty=${encodeURIComponent(specialty)}`, {
      next: { revalidate: 0 }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    return [];
  }
}

export default async function SpecialtyDoctorsPage({ params }: { params: { specialty: string } }) {
  const specialty = decodeURIComponent(params.specialty);
  const doctors = await getDoctors(specialty);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <Link href="/#specialties" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors mb-4">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Specialties
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            {specialty} Specialists
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl">
            Find and book an appointment with our highly experienced {specialty.toLowerCase()} doctors.
          </p>
        </div>

        {doctors.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-lg">No doctors are currently available in this specialty.</p>
            <Link href="/#specialties" className="inline-block mt-4">
              <Button variant="outline">Explore other specialties</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {doctors.map((doctor: any) => (
              <div key={doctor.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all flex flex-col overflow-hidden group">
                {/* Header */}
                <div className="p-6 flex items-start gap-4">
                  <div className="w-20 h-20 rounded-full bg-blue-50 border-4 border-white shadow-sm overflow-hidden shrink-0 flex items-center justify-center">
                    {doctor.profile_photo ? (
                      <img src={doctor.profile_photo} alt={`Dr. ${doctor.first_name} ${doctor.last_name}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-blue-600 font-bold text-xl">{doctor.first_name?.[0]}{doctor.last_name?.[0]}</span>
                    )}
                  </div>
                  <div className="pt-2">
                    <h3 className="text-xl font-bold text-gray-900 leading-tight mb-1">
                      Dr. {doctor.first_name} {doctor.last_name}
                    </h3>
                    <p className="text-blue-600 font-medium text-sm mb-2">{doctor.specialization}</p>
                    
                    {/* Dynamic Rating */}
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-orange-50 w-fit px-2 py-0.5 rounded-full border border-orange-100">
                      <Star className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                      <span>{doctor.average_rating > 0 ? doctor.average_rating.toFixed(1) : "New"}</span>
                      <span className="text-gray-400 font-normal ml-0.5">
                        ({doctor.review_count} {doctor.review_count === 1 ? 'review' : 'reviews'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body Details */}
                <div className="px-6 pb-6 flex-grow">
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-gray-500" />
                      </div>
                      <span className="font-medium text-gray-900">{doctor.experience_years} years</span>
                      <span className="text-gray-400">experience</span>
                    </div>
                    {doctor.qualifications && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                          <span className="text-gray-500 font-semibold text-xs">EDU</span>
                        </div>
                        <span className="truncate" title={doctor.qualifications}>{doctor.qualifications}</span>
                      </div>
                    )}
                    {doctor.languages_spoken && doctor.languages_spoken.length > 0 && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                          <span className="text-gray-500 text-lg">🌐</span>
                        </div>
                        <span className="truncate">{doctor.languages_spoken.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-gray-50 bg-gray-50/50 mt-auto">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-500">Consultation Fee</span>
                    <span className="font-bold text-gray-900">₹{doctor.consultation_fee || 500}</span>
                  </div>
                  <Link href="/login" className="block w-full">
                    <Button variant="primary" className="w-full shadow-sm group-hover:shadow-md transition-shadow">Book Appointment</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
