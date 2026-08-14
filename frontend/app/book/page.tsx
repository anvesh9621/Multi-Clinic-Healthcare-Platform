import BookingWizardClient from "./components/BookingWizardClient";
import { Clinic } from "./components/ClinicSelector";

export const revalidate = 300;

async function getPublicClinics(): Promise<Clinic[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/public/clinics/`,
      {
        next: { revalidate: 300 },
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

export default async function BookingWizardPage() {
  const initialClinics = await getPublicClinics();
  return <BookingWizardClient initialClinics={initialClinics} />;
}
