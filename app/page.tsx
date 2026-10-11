'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ArrowRight, Building2, Server, 
  CreditCard, Home, Tent, Briefcase, Lock, CheckCircle2
} from 'lucide-react';

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const FADE_UP = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
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
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
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
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
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
          </div>
        </div>
      </footer>
    </div>
  );
}