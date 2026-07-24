"use client";

import React, { useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Building2, Star, Clock, CheckCircle2 } from "lucide-react";

// Lazy-loaded 3D orb — NOT in the critical render path
const PulseOrb3D = dynamic(
  () => import("@/components/ui/PulseOrb3D").then((m) => ({ default: m.PulseOrb3D })),
  { ssr: false, loading: () => null }
);

// ── Floating glass card components ───────────────────────────────────────────

function DrLiveCard() {
  return (
    <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md rounded-2xl px-4 py-3 shadow-lg border border-white/60">
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-bold text-sm heading-font">Dr</span>
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
      </div>
      <div>
        <p className="text-xs font-bold text-ink leading-tight">Dr. Priya Sharma</p>
        <p className="text-[11px] text-muted">Cardiologist · Live Now</p>
      </div>
      <div className="ml-auto pl-3 flex items-center gap-1 text-accent">
        <Activity className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold">Online</span>
      </div>
    </div>
  );
}

function StatCard() {
  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl px-5 py-4 shadow-lg border border-white/60 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-primary" />
        </div>
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">This Month</span>
      </div>
      <div className="flex items-end gap-2">
        <AnimatedNumber
          value={2847}
          className="text-3xl font-bold text-ink heading-font tabular-nums"
        />
        <span className="text-xs text-muted mb-1 font-medium">appointments</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-semibold">
        <Star className="w-3 h-3 fill-primary" />
        4.9 avg rating across all clinics
      </div>
    </div>
  );
}

// ── Main hero section ─────────────────────────────────────────────────────────

export function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Parallax layers — background moves slowest, cards fastest
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const card1Y = useTransform(scrollYProgress, [0, 1], ["0%", "-15%"]);
  const card2Y = useTransform(scrollYProgress, [0, 1], ["0%", "-25%"]);

  // When reduced motion, use static values
  const bgStyle  = prefersReduced ? {} : { y: bgY };
  const c1Style  = prefersReduced ? {} : { y: card1Y };
  const c2Style  = prefersReduced ? {} : { y: card2Y };

  return (
    <section
      ref={ref}
      className="relative pt-20 pb-32 overflow-hidden bg-paper border-b border-border"
    >
      {/* Subtle warm teal tint behind the grid */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_50%,rgba(15,123,108,0.07),transparent)] pointer-events-none"
      />

      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        {/* ── Left column ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-xl z-10"
        >
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 text-primary font-semibold text-sm mb-7 border border-primary/20 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Trusted by 120+ clinics across India
          </div>

          {/* Heading */}
          <h1 className="text-5xl lg:text-6xl font-bold text-ink leading-[1.1] tracking-tight mb-6 heading-font">
            Smarter Healthcare,<br />
            <span className="text-primary">Beautifully Simple</span>
          </h1>

          {/* Body copy */}
          <p className="text-lg text-muted mb-10 leading-relaxed">
            Book appointments with top doctors, manage your health records,
            and experience premium clinical care — all in one platform.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/login">
              <Button size="lg" variant="primary" className="h-13 px-8 text-base shadow-lg shadow-primary/25">
                Book an Appointment
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-13 px-8 text-base">
                Find Doctors
              </Button>
            </Link>
          </div>

          {/* Trust strip */}
          <div className="mt-10 flex items-center gap-5 text-sm text-muted font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              No registration fee
            </span>
            <span className="w-px h-4 bg-border" />
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              Instant confirmation
            </span>
            <span className="w-px h-4 bg-border" />
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primary" />
              120+ clinics
            </span>
          </div>
        </motion.div>

        {/* ── Right column — layered photo composition ────────────────── */}
        <div className="relative hidden md:flex items-center justify-center h-[560px]">
          {/* Background photo layer — slowest parallax */}
          <motion.div
            style={bgStyle}
            className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl border border-border"
          >
            <Image
              src="/clinic-hero.jpg"
              alt="Modern clinic interior with warm natural lighting"
              fill
              className="object-cover object-center"
              priority
            />
            {/* Warm overlay to blend photo with palette */}
            <div className="absolute inset-0 bg-gradient-to-t from-warm-surface/60 via-transparent to-transparent" />
          </motion.div>

          {/* Floating card 1 — Dr. Live Now */}
          <motion.div
            style={c1Style}
            initial={prefersReduced ? {} : { opacity: 0, x: 20 }}
            animate={prefersReduced ? {} : { opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
            className="absolute -bottom-4 -left-8 z-20 w-60"
          >
            <DrLiveCard />
          </motion.div>

          {/* Floating card 2 — Stat counter */}
          <motion.div
            style={c2Style}
            initial={prefersReduced ? {} : { opacity: 0, x: -20 }}
            animate={prefersReduced ? {} : { opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
            className="absolute -top-4 -right-8 z-20"
          >
            <StatCard />
          </motion.div>

          {/* 3D Pulse Orb — corner accent, secondary to photo */}
          <motion.div
            initial={prefersReduced ? {} : { opacity: 0, scale: 0.8 }}
            animate={prefersReduced ? {} : { opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
            className="absolute bottom-10 right-6 z-20"
          >
            <PulseOrb3D className="w-20 h-20" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
