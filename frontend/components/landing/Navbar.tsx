"use client";

import React, { useContext } from 'react';
import Link from 'next/link';
import { Button } from './Button';
import { HeartPulse } from 'lucide-react';
import { AuthContext } from '@/context/AuthContext';

export function Navbar() {
  const { user } = useContext(AuthContext) || {};

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <HeartPulse className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold text-gray-900 tracking-tight">
            Mediclinic
          </span>
        </Link>
        
        <div className="hidden md:flex items-center space-x-8">
          <Link href="/#specialties" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">Specialties</Link>
          <Link href="/#about" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">How it Works</Link>
        </div>

        <div className="flex items-center space-x-4">
          {user ? (
            <Link href={user.role === 'PATIENT' ? '/dashboard/patient' : '/dashboard'}>
              <Button variant="primary">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden md:block">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link href="/register">
                <Button variant="primary">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
