"use client";

import { useEffect, useState } from "react";

export function useRazorpay() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ((window as any).Razorpay) {
      setIsLoaded(true);
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => setIsLoaded(true));
      existingScript.addEventListener("error", () =>
        setLoadError("Failed to load Razorpay SDK")
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => setLoadError("Failed to load Razorpay SDK");
    document.body.appendChild(script);

    return () => {
      // Keep script in document to prevent duplicate loads
    };
  }, []);

  return { isLoaded, loadError };
}
