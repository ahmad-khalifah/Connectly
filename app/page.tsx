'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform, Variants } from 'framer-motion';
import { 
  ArrowRight, Building2, Server, 
  CreditCard, Home, Tent, Briefcase, Lock, CheckCircle2
} from 'lucide-react';

const STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

export default function ConnectlyCorporate() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const yHero = useTransform(scrollY, [0, 1000], [0, 200]);
  const opacityHero = useTransform(scrollY, [0, 600], [1, 0]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#cfa253] selection:text-black">
      
      {/* ULTRA-PREMIUM NAVBAR */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-white/70 backdrop-blur-2xl border-b border-gray-200/50 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.03)]' : 'bg-transparent border-transparent py-6'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 relative h-6 w-28 md:h-7 md:w-32 group">
            <Image 
              src="/connectly-logo-horizontal.svg" 
              alt="Connectly Logo" 
              fill
              className={`object-contain transition-all duration-300 ${!scrolled ? 'brightness-0 invert' : 'group-hover:opacity-80'}`} 
              priority
            />
          </Link>
          <div className={`hidden md:flex gap-10 text-[13px] font-semibold tracking-wide ${scrolled ? 'text-gray-600' : 'text-gray-300'}`}>
            <Link href="#platform" className={`transition-colors ${scrolled ? 'hover:text-[#6d1825]' : 'hover:text-white'}`}>Platform</Link>
            <Link href="#deployments" className={`transition-colors ${scrolled ? 'hover:text-[#6d1825]' : 'hover:text-white'}`}>Deployments</Link>
          </div>
          <a href="mailto:connectly.hq@outlook.com" className={`px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 shadow-lg flex items-center gap-2 ${scrolled ? 'bg-[#111] text-white hover:bg-[#6d1825] hover:shadow-xl' : 'bg-white/10 text-white backdrop-blur-md border border-white/20 hover:bg-white hover:text-black'}`}>
            Partner Inquiries
          </a>
        </div>
      </motion.nav>

      {/* CINEMATIC HERO */}
      <section className="relative pt-32 pb-40 md:pt-48 md:pb-64 bg-[#050505] overflow-hidden">
        <motion.div style={{ y: yHero, opacity: opacityHero }} className="absolute inset-0 z-0">
          <Image 
            src="/group 1.jpg" 
            alt="Digital connectivity" 
            fill 
            className="object-cover object-center opacity-[0.25] scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/20 via-[#050505]/90 to-[#FAFAFA]"></div>
          
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#6d1825]/20 rounded-full blur-[140px] mix-blend-screen pointer-events-none animate-pulse-slow"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#cfa253]/15 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>
        </motion.div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div 
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="visible"
            className="max-w-4xl"
          >
            <motion.h1 variants={FADE_UP} className="text-5xl sm:text-6xl md:text-[6rem] font-black text-white leading-[0.95] tracking-tighter mb-8">
              NETWORK <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#cfa253] via-[#f3d9a6] to-[#ffffff]">
                AUTHENTICATION.
              </span>
            </motion.h1>
            
            <motion.p variants={FADE_UP} className="text-base md:text-xl text-gray-400 font-light leading-relaxed max-w-2xl mb-12">
              We engineer the software layer that monetizes and secures physical networks. Deploy captive portals, route payments, and manage localized Wi-Fi access at enterprise scale.
            </motion.p>
            
            <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row gap-4">
              <Link href="#platform" className="bg-white text-black px-8 py-4.5 rounded-full font-bold text-sm md:text-base hover:scale-105 transition-transform duration-300 text-center flex items-center justify-center gap-2 group shadow-[0_0_40px_rgba(255,255,255,0.15)]">
                Explore the Platform <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* REFINED GLASSMORPHISM TRUST BANNER */}
      <section className="relative z-20 -mt-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mb-24">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
          className="bg-white/60 backdrop-blur-3xl rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)] border border-white/80 flex overflow-x-auto md:grid md:grid-cols-3 divide-x divide-gray-200/40 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory"
        >
          {[
            { icon: Lock, title: "Captive Portals", desc: "Frictionless digital onboarding.", color: "text-[#6d1825]", bg: "bg-gradient-to-br from-[#6d1825]/10 to-[#6d1825]/5" },
            { icon: CreditCard, title: "Automated Payments", desc: "Secure transaction routing.", color: "text-[#cfa253]", bg: "bg-gradient-to-br from-[#cfa253]/20 to-[#cfa253]/5" },
            { icon: Server, title: "Hardware Routing", desc: "Mikrotik network edge integration.", color: "text-gray-800", bg: "bg-gradient-to-br from-gray-200 to-gray-50" }
          ].map((item, idx) => (
            <div key={idx} className="p-8 md:p-12 flex items-start gap-5 hover:bg-white/40 transition-colors shrink-0 w-[85%] sm:w-[60%] md:w-auto snap-center group">
              <div className={`${item.bg} ${item.color} p-4 rounded-2xl shrink-0 shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-500`}>
                <item.icon size={24} strokeWidth={2.2} />
              </div>
              <div className="pt-1">
                <h3 className="font-bold text-gray-900 mb-1.5 text-base tracking-tight">{item.title}</h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* THE INFRASTRUCTURE STACK */}
      <section id="platform" className="py-20 md:py-32 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={STAGGER_CONTAINER}>
              <motion.div variants={FADE_UP} className="mb-14">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6 text-gray-900 leading-[1.05]">
                  Not an ISP. <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6d1825] to-[#9c2235]">An Operational Layer.</span>
                </h2>
                <p className="text-gray-500 text-lg leading-relaxed max-w-lg">
                  Connectly does not just resell bandwidth. We provide the enterprise-grade software and routing configurations required to manage, secure, and monetize high-density local networks.
                </p>
              </motion.div>
              
              <div className="space-y-10 relative ml-2">
                <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-gray-200 via-[#cfa253]/50 to-[#6d1825]/50 rounded-full"></div>
                
                {[
                  { title: "User Joins Network", desc: "Local Wi-Fi connection triggers the captive portal authentication screen.", color: "bg-white border-gray-300", iconColor: "text-gray-400" },
                  { title: "Digital Transaction", desc: "User selects a data tier and securely completes payment via integrated APIs.", color: "bg-white border-[#cfa253]", iconColor: "text-[#cfa253]" },
                  { title: "Hardware Authorization", desc: "Mikrotik edge routers receive payment confirmation and instantly grant internet access.", color: "bg-white border-[#6d1825]", iconColor: "text-[#6d1825]", pulse: true }
                ].map((step, idx) => (
                  <motion.div key={idx} variants={FADE_UP} className="flex gap-8 relative z-10 group">
                    <div className="relative mt-1">
                      <div className={`w-8 h-8 rounded-full border-4 shadow-sm z-10 relative flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${step.color}`}>
                        <CheckCircle2 size={12} className={step.iconColor} />
                      </div>
                      {step.pulse && <div className="absolute inset-0 rounded-full bg-[#6d1825] animate-ping opacity-25"></div>}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 tracking-tight mb-1">{step.title}</h4>
                      <p className="text-sm text-gray-500 leading-relaxed max-w-sm">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 40, filter: 'blur(10px)' }}
              whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative h-[500px] md:h-[650px] w-full rounded-[2rem] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.08)] group"
            >
              <Image 
                src="/group 3.jpg" 
                alt="Students utilizing connected devices" 
                fill 
                className="object-cover scale-105 group-hover:scale-100 grayscale group-hover:grayscale-0 transition-all duration-1000 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#6d1825]/30 to-transparent mix-blend-multiply pointer-events-none transition-opacity duration-1000 group-hover:opacity-0"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ENVIRONMENTS GRID */}
      <section id="deployments" className="py-24 md:py-32 bg-white rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.02)] relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}
            className="text-center max-w-3xl mx-auto mb-16 md:mb-24"
          >
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tighter">Deployment Environments.</h2>
            <p className="text-lg text-gray-500">Built for high-density locations where secure, paid, and strictly managed internet access is fundamentally required.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Building2, title: 'Universities', desc: 'Campus-wide student authentication & billing.' },
              { icon: Home, title: 'Private Estates', desc: 'Resident network management & throttling.' },
              { icon: Briefcase, title: 'Corporate Hubs', desc: 'Guest & employee traffic routing.' },
              { icon: Tent, title: 'Conferences', desc: 'High-density time-based access control.' },
            ].map((env, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-[#FAFAFA] p-8 rounded-3xl border border-gray-100 hover:bg-white hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#cfa253]/0 to-[#cfa253]/0 group-hover:to-[#cfa253]/5 transition-colors duration-500"></div>
                
                <div className="relative z-10">
                  <div className="bg-white w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center mb-6 group-hover:bg-[#6d1825] transition-colors duration-300">
                    <env.icon className="text-gray-400 group-hover:text-white transition-colors" size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2 tracking-tight">{env.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{env.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CINEMATIC CTA */}
      <section className="relative py-32 md:py-48 bg-[#050505] overflow-hidden text-center flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <Image 
            src="/community.jpg" 
            alt="Rural connectivity" 
            fill 
            className="object-cover object-center opacity-[0.35] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
        </div>
        
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER_CONTAINER}
          className="relative z-10 max-w-4xl mx-auto px-4"
        >
          <motion.span variants={FADE_UP} className="text-[#cfa253] font-bold text-[11px] md:text-xs tracking-widest uppercase mb-6 block">Scale With Us</motion.span>
          <motion.h2 variants={FADE_UP} className="text-4xl md:text-6xl font-black text-white mb-10 leading-[1.05] tracking-tighter drop-shadow-lg">
            Deploy the Connectly framework at your facility.
          </motion.h2>
          <motion.div variants={FADE_UP} className="flex justify-center">
            <a href="mailto:connectly.hq@outlook.com" className="bg-[#cfa253] hover:bg-white text-black px-8 py-4.5 md:px-10 md:py-5 font-bold uppercase tracking-wider text-xs md:text-sm rounded-full transition-all duration-300 shadow-[0_0_40px_rgba(207,162,83,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] flex items-center gap-3 hover:-translate-y-1">
              Initiate Technical Partnership <ArrowRight size={18} />
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ARCHITECTURAL FOOTER */}
      <footer className="bg-[#050505] text-gray-400 py-16 md:py-24 border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 md:gap-16">
          <div className="col-span-1 sm:col-span-2">
            <Link href="/" className="relative block h-7 w-32 md:h-8 md:w-36 mb-8 group">
              <Image 
                src="/connectly-logo-horizontal.svg" 
                alt="Connectly Logo" 
                fill
                className="object-contain brightness-0 invert group-hover:opacity-80 transition-opacity" 
              />
            </Link>
            <p className="text-sm leading-relaxed max-w-md mb-8 text-gray-500 font-light">
              Enterprise software layer for managing local Wi-Fi hotspot authentication, locations, and transaction routing.
            </p>
            <p className="text-xs text-gray-600 font-mono tracking-wide">
              CONNECTLY TECHNOLOGIES LTD <br/>
              RC 9843504 <br/>
              Abuja, Nigeria
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-[10px] md:text-[11px]">Platform Specs</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><Link href="#platform" className="text-gray-400 hover:text-[#cfa253] transition-colors">Captive Portals</Link></li>
              <li><Link href="#platform" className="text-gray-400 hover:text-[#cfa253] transition-colors">Payment Gateways</Link></li>
              <li><Link href="#platform" className="text-gray-400 hover:text-[#cfa253] transition-colors">Mikrotik Routing</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-[10px] md:text-[11px]">Corporate</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><a href="mailto:connectly.hq@outlook.com" className="text-gray-400 hover:text-white transition-colors">Partnerships</a></li>
              <li><a href="mailto:connectly.hq@outlook.com" className="text-gray-400 hover:text-white transition-colors">Contact Support</a></li>
            </ul>
=======
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Archivo } from 'next/font/google';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, ArrowDown, Briefcase, CreditCard, Globe, GraduationCap, Home,
  Lock, Menu, Network, Radio, Router, Satellite, School, Server, ShieldCheck, Smartphone,
  Tent, WifiHigh, X, Cable, BedDouble, Layers,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Brand tokens                                                        */
/* ------------------------------------------------------------------ */

const display = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap' });

// Archivo's width axis gives headlines an engineered, infrastructural feel
const WIDE = { fontStretch: '118%' } as const;

const BURGUNDY = '#6d1825';
const SAND = '#cfa253';
const EASE = [0.16, 1, 0.3, 1] as const;
const EMAIL = 'mailto:connectly.hq@outlook.com';

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const NAV = [
  { href: '#solutions', label: 'Solutions' },
  { href: '#platform', label: 'Platform' },
  { href: '#deployments', label: 'Deployments' },
  { href: '#network', label: 'Network vision' },
];

const PILLARS = [
  { icon: Lock, title: 'Captive portals', desc: 'Branded sign-in and frictionless digital onboarding.' },
  { icon: CreditCard, title: 'Automated payments', desc: 'Secure transaction routing through integrated payment gateways.' },
  { icon: Server, title: 'Hardware routing', desc: 'MikroTik network edge integration and access control.' },
];

const SOLUTIONS = [
  {
    icon: WifiHigh,
    title: 'Managed WiFi infrastructure',
    desc: 'Design, deployment and ongoing management of WiFi networks built for high-density sites.',
  },
  {
    icon: Globe,
    title: 'Internet connectivity solutions',
    desc: 'Reliable upstream connectivity matched to each site’s users, location and budget.',
  },
  {
    icon: Network,
    title: 'Network deployment and management',
    desc: 'Site surveys, installation, configuration and day-to-day operation of local networks.',
  },
  {
    icon: ShieldCheck,
    title: 'Connectivity management technology',
    desc: 'Captive portals, user authentication, data plans, payments and access control in one platform.',
  },
  {
    icon: Satellite,
    title: 'Satellite connectivity integration',
    desc: 'Satellite links where fibre and mobile coverage cannot reach, and as resilient backup where they can.',
  },
  {
    icon: Layers,
    title: 'Digital access infrastructure',
    desc: 'Shared hardware and software that let institutions offer paid or sponsored internet access to the people they serve.',
  },
];

const SIGNAL_PATH = [
  { icon: Smartphone, label: 'Device' },
  { icon: Lock, label: 'Captive portal' },
  { icon: CreditCard, label: 'Payment' },
  { icon: Router, label: 'Edge router' },
  { icon: Globe, label: 'Internet' },
];

const STEPS = [
  {
    title: 'User joins the network',
    desc: 'Connecting to local WiFi opens the captive portal authentication screen.',
  },
  {
    title: 'Digital transaction',
    desc: 'The user selects a data plan and pays securely through integrated payment APIs.',
  },
  {
    title: 'Hardware authorisation',
    desc: 'MikroTik edge routers receive payment confirmation and grant internet access instantly.',
  },
];

const ENVIRONMENTS = [
  { icon: GraduationCap, title: 'Universities', desc: 'Campus-wide student authentication and billing.' },
  { icon: BedDouble, title: 'Student accommodation', desc: 'Per-resident access, data plans and fair-use controls.' },
  { icon: School, title: 'Schools', desc: 'Managed access for classrooms, staff and learning platforms.' },
  { icon: Briefcase, title: 'Businesses and corporate hubs', desc: 'Guest and employee traffic routing.' },
  { icon: Home, title: 'Private estates', desc: 'Resident network management and throttling.' },
  { icon: Tent, title: 'Conferences and events', desc: 'High-density, time-based access control.' },
];

const NETWORKS = [
  { icon: Cable, label: 'Fibre' },
  { icon: Radio, label: 'Mobile networks' },
  { icon: WifiHigh, label: 'WiFi' },
  { icon: Satellite, label: 'Satellite' },
  { icon: Smartphone, label: 'Direct-to-device satellite', future: true },
];

/* ------------------------------------------------------------------ */
/* Motion presets: one orchestrated entrance, nothing scattered        */
/* ------------------------------------------------------------------ */

const STAGGER = { hidden: {}, visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } };
const RISE = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ConnectlyHome() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const solid = scrolled || menuOpen;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF8] text-[#141012] selection:bg-[#cfa253] selection:text-black">
      <PageStyles />

      {/* ============================ NAVBAR ============================ */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,padding] duration-500 ${
          solid
            ? 'border-b border-black/[0.06] bg-white/90 py-3 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent py-5 md:py-6'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Connectly home" className="relative block h-6 w-28 md:h-7 md:w-32">
            <Image
              src="/connectly-logo-horizontal.svg"
              alt="Connectly"
              fill
              priority
              className={`object-contain object-left transition-[filter] duration-300 ${solid ? '' : 'brightness-0 invert'}`}
            />
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className={`flex gap-9 text-[14px] font-medium ${solid ? 'text-neutral-600' : 'text-white/75'}`}>
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={`transition-colors ${solid ? 'hover:text-[#6d1825]' : 'hover:text-white'}`}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={EMAIL}
              className={`hidden rounded-full px-5 py-2.5 text-[13px] font-semibold transition-colors duration-300 sm:inline-flex ${
                solid
                  ? 'bg-[#6d1825] text-white hover:bg-[#4a0f19]'
                  : 'border border-white/25 text-white hover:bg-white hover:text-black'
              }`}
            >
              Partner inquiries
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full md:hidden ${
                solid ? 'text-neutral-900' : 'text-white'
              }`}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="mobile-menu" aria-label="Mobile" className="border-t border-black/[0.06] bg-white md:hidden">
            <ul className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
              {NAV.map((item) => (
                <li key={item.href} className="border-b border-black/[0.06] last:border-0">
                  <a
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`${display.className} block py-4 text-xl font-semibold text-neutral-900`}
                    style={WIDE}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="pt-4 pb-2">
                <a
                  href={EMAIL}
                  className="flex w-full justify-center rounded-full bg-[#6d1825] py-3.5 text-sm font-semibold text-white"
                >
                  Partner inquiries
                </a>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main>
        {/* ============================ HERO ============================ */}
        <section className="relative isolate overflow-hidden bg-[#050505] pt-36 pb-44 md:pt-48 md:pb-60">
          <Image
            src="/group 1.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-center opacity-[0.32]"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#050505_0%,rgba(5,5,5,0.86)_45%,rgba(5,5,5,0.35)_100%)]"
          />
          <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-[#050505]" />
          <SignalRings />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={STAGGER}
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
              className="max-w-4xl"
            >
              <motion.p
                variants={RISE}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] font-medium text-white/80"
              >
                <WifiHigh size={15} className="text-[#cfa253]" aria-hidden />
                Connectivity infrastructure
              </motion.p>

              <motion.h1
                variants={RISE}
                className={`${display.className} mt-8 text-[2.75rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-white sm:text-6xl md:text-7xl lg:text-[5.6rem]`}
                style={WIDE}
              >
                Connectivity, built for the places that need it.
              </motion.h1>

              <motion.p
                variants={RISE}
                className="mt-8 max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl"
              >
                Connectly builds and manages the connectivity infrastructure and digital platforms that make internet
                access more accessible: managed WiFi networks, authenticated and paid access at the network edge, and
                reach into the institutions and communities that need it most.
              </motion.p>

              <motion.div variants={RISE} className="mt-11 flex flex-col gap-3 sm:flex-row">
                <a
                  href={EMAIL}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#cfa253] px-7 py-4 text-[15px] font-semibold text-black transition-colors hover:bg-white"
                >
                  Partner inquiries
                </a>
                <a
                  href="#platform"
                  className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-7 py-4 text-[15px] font-semibold text-white transition-colors hover:border-white"
                >
                  Explore the platform
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                </a>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ======================= PLATFORM PILLARS ====================== */}
        <section aria-label="Platform capabilities" className="relative z-10 -mt-24 md:-mt-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ul className="grid divide-y divide-black/[0.07] rounded-[1.75rem] bg-white shadow-[0_30px_80px_-30px_rgba(20,10,12,0.35)] ring-1 ring-black/[0.05] md:grid-cols-3 md:divide-x md:divide-y-0">
              {PILLARS.map(({ icon: Icon, title, desc }, i) => (
                <li key={title} className="flex items-start gap-5 p-7 md:p-10">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      background: i === 1 ? 'rgba(207,162,83,0.16)' : i === 0 ? 'rgba(109,24,37,0.08)' : '#f1f0ee',
                      color: i === 1 ? '#9a7633' : i === 0 ? BURGUNDY : '#1f1f1f',
                    }}
                  >
                    <Icon size={22} strokeWidth={2} aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-500">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ========================== SOLUTIONS ========================= */}
        <section id="solutions" className="scroll-mt-20 py-24 md:py-36">
          <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <h2
                  className={`${display.className} text-4xl leading-[1.02] font-extrabold tracking-[-0.025em] md:text-[3.4rem]`}
                  style={WIDE}
                >
                  What we build and manage.
                </h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-neutral-500">
                  From the first site survey to day-to-day network operations, Connectly takes responsibility for the
                  whole path to reliable internet access.
                </p>
                <div className="relative mt-10 hidden aspect-[4/3] overflow-hidden rounded-[1.5rem] lg:block">
                  <Image
                    src="/group 3.jpg"
                    alt="Students using connected devices"
                    fill
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            <ul className="grid gap-px overflow-hidden rounded-[1.5rem] bg-black/[0.07] ring-1 ring-black/[0.07] sm:grid-cols-2 lg:col-span-7">
              {SOLUTIONS.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="group bg-white p-8 transition-colors hover:bg-[#fbf8f2] md:p-9">
                  <Icon size={26} strokeWidth={1.7} className="text-[#6d1825]" aria-hidden />
                  <h3 className="mt-7 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">{desc}</p>
                </li>
              ))}
            </ul>

            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] lg:hidden">
              <Image src="/group 3.jpg" alt="Students using connected devices" fill sizes="100vw" className="object-cover" />
            </div>
          </div>
        </section>

        {/* =========================== PLATFORM ========================= */}
        <section id="platform" className="scroll-mt-20 bg-[#050505] py-24 text-white md:py-36">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
              <h2
                className={`${display.className} text-4xl leading-[1.02] font-extrabold tracking-[-0.025em] md:text-[3.4rem] lg:col-span-6`}
                style={WIDE}
              >
                Not an ISP.
                <br />
                <span className="text-[#cfa253]">An operational layer.</span>
              </h2>
              <p className="max-w-xl text-lg leading-relaxed text-white/60 lg:col-span-5 lg:col-start-8">
                Connectly does not just resell bandwidth. We provide the enterprise-grade software and routing
                configurations that manage, secure and monetise high-density local networks, from the moment a device
                connects to the moment it reaches the internet.
              </p>
            </div>

            <SignalPath />

            <ol className="mt-16 grid gap-px overflow-hidden rounded-[1.5rem] bg-white/10 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="bg-[#0d0b0c] p-8 md:p-10">
                  <span
                    className={`${display.className} text-sm font-bold text-[#cfa253]`}
                    style={WIDE}
                    aria-hidden
                  >
                    Step {i + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/55">{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ========================= DEPLOYMENTS ======================== */}
        <section id="deployments" className="scroll-mt-20 py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
              <h2
                className={`${display.className} text-4xl leading-[1.02] font-extrabold tracking-[-0.025em] md:text-[3.4rem] lg:col-span-6`}
                style={WIDE}
              >
                Deployment environments.
              </h2>
              <p className="max-w-xl text-lg leading-relaxed text-neutral-500 lg:col-span-5 lg:col-start-8">
                Built for high-density locations where secure, reliable and carefully managed internet access is
                fundamentally required.
              </p>
            </div>

            <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ENVIRONMENTS.map(({ icon: Icon, title, desc }) => (
                <li
                  key={title}
                  className="group relative overflow-hidden rounded-[1.5rem] border border-black/[0.07] bg-white p-8 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-[#6d1825]/30"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f1ec] text-neutral-700 transition-colors duration-300 group-hover:bg-[#6d1825] group-hover:text-white">
                    <Icon size={22} strokeWidth={1.8} aria-hidden />
                  </span>
                  <h3 className="mt-8 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-500">{desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ===================== UNDERSERVED COMMUNITIES ================== */}
        <section id="communities" className="relative isolate scroll-mt-20 overflow-hidden bg-[#050505] text-white">
          <Image
            src="/community.jpg"
            alt="A rural community that Connectly aims to connect"
            fill
            sizes="100vw"
            className="-z-20 object-cover object-center opacity-50"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,#050505_0%,rgba(5,5,5,0.7)_45%,rgba(5,5,5,0.25)_100%)] md:bg-[linear-gradient(90deg,#050505_0%,rgba(5,5,5,0.8)_45%,rgba(5,5,5,0.1)_100%)]"
          />
          <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 md:py-44 lg:px-8">
            <div className="max-w-2xl">
              <h2
                className={`${display.className} text-4xl leading-[1.02] font-extrabold tracking-[-0.025em] md:text-[3.4rem]`}
                style={WIDE}
              >
                Expanding access to underserved communities.
              </h2>
              <p className="mt-7 text-lg leading-relaxed text-white/70">
                Connectivity should not stop where commercial networks thin out. We work to extend reliable, affordable
                internet access into underserved communities and the schools, clinics and institutions that serve them,
                using whichever mix of WiFi, mobile and satellite connectivity reaches them best.
              </p>
            </div>
          </div>
        </section>

        {/* ========================= NETWORK VISION ===================== */}
        <section id="network" className="scroll-mt-20 py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
              <h2
                className={`${display.className} text-4xl leading-[1.02] font-extrabold tracking-[-0.025em] md:text-[3.4rem] lg:col-span-6`}
                style={WIDE}
              >
                One access layer across every network.
              </h2>
              <p className="max-w-xl text-lg leading-relaxed text-neutral-500 lg:col-span-5 lg:col-start-8">
                Today we deploy and manage WiFi networks and the platform that controls access to them. Our long-term
                ambition is to bring fibre, mobile networks, WiFi and satellite connectivity, potentially including
                direct-to-device satellite partnerships, under one managed access layer.
              </p>
            </div>

            <NetworkConvergence />
          </div>
        </section>

        {/* ============================== CTA =========================== */}
        <section className="bg-[#6d1825] text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 md:py-32 lg:grid-cols-12 lg:items-end lg:px-8">
            <div className="lg:col-span-8">
              <p className="text-[15px] font-medium text-[#e9c98c]">Scale with us</p>
              <h2
                className={`${display.className} mt-4 text-4xl leading-[1.02] font-extrabold tracking-[-0.025em] md:text-6xl`}
                style={WIDE}
              >
                Deploy the Connectly framework at your facility.
              </h2>
            </div>
            <div className="lg:col-span-4 lg:justify-self-end">
              <a
                href={EMAIL}
                className="group inline-flex items-center gap-3 rounded-full bg-[#cfa253] px-8 py-4.5 text-[15px] font-semibold text-black transition-colors hover:bg-white"
              >
                Initiate technical partnership
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ============================ FOOTER ============================ */}
      <footer className="bg-[#050505] text-white/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-12">
            <div className="sm:col-span-2 lg:col-span-5">
              <Link href="/" aria-label="Connectly home" className="relative block h-7 w-36">
                <Image
                  src="/connectly-logo-horizontal.svg"
                  alt="Connectly"
                  fill
                  className="object-contain object-left brightness-0 invert"
                />
              </Link>
              <p className="mt-7 max-w-sm text-[15px] leading-relaxed">
                Connectivity infrastructure and digital access platforms: managed WiFi, network deployment, hotspot
                authentication and transaction routing.
              </p>
              <p className="mt-7 text-[13px] leading-relaxed text-white/40">
                Connectly Technologies Ltd
                <br />
                RC 9843504
                <br />
                Abuja, Nigeria
              </p>
            </div>

            <FooterColumn
              title="Platform"
              links={[
                { href: '#platform', label: 'Captive portals' },
                { href: '#platform', label: 'Payment gateways' },
                { href: '#platform', label: 'MikroTik routing' },
              ]}
            />
            <FooterColumn
              title="Solutions"
              links={[
                { href: '#solutions', label: 'Managed WiFi' },
                { href: '#solutions', label: 'Satellite integration' },
                { href: '#deployments', label: 'Deployments' },
              ]}
            />
            <FooterColumn
              title="Corporate"
              links={[
                { href: EMAIL, label: 'Partnerships' },
                { href: EMAIL, label: 'Contact support' },
              ]}
            />
          </div>

          <div className="mt-16 flex flex-col gap-2 border-t border-white/10 pt-6 text-[13px] text-white/35 sm:flex-row sm:justify-between">
            <p>© {new Date().getFullYear()} Connectly Technologies Ltd. All rights reserved.</p>
            <p>Built in Abuja, Nigeria.</p>
>>>>>>> ba4ce5a (chore: initialize code from new workspace)
          </div>
        </div>
      </footer>
    </div>
  );
<<<<<<< HEAD
=======
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={`Footer: ${title}`} className="lg:col-span-2">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-5 space-y-3 text-[15px]">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="transition-colors hover:text-[#cfa253]">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Concentric signal rings radiating from the hero's right edge: the one ambient motion on the page. */
function SignalRings() {
  return (
    <div aria-hidden className="pointer-events-none absolute -right-40 top-1/2 -z-10 hidden -translate-y-1/2 md:block">
      <div className="relative h-[720px] w-[720px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="cx-ring absolute inset-0 rounded-full border border-[#cfa253]/40"
            style={{ animationDelay: `${i * 1.5}s` }}
          />
        ))}
        <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#cfa253] shadow-[0_0_30px_8px_rgba(207,162,83,0.45)]" />
      </div>
    </div>
  );
}

/** The access flow as a live circuit: a pulse travels from device to internet, lighting each node in turn. */
function SignalPath() {
  return (
    <div className="mt-16 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(ellipse_at_top,rgba(109,24,37,0.35),transparent_70%)] p-6 md:mt-20 md:p-12">
      <ol
        aria-label="How a user gets online: device, captive portal, payment, edge router, internet"
        className="flex flex-col items-center md:flex-row md:items-start"
      >
        {SIGNAL_PATH.map(({ icon: Icon, label }, i) => (
          <li key={label} className="contents">
            <div className="flex w-36 flex-col items-center text-center md:w-auto md:flex-1">
              <span
                className="cx-node flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-[#121012] text-white md:h-[72px] md:w-[72px]"
                style={{ animationDelay: `${i}s` }}
              >
                <Icon size={26} strokeWidth={1.6} aria-hidden />
              </span>
              <span className="mt-3 text-[13px] font-medium text-white/70 md:text-sm">{label}</span>
            </div>
            {i < SIGNAL_PATH.length - 1 && (
              <span
                aria-hidden
                className="relative my-2 block h-10 w-px bg-white/15 md:mx-1 md:mt-9 md:h-px md:w-auto md:flex-1"
              >
                <span className="cx-dot absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#cfa253] shadow-[0_0_12px_3px_rgba(207,162,83,0.6)] md:left-0 md:top-1/2 md:translate-x-0" style={{ animationDelay: `${i}s` }} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Fibre, mobile, WiFi and satellite converging on one managed access layer. */
const DESTINATIONS = ['Campuses and schools', 'Student accommodation', 'Businesses', 'Underserved communities'];

function NetworkConvergence() {
  const source = (n: (typeof NETWORKS)[number]) => {
    const Icon = n.icon;
    return (
      <span
        className={`inline-flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-medium whitespace-nowrap ${
          n.future
            ? 'border border-dashed border-[#6d1825]/45 text-[#6d1825]'
            : 'border border-black/[0.08] bg-[#f6f4f0] text-neutral-800'
        }`}
      >
        <Icon size={17} strokeWidth={1.8} aria-hidden />
        {n.label}
        {n.future && <span className="text-[12px] font-normal text-[#6d1825]/70">(future)</span>}
      </span>
    );
  };
  const hub = (
    <div className="rounded-[1.25rem] bg-[#6d1825] px-8 py-9 text-center text-white shadow-[0_24px_60px_-20px_rgba(109,24,37,0.6)]">
      <p className={`${display.className} text-2xl font-extrabold leading-tight tracking-[-0.01em]`} style={WIDE}>
        Connectly
        <br />
        access layer
      </p>
      <p className="mt-3 text-[13px] leading-snug text-white/70">
        Authentication, billing,
        <br />
        routing and management
      </p>
    </div>
  );
  const dest = (d: string) => (
    <span className="inline-flex items-center rounded-full border border-black/[0.08] px-4 py-2.5 text-[14px] font-medium whitespace-nowrap text-neutral-800">
      {d}
    </span>
  );

  return (
    <div className="mt-16 rounded-[1.75rem] border border-black/[0.07] bg-white p-6 md:p-12">
      {/* Desktop: sources -> bus -> hub -> bus -> destinations */}
      <div className="hidden items-stretch justify-center lg:flex">
        <ul className="flex flex-col gap-3">
          {NETWORKS.map((n) => (
            <li key={n.label} className="flex items-center justify-end">
              {source(n)}
              <span aria-hidden className="h-px w-10 bg-black/15" />
            </li>
          ))}
        </ul>
        <span aria-hidden className="my-[21px] w-px bg-black/15" />
        <div className="flex items-center">
          <span aria-hidden className="h-px w-12 bg-black/15" />
          {hub}
          <span aria-hidden className="h-px w-12 bg-black/15" />
        </div>
        <div className="flex items-stretch self-center">
          <span aria-hidden className="my-[21px] w-px bg-black/15" />
          <ul className="flex flex-col gap-3">
            {DESTINATIONS.map((d) => (
              <li key={d} className="flex items-center">
                <span aria-hidden className="h-px w-10 bg-black/15" />
                {dest(d)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile and tablet: stacked */}
      <div className="flex flex-col items-center gap-5 lg:hidden">
        <ul className="flex flex-wrap justify-center gap-2.5">
          {NETWORKS.map((n) => (
            <li key={n.label}>{source(n)}</li>
          ))}
        </ul>
        <ArrowDown aria-hidden size={20} className="text-black/30" />
        {hub}
        <ArrowDown aria-hidden size={20} className="text-black/30" />
        <ul className="flex flex-wrap justify-center gap-2.5">
          {DESTINATIONS.map((d) => (
            <li key={d}>{dest(d)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Keyframes for the ambient rings and the signal path. Disabled for people who prefer reduced motion. */
function PageStyles() {
  return (
    <style>{`
      .cx-ring { animation: cx-ring 6s cubic-bezier(0.2, 0.6, 0.3, 1) infinite; opacity: 0; transform: scale(0.15); }
      @keyframes cx-ring {
        0% { opacity: 0; transform: scale(0.15); }
        15% { opacity: 0.9; }
        100% { opacity: 0; transform: scale(1); }
      }
      .cx-dot { animation: cx-travel-y 4s linear infinite; opacity: 0; }
      @media (min-width: 768px) { .cx-dot { animation-name: cx-travel-x; } }
      @keyframes cx-travel-y {
        0% { top: 0; opacity: 0; }
        3% { opacity: 1; }
        22% { opacity: 1; }
        25% { top: 100%; opacity: 0; }
        100% { top: 100%; opacity: 0; }
      }
      @keyframes cx-travel-x {
        0% { left: 0; opacity: 0; }
        3% { opacity: 1; }
        22% { opacity: 1; }
        25% { left: 100%; opacity: 0; }
        100% { left: 100%; opacity: 0; }
      }
      .cx-node { animation: cx-node 4s ease-out infinite; }
      @keyframes cx-node {
        0% { border-color: ${SAND}; box-shadow: 0 0 0 0 rgba(207,162,83,0.55), 0 0 28px rgba(207,162,83,0.35); color: ${SAND}; }
        22% { border-color: rgba(255,255,255,0.15); box-shadow: 0 0 0 14px rgba(207,162,83,0), 0 0 0 rgba(207,162,83,0); color: #fff; }
        100% { border-color: rgba(255,255,255,0.15); box-shadow: none; color: #fff; }
      }
      @media (prefers-reduced-motion: reduce) {
        .cx-ring, .cx-dot, .cx-node { animation: none !important; }
        .cx-ring { opacity: 0.25; transform: scale(0.6); }
      }
      html { scroll-behavior: smooth; }
      @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
    `}</style>
  );
>>>>>>> ba4ce5a (chore: initialize code from new workspace)
}