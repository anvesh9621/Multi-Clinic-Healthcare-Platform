"use client";

import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

// ── Static SVG fallback (reduced motion / no WebGL) ─────────────────────────

function PulseFallback({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="60"
        cy="60"
        r="52"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        strokeDasharray="8 4"
        opacity="0.3"
      />
      <circle
        cx="60"
        cy="60"
        r="36"
        stroke="var(--color-primary)"
        strokeWidth="1"
        opacity="0.15"
      />
      {/* Vitals trace */}
      <polyline
        points="20,60 32,60 38,40 44,80 50,55 56,65 62,60 68,60 74,45 80,75 86,60 100,60"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {/* Accent dot */}
      <circle cx="62" cy="60" r="3" fill="var(--color-accent)" opacity="0.8" />
    </svg>
  );
}

// ── WebGL check ──────────────────────────────────────────────────────────────

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

// ── Three.js scene ───────────────────────────────────────────────────────────

function PulseScene({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // Lazy-import Three to keep it out of the initial bundle
    let animId: number;
    let disposed = false;

    import("three").then((THREE) => {
      if (disposed || !mountRef.current) return;
      const mount = mountRef.current;

      const W = mount.clientWidth;
      const H = mount.clientHeight;

      // Scene
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
      camera.position.set(0, 0, 3.8);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power", // CPU cap
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(W, H);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      // ── Outer ring (dashed orbit) ─────────────────────────────────────
      {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= 128; i++) {
          const a = (i / 128) * Math.PI * 2;
          points.push(new THREE.Vector3(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
          color: 0x0f7b6c,
          transparent: true,
          opacity: 0.25,
        });
        scene.add(new THREE.Line(geo, mat));
      }

      // ── Core sphere (frosted) ─────────────────────────────────────────
      {
        const geo = new THREE.SphereGeometry(0.72, 32, 32);
        const mat = new THREE.MeshPhongMaterial({
          color: 0xf4f1ea,
          emissive: 0x0f7b6c,
          emissiveIntensity: 0.08,
          shininess: 90,
          transparent: true,
          opacity: 0.82,
        });
        scene.add(new THREE.Mesh(geo, mat));
      }

      // ── Vitals trace ribbon wrapped around the sphere ─────────────────
      {
        const pts: THREE.Vector3[] = [];
        const N = 300;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const theta = t * Math.PI * 4;          // 2 full loops
          const phi = Math.PI / 2 + Math.sin(t * Math.PI * 6) * 0.4;

          // ECG-style pulse bump at t ≈ 0.5
          const beat = Math.abs(t - 0.5) < 0.04
            ? Math.exp(-((t - 0.5) ** 2) / 0.0006) * 0.55
            : 0;

          const r = 0.74 + beat;
          pts.push(new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta),
          ));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
          color: 0x0f7b6c,
          transparent: true,
          opacity: 0.8,
        });
        scene.add(new THREE.Line(geo, mat));
      }

      // ── Accent dot (coral) at peak ────────────────────────────────────
      {
        const geo = new THREE.SphereGeometry(0.045, 12, 12);
        const mat = new THREE.MeshBasicMaterial({ color: 0xe8734a });
        const dot = new THREE.Mesh(geo, mat);
        dot.position.set(0, 1.29, 0);
        scene.add(dot);
      }

      // ── Lighting ──────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 1.2));
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(3, 5, 3);
      scene.add(dir);

      // ── Damped rotation ───────────────────────────────────────────────
      let rotY = 0;
      let lastTime = 0;
      const TARGET_FPS = 40;
      const FRAME_MS = 1000 / TARGET_FPS;

      const animate = (now: number) => {
        if (disposed) return;
        animId = requestAnimationFrame(animate);
        const delta = now - lastTime;
        if (delta < FRAME_MS) return;          // rate-limit
        lastTime = now - (delta % FRAME_MS);

        rotY += 0.003;                          // slow, calm rotation
        scene.rotation.y = rotY;

        renderer.render(scene, camera);
      };
      animId = requestAnimationFrame(animate);

      // ── Resize ────────────────────────────────────────────────────────
      const obs = new ResizeObserver(() => {
        if (!mount) return;
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      obs.observe(mount);

      // ── Cleanup ───────────────────────────────────────────────────────
      return () => {
        disposed = true;
        cancelAnimationFrame(animId);
        obs.disconnect();
        renderer.dispose();
        mount.removeChild(renderer.domElement);
      };
    });

    return () => { disposed = true; };
  }, []);

  return <div ref={mountRef} className={className} style={{ background: "transparent" }} />;
}

// ── Public export ────────────────────────────────────────────────────────────

interface PulseOrb3DProps {
  className?: string;
}

export function PulseOrb3D({ className = "w-28 h-28" }: PulseOrb3DProps) {
  const prefersReduced = useReducedMotion();
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => { setWebgl(hasWebGL()); }, []);

  // Server render: nothing (avoids hydration mismatch on canvas)
  if (webgl === null) return <PulseFallback className={className} />;

  if (prefersReduced || !webgl) {
    return <PulseFallback className={className} />;
  }

  return <PulseScene className={className} />;
}

// ── Section divider variant ───────────────────────────────────────────────────

export function PulseDivider() {
  return (
    <div className="flex items-center justify-center py-4 select-none" aria-hidden="true">
      <span className="flex-1 h-px bg-border" />
      <PulseOrb3D className="w-14 h-14 mx-4 flex-shrink-0" />
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}
