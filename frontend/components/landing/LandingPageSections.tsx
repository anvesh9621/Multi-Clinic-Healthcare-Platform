"use client";

import React, { useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Calendar, Phone, Activity, Stethoscope, CheckCircle2, HeartPulse,
  Bone, Brain, ShieldCheck, type LucideIcon,
} from "lucide-react";

const PulseDivider = dynamic(
  () => import('@/components/ui/PulseOrb3D').then((m) => ({ default: m.PulseDivider })),
  { ssr: false, loading: () => <div className="h-10" /> }
);

// ── Shared motion variants ────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

// ── Hook: section scroll trigger ─────────────────────────────────────────────

function useSectionReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduced = useReducedMotion();
  return { ref, inView, reduced };
}

// ── AnimatedSection wrapper ───────────────────────────────────────────────────

function AnimatedSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, inView, reduced } = useSectionReveal();
  return (
    <motion.div
      ref={ref}
      variants={reduced ? {} : staggerContainer}
      initial={reduced ? "visible" : "hidden"}
      animate={inView || reduced ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AnimatedItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div variants={reduced ? {} : fadeUp} className={className}>
      {children}
    </motion.div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <AnimatedItem className="text-center mb-14">
      {eyebrow && (
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 text-primary font-semibold text-sm mb-5 border border-primary/20">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl font-bold text-ink mb-4 heading-font">{title}</h2>
      {body && <p className="text-muted max-w-2xl mx-auto">{body}</p>}
    </AnimatedItem>
  );
}

// ── Quick Services ────────────────────────────────────────────────────────────

const SERVICES = [
  {
    Icon: Calendar,
    color: "primary",
    title: "Book Appointment",
    body: "Schedule your visit with top-rated professionals across various specialties.",
    cta: "Book Now",
    href: "/login",
  },
  {
    Icon: Activity,
    color: "accent",
    title: "Emergency Care",
    body: "Get immediate assistance for urgent medical care and emergencies.",
    cta: "Call Now",
    href: "/login",
  },
  {
    Icon: Phone,
    color: "primary-dark",
    title: "Online Consultation",
    body: "Consult with doctors remotely from the comfort of your home anytime.",
    cta: "Start Consult",
    href: "/login",
  },
];

function QuickServicesSection() {
  const { ref, inView, reduced } = useSectionReveal();
  return (
    <section className="py-24 bg-warm-surface">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          variants={reduced ? {} : staggerContainer}
          initial={reduced ? "visible" : "hidden"}
          animate={inView || reduced ? "visible" : "hidden"}
        >
          <SectionHeading
            title="Quick Services"
            body="Access our most essential services instantly."
          />
          <div className="grid md:grid-cols-3 gap-8">
            {SERVICES.map(({ Icon, color, title, body, cta, href }) => (
              <AnimatedItem key={title}>
                <Card
                  hoverable
                  className={`p-8 text-center border-t-4 border-t-${color} h-full flex flex-col`}
                >
                  <div
                    className={`w-16 h-16 mx-auto bg-${color}/10 text-${color} rounded-2xl flex items-center justify-center mb-6`}
                  >
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-ink mb-3 heading-font">{title}</h3>
                  <p className="text-muted mb-8 leading-relaxed flex-1">{body}</p>
                  <Link href={href} className="block w-full mt-auto">
                    <Button variant="outline" className="w-full">{cta}</Button>
                  </Link>
                </Card>
              </AnimatedItem>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Specialties ───────────────────────────────────────────────────────────────

function getSpecialtyIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes('cardio')) return HeartPulse;
  if (n.includes('neuro'))  return Brain;
  if (n.includes('pedia'))  return ShieldCheck;
  if (n.includes('ortho'))  return Bone;
  if (n.includes('ophtha') || n.includes('eye')) return Stethoscope;
  return Stethoscope;
}

function getSpecialtyDescription(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('cardio')) return "Advanced heart care, diagnostics, and customized treatment plans.";
  if (n.includes('neuro'))  return "Comprehensive care for brain, spine, and nervous system disorders.";
  if (n.includes('pedia'))  return "Compassionate and expert healthcare tailored for children.";
  if (n.includes('ortho'))  return "Specialized treatments for bone, joint, and muscle conditions.";
  return `Expert doctors providing specialized care in ${name}.`;
}

function SpecialtiesSection({
  specialties,
}: {
  specialties: string[];
}) {
  const { ref, inView, reduced } = useSectionReveal();
  return (
    <section className="py-24 bg-paper border-t border-border" id="specialties">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          variants={reduced ? {} : staggerContainer}
          initial={reduced ? "visible" : "hidden"}
          animate={inView || reduced ? "visible" : "hidden"}
        >
          <SectionHeading
            eyebrow="All Specialties"
            title="Our Premium Specialties"
            body="Experience world-class healthcare across numerous medical disciplines."
          />

          {specialties.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {specialties.map((spec, i) => {
                const Icon = getSpecialtyIcon(spec);
                return (
                  <AnimatedItem key={i}>
                    <div className="group border border-border rounded-2xl p-6 hover:shadow-xl hover:border-primary/20 transition-all bg-paper flex flex-col h-full">
                      <div className="w-14 h-14 bg-primary/8 text-primary rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                        <Icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-bold text-ink mb-2 heading-font">{spec}</h3>
                      <p className="text-muted text-sm leading-relaxed mb-5 flex-grow">
                        {getSpecialtyDescription(spec)}
                      </p>
                      <Link href={`/specialties/${encodeURIComponent(spec)}`} className="block w-full mt-auto">
                        <Button variant="outline" className="w-full">Find Doctor</Button>
                      </Link>
                    </div>
                  </AnimatedItem>
                );
              })}
            </div>
          ) : (
            <AnimatedItem>
              <div className="text-center py-12 bg-warm-surface rounded-2xl border border-border">
                <Stethoscope className="w-12 h-12 text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-ink mb-2">No Specialties Available</h3>
                <p className="text-muted">Currently there are no doctors available. Please check back later.</p>
              </div>
            </AnimatedItem>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, title: "Search Doctor", body: "Find the right specialist based on symptoms or specialty." },
  { n: 2, title: "Book Appointment", body: "Select a convenient time slot and confirm your visit instantly." },
  { n: 3, title: "Get Treatment", body: "Receive premium medical care and manage your health records." },
];

function HowItWorksSection() {
  const { ref, inView, reduced } = useSectionReveal();
  return (
    <section className="py-24 bg-warm-surface border-t border-border" id="about">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.div
          ref={ref}
          variants={reduced ? {} : staggerContainer}
          initial={reduced ? "visible" : "hidden"}
          animate={inView || reduced ? "visible" : "hidden"}
        >
          <SectionHeading title="How It Works" />
          <div className="grid md:grid-cols-3 gap-10 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-border -z-10 -translate-y-8" />
            {STEPS.map(({ n, title, body }) => (
              <AnimatedItem key={n}>
                <div className="bg-paper p-8 rounded-2xl shadow-sm border border-border flex flex-col items-center">
                  <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center font-bold text-xl mb-6 shadow-md shadow-primary/25 ring-8 ring-paper">
                    {n}
                  </div>
                  <h3 className="text-xl font-bold text-ink mb-3 heading-font">{title}</h3>
                  <p className="text-muted leading-relaxed">{body}</p>
                </div>
              </AnimatedItem>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────

const STARTER_FEATURES   = ["1 Doctor account", "Up to 50 appointments/month", "Basic patient records", "Email notifications", "Community support"];
const STARTER_MISSING    = ["Analytics & reporting", "Billing & invoicing", "Multi-clinic support"];
const PRO_FEATURES       = ["Up to 10 Doctor accounts", "Unlimited appointments", "Full patient records & EHR", "SMS + Email notifications", "Billing & auto-invoicing", "Advanced analytics", "Receptionist & staff roles", "Priority support"];
const ENTERPRISE_FEATURES = ["Unlimited Doctor accounts", "Unlimited appointments", "Multi-clinic management", "Super Admin dashboard", "Custom integrations & API", "White-label branding", "Dedicated account manager", "SLA-backed 24/7 support"];

function FeatureItem({ text, active }: { text: string; active: boolean }) {
  return (
    <li className={`flex items-center gap-3 text-sm ${active ? "" : "opacity-40"}`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${active ? "bg-primary/10 text-primary" : "bg-border text-muted"}`}>
        {active ? "✓" : "✕"}
      </span>
      {text}
    </li>
  );
}

function PricingSection() {
  const { ref, inView, reduced } = useSectionReveal();
  return (
    <section className="py-28 bg-paper border-t border-border" id="pricing">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          variants={reduced ? {} : staggerContainer}
          initial={reduced ? "visible" : "hidden"}
          animate={inView || reduced ? "visible" : "hidden"}
        >
          <SectionHeading
            eyebrow="Simple, Transparent Pricing"
            title="Plans for Every Clinic"
            body="From solo practitioners to large multi-specialty hospitals — scale your practice with the right plan."
          />

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Starter */}
            <AnimatedItem>
              <div className="bg-paper rounded-2xl border border-border shadow-sm p-8 flex flex-col h-full">
                <div className="mb-8">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Starter</p>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-5xl font-bold text-ink tabular-nums">₹0</span>
                    <span className="text-muted mb-1.5">/month</span>
                  </div>
                  <p className="text-muted text-sm leading-relaxed">Perfect for solo practitioners getting started with digital scheduling.</p>
                </div>
                <ul className="space-y-3.5 mb-10 flex-grow">
                  {STARTER_FEATURES.map((f) => <FeatureItem key={f} text={f} active />)}
                  {STARTER_MISSING.map((f) => <FeatureItem key={f} text={f} active={false} />)}
                </ul>
                <Link href="/login">
                  <Button variant="outline" className="w-full">Get Started Free</Button>
                </Link>
              </div>
            </AnimatedItem>

            {/* Professional — highlighted */}
            <AnimatedItem>
              <div className="bg-primary rounded-2xl shadow-2xl shadow-primary/30 p-8 flex flex-col relative ring-2 ring-primary -mt-4 -mb-4 h-full">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-accent text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
                <div className="mb-8 pt-2">
                  <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Professional</p>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-5xl font-bold text-white tabular-nums">₹999</span>
                    <span className="text-white/70 mb-1.5">/month</span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">For growing clinics that need powerful tools to manage teams and patients.</p>
                </div>
                <ul className="space-y-3.5 mb-10 flex-grow">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-white">
                      <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0 text-xs font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/subscribe?plan=professional">
                  <Button className="w-full bg-white text-primary hover:bg-warm-surface font-bold shadow-lg">
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            </AnimatedItem>

            {/* Enterprise */}
            <AnimatedItem>
              <div className="bg-paper rounded-2xl border border-border shadow-sm p-8 flex flex-col h-full">
                <div className="mb-8">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Enterprise</p>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-5xl font-bold text-ink tabular-nums">₹2,999</span>
                    <span className="text-muted mb-1.5">/month</span>
                  </div>
                  <p className="text-muted text-sm leading-relaxed">For hospital networks and multi-branch clinics requiring custom configurations.</p>
                </div>
                <ul className="space-y-3.5 mb-10 flex-grow">
                  {ENTERPRISE_FEATURES.map((f) => <FeatureItem key={f} text={f} active />)}
                </ul>
                <Link href="/subscribe?plan=enterprise">
                  <Button variant="outline" className="w-full">Get Enterprise</Button>
                </Link>
              </div>
            </AnimatedItem>
          </div>

          <AnimatedItem>
            <p className="text-center text-sm text-muted mt-10 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              14-day free trial on all paid plans. No credit card required. Cancel anytime.
            </p>
          </AnimatedItem>
        </motion.div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  const NAV_LINKS_HOVER = "hover:text-primary transition-colors";
  return (
    <footer className="bg-paper pt-16 pb-8 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <HeartPulse className="text-primary w-6 h-6" />
              <span className="text-xl font-bold text-ink tracking-tight heading-font">MediClinic</span>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              Smarter scheduling, premium care, and seamless healthcare experiences for modern patients.
            </p>
          </div>
          {[
            { heading: "Patients", links: ["Find Doctors", "Search Clinics", "Book Appointment", "Patient Dashboard"] },
            { heading: "Clinics",  links: ["Partner With Us", "Clinic Login", "Pricing"] },
            { heading: "Legal",    links: ["Privacy Policy", "Terms of Service", "Contact Us"] },
          ].map(({ heading, links }) => (
            <div key={heading}>
              <h4 className="font-bold text-ink mb-5 heading-font">{heading}</h4>
              <ul className="space-y-4 text-sm text-muted">
                {links.map((l) => (
                  <li key={l}><a href="#" className={NAV_LINKS_HOVER}>{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-muted gap-4">
          <p suppressHydrationWarning>© {new Date().getFullYear()} MediClinic. All rights reserved.</p>
          <div className="flex gap-6">
            {["Twitter", "LinkedIn", "Instagram"].map((s) => (
              <a key={s} href="#" className={`font-medium ${NAV_LINKS_HOVER}`}>{s}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export function LandingPageSections({
  specialties,
}: {
  specialties: string[];
}) {
  return (
    <>
      <PulseDivider />
      <QuickServicesSection />
      <SpecialtiesSection specialties={specialties} />
      <HowItWorksSection />
      <PricingSection />
      <Footer />
    </>
  );
}
