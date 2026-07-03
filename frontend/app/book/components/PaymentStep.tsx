"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Building2, User, Calendar, Clock, Loader2, AlertTriangle } from "lucide-react";
import api from "@/services/api";
import { useBooking } from "../layout";
import { AuthContext } from "@/context/AuthContext";
import { format } from "date-fns";

export default function PaymentStep() {
  const router = useRouter();
  const { state, goToStep } = useBooking();
  const { user, loading: authLoading } = useContext(AuthContext);
  
  const [paymentMethod, setPaymentMethod] = useState<"razorpay_online" | "pay_at_clinic">("razorpay_online");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline auth state
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      setShowAuth(true);
    } else if (user) {
      setShowAuth(false);
    }
  }, [user, authLoading]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsAuthenticating(true);

    try {
      if (authMode === "login") {
        const res = await api.post("/token/", { email, password });
        localStorage.setItem("access", res.data.access);
        localStorage.setItem("refresh", res.data.refresh);
      } else {
        await api.post("/accounts/register/patient/", {
          email, password, first_name: firstName, last_name: lastName
        });
        const res = await api.post("/token/", { email, password });
        localStorage.setItem("access", res.data.access);
        localStorage.setItem("refresh", res.data.refresh);
      }
      // Force reload to get user state, but keep sessionStorage for booking state if we wanted to
      // A cleaner way is just let the AuthContext fetch or window.location.reload()
      // Let's just reload. The booking state is in React state, so it will be lost if we hard reload.
      // We must avoid hard reload. We can fetch user and update context.
      // But we don't have access to fetchUser here directly unless exposed.
      // Workaround: We'll just do a hard reload and tell the user they need to restart, or we can use the backend login and refresh context.
      // Actually, standard practice for this app might be to redirect to login with a next param.
      // To keep it strictly linear and not lose state, let's just make the API call and if successful, we just pretend we are logged in for the booking API call (it uses the token).
      // We can just set showAuth to false. The subsequent booking call will use the token.
      setShowAuth(false);
    } catch (err: any) {
      setAuthError(err.response?.data?.detail || "Authentication failed. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);

    // Calculate end time (assuming 30 min slot for simplicity, backend will recalculate)
    const [hours, minutes] = state.timeSlot!.split(":");
    const end = new Date();
    end.setHours(parseInt(hours), parseInt(minutes) + 30);
    const endTime = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}:00`;

    try {
      const res = await api.post("/appointments/book/", {
        doctor_clinic_id: state.doctorClinicId,
        appointment_date: state.date,
        start_time: state.timeSlot,
        end_time: endTime,
        payment_method: paymentMethod,
        reason: "Self-booked via wizard",
      });

      if (res.data.payment_required && res.data.razorpay_payment_link_url) {
        // Redirect to Razorpay
        sessionStorage.setItem("pending_appointment_id", res.data.appointment.id.toString());
        window.location.href = res.data.razorpay_payment_link_url;
      } else {
        // Confirmed directly
        router.push("/dashboard/patient/appointments?booked=true");
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError("This time slot is no longer available. Please select a different time.");
        setTimeout(() => goToStep(4), 3000);
      } else {
        setError(err.response?.data?.error || "Failed to book appointment. Please try again.");
      }
      setIsSubmitting(false);
    }
  };

  if (authLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>;

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Review & Confirm</h2>
        <p className="text-gray-500 mt-1">Almost there! Please review your details.</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 uppercase text-xs tracking-wider">Appointment Summary</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">{state.doctorName}</p>
              <p className="text-sm text-gray-500">{state.specialty}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">{state.clinicName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">
                {state.date ? format(new Date(state.date), "EEEE, MMMM do, yyyy") : ""}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">{state.timeSlot?.slice(0, 5)}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200 mt-4 flex justify-between items-center">
            <span className="font-medium text-gray-700">Consultation Fee</span>
            <span className="text-xl font-bold text-gray-900">₹{state.consultationFee}</span>
          </div>
        </div>
      </div>

      {showAuth ? (
        <div className="bg-white border-2 border-violet-100 rounded-xl p-6 shadow-sm">
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">Please sign in to continue</h3>
            <p className="text-sm text-gray-500 mt-1">You need an account to book an appointment.</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{authError}</div>}
            
            {authMode === "register" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-600 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-600 outline-none" />
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-600 outline-none" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-600 outline-none" />
            </div>
            
            <button type="submit" disabled={isAuthenticating} className="w-full py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-70 flex justify-center">
              {isAuthenticating ? <Loader2 className="w-5 h-5 animate-spin" /> : (authMode === "login" ? "Sign In" : "Create Account")}
            </button>
            
            <div className="text-center mt-4 text-sm text-gray-600">
              {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button type="button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} className="text-violet-600 font-semibold hover:underline">
                {authMode === "login" ? "Sign up" : "Log in"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <h3 className="font-semibold text-gray-900 mb-4">Payment Method</h3>
          <div className="space-y-3 mb-8">
            <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
              paymentMethod === "razorpay_online" ? "border-violet-600 bg-violet-50 ring-1 ring-violet-600" : "border-gray-200 hover:border-violet-300"
            }`}>
              <input 
                type="radio" 
                name="paymentMethod" 
                value="razorpay_online" 
                checked={paymentMethod === "razorpay_online"}
                onChange={() => setPaymentMethod("razorpay_online")}
                className="w-4 h-4 text-violet-600 focus:ring-violet-600"
              />
              <div className="ml-3 flex-1">
                <span className="block font-medium text-gray-900">Pay Online Now</span>
                <span className="block text-sm text-gray-500">Secure payment via UPI, Cards, Netbanking</span>
              </div>
              <CreditCard className={`w-6 h-6 ${paymentMethod === "razorpay_online" ? "text-violet-600" : "text-gray-400"}`} />
            </label>

            <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
              paymentMethod === "pay_at_clinic" ? "border-violet-600 bg-violet-50 ring-1 ring-violet-600" : "border-gray-200 hover:border-violet-300"
            }`}>
              <input 
                type="radio" 
                name="paymentMethod" 
                value="pay_at_clinic" 
                checked={paymentMethod === "pay_at_clinic"}
                onChange={() => setPaymentMethod("pay_at_clinic")}
                className="w-4 h-4 text-violet-600 focus:ring-violet-600"
              />
              <div className="ml-3 flex-1">
                <span className="block font-medium text-gray-900">Pay at Clinic</span>
                <span className="block text-sm text-gray-500">Pay when you visit the doctor</span>
              </div>
              <Building2 className={`w-6 h-6 ${paymentMethod === "pay_at_clinic" ? "text-violet-600" : "text-gray-400"}`} />
            </label>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-4 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-all hover:scale-[1.02] shadow-lg shadow-violet-200 disabled:opacity-70 disabled:hover:scale-100"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" /> 
                {paymentMethod === "razorpay_online" ? "Proceed to Pay" : "Confirm Appointment"}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
