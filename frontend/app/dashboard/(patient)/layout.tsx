"use client";

// Patient group layout - renders children without the staff sidebar
// The patient dashboard page has its own full-page layout with a custom header.
export default function PatientGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
