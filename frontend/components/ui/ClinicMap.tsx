"use client";

/**
 * ClinicMap — Leaflet/OpenStreetMap map component for clinic selection.
 *
 * Leaflet requires "use client" and dynamic import in Next.js
 * because it accesses window/document at import time.
 */

import { useEffect, useRef } from "react";
import type { Clinic } from "@/services/booking";

interface ClinicMapProps {
  clinics: Clinic[];
  selectedId: number | null;
  onSelect: (clinic: Clinic) => void;
}

export default function ClinicMap({ clinics, selectedId, onSelect }: ClinicMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Clinics that have coordinates
  const mappable = clinics.filter((c) => c.latitude != null && c.longitude != null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L: any) => {
      // Fix default icon paths (Leaflet webpack issue)
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Initialize map only once
      if (!mapInstanceRef.current) {
        // Center on India as default (or first clinic if available)
        const center: [number, number] =
          mappable.length > 0
            ? [Number(mappable[0].latitude), Number(mappable[0].longitude)]
            : [20.5937, 78.9629];

        const zoom = mappable.length > 0 ? 13 : 5;

        mapInstanceRef.current = L.map(mapRef.current, {
          center,
          zoom,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      }

      // Clear previous markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Add a marker for each mappable clinic
      mappable.forEach((clinic) => {
        const isSelected = clinic.id === selectedId;

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              position:relative;
              display:flex;
              flex-direction:column;
              align-items:center;
              cursor:pointer;
            ">
              <div style="
                background: ${isSelected ? "#2563eb" : "#ffffff"};
                color: ${isSelected ? "#fff" : "#1e293b"};
                border: 2.5px solid #2563eb;
                border-radius: 10px;
                padding: 5px 10px;
                font-family: Inter, sans-serif;
                font-size: 12px;
                font-weight: 600;
                white-space: nowrap;
                box-shadow: 0 4px 14px rgba(37,99,235,0.25);
                transition: all 0.2s ease;
              ">
                ${clinic.name}
              </div>
              <div style="
                width: 0; height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 8px solid ${isSelected ? "#2563eb" : "#2563eb"};
                margin-top: -1px;
              "></div>
            </div>
          `,
          iconAnchor: [0, 40],
          popupAnchor: [0, -40],
        });

        const marker = L.marker(
          [Number(clinic.latitude), Number(clinic.longitude)],
          { icon }
        ).addTo(mapInstanceRef.current);

        const doctorText = clinic.doctor_count === 1 ? "1 doctor" : `${clinic.doctor_count} doctors`;

        marker.bindPopup(`
          <div style="font-family: Inter, sans-serif; min-width: 180px; padding: 4px 0;">
            <p style="font-weight: 700; font-size: 14px; color: #0f172a; margin: 0 0 4px 0;">${clinic.name}</p>
            <p style="font-size: 12px; color: #64748b; margin: 0 0 8px 0;">${clinic.address}</p>
            <p style="font-size: 12px; font-weight: 600; color: #2563eb; margin: 0 0 10px 0;">${doctorText} available</p>
            <button
              onclick="window.__selectClinic(${clinic.id})"
              style="
                width: 100%;
                padding: 8px;
                background: #2563eb;
                color: white;
                border: none;
                border-radius: 8px;
                font-family: Inter, sans-serif;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
              "
            >
              Select this Clinic →
            </button>
          </div>
        `, { maxWidth: 240 });

        marker.on("click", () => {
          marker.openPopup();
        });

        markersRef.current.push(marker);
      });

      // Expose clinic selection to the popup button (innerHTML onclick)
      (window as any).__selectClinic = (id: number) => {
        const c = clinics.find((x) => x.id === id);
        if (c) onSelect(c);
      };

      // Fit bounds if multiple clinics
      if (mappable.length > 1) {
        const bounds = L.latLngBounds(
          mappable.map((c) => [Number(c.latitude), Number(c.longitude)])
        );
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    });

    // Inject Leaflet CSS once
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    return () => {
      // Cleanup global on unmount
      delete (window as any).__selectClinic;
    };
  }, [clinics, selectedId]);

  if (mappable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-slate-100 rounded-2xl border border-dashed border-slate-300">
        <div className="text-4xl mb-3">📍</div>
        <p className="font-semibold text-slate-600 mb-1">No map coordinates set</p>
        <p className="text-sm text-slate-400 max-w-xs text-center">
          Add latitude & longitude to your clinics in the admin panel to show them on the map.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
      style={{ height: "420px" }}
    />
  );
}
