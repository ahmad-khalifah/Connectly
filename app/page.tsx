'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowRight, Globe, Building2, School, Stethoscope, 
  Briefcase, Home, Tent, MapPin, Server, Wifi, ShieldCheck, 
  CreditCard, Smartphone, Activity, Users 
} from 'lucide-react';

const FADE_UP = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export default function ConnectlyCorporate() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-[#6d1825] selection:text-white font-sans">
      <nav className={`fixed w-full z-50 transition-all duration-300 border-b ${scrolled ? 'bg-white/90 backdrop-blur-md border-gray-200 py-4' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 relative h-8 w-32 md:h-10 md:w-40">
            <Image 
              src="/connectly-logo-horizontal.svg" 
              alt="Connectly Logo" 
              fill
              className={`object-contain ${!scrolled && 'brightness-0 invert'}`} 
              priority
            />
          </Link>
          <div className={`hidden md:flex gap-8 text-sm font-medium ${scrolled ? 'text-gray-600' : 'text-gray-200'}`}>
            <Link href="#solution" className="hover:text-[#cfa253] transition-colors">Solution</Link>
            <Link href="#how-it-works" className="hover:text-[#cfa253] transition-colors">How It Works</Link>
            <Link href="#markets" className="hover:text-[#cfa253] transition-colors">Markets</Link>
            <Link href="#company" className="hover:text-[#cfa253] transition-colors">Company</Link>
          </div>
          <a href="mailto:connectly.hq@outlook.com" className="bg-[#6d1825] text-white px-4 py-2 md:px-6 md:py-2.5 rounded-sm text-sm font-bold hover:bg-[#56131d] transition-colors">
            Partner With Us
          </a>
        </div>
      </nav>

      <section className="relative h-[100svh] flex items-center pt-20 overflow-hidden bg-gray-900">
        <div className="absolute inset-0 z-0">
          <Image 
            src="/group 1.jpg" 
            alt="Young Africans utilizing digital connectivity" 
            fill 
            className="object-cover object-center opacity-40 scale-105 animate-slow-pan"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 w-full">
          <motion.div initial="hidden" animate="visible" variants={FADE_UP} className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6">
              Connecting people to what moves them forward.
            </h1>
            <p className="text-base md:text-xl text-gray-300 leading-relaxed mb-10 max-w-2xl">
              Connectly builds and manages reliable internet connectivity for communities, institutions, and businesses in places where connectivity matters most.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="mailto:connectly.hq@outlook.com" className="bg-[#cfa253] text-gray-900 px-8 py-4 rounded-sm font-bold hover:bg-[#b88c42] transition-colors flex items-center justify-center gap-2 text-center">
                Partner With Us <ArrowRight size={18} />
              </a>
              <Link href="#solution" className="border border-gray-400 text-white px-8 py-4 rounded-sm font-bold hover:bg-white/10 transition-colors text-center">
                Explore Our Solution
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="problem" className="py-16 md:py-24 bg-white pt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-gray-900">
                The infrastructure gap limits potential.
              </h2>
              <p className="text-gray-600 text-base md:text-lg leading-relaxed mb-6">
                Reliable internet access remains difficult to deploy and sustain in many communities, educational institutions, and remote locations. 
              </p>
              <p className="text-gray-600 text-base md:text-lg leading-relaxed">
                When connectivity fails, it halts education, disrupts healthcare, limits businesses, and restricts access to the global digital economy. We are building the physical and digital layers to solve this.
              </p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative h-[300px] md:h-[500px] rounded-sm overflow-hidden"
            >
              <Image 
                src="/community 2.jpg" 
                alt="Students and educators lacking reliable access" 
                fill 
                className="object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <section id="solution" className="py-16 md:py-24 bg-gray-50 border-y border-gray-200 pt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="max-w-3xl mx-auto mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">A unified managed network.</h2>
            <p className="text-gray-600 text-base md:text-lg">
              Connectly is not a reseller. We deploy end-to-end managed connectivity infrastructure, combining physical networking hardware with proprietary digital access software.
            </p>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            {[
              { icon: Globe, label: 'Internet Backhaul' },
              { icon: Server, label: 'Connectly Infrastructure' },
              { icon: ShieldCheck, label: 'Managed Network' },
              { icon: Users, label: 'People & Organizations' },
            ].map((step, idx, arr) => (
              <div key={idx} className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full md:w-auto">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.2 }}
                  className="bg-white p-6 md:p-8 rounded-sm shadow-sm border border-gray-100 flex flex-col items-center w-full md:w-48"
                >
                  <step.icon className="text-[#6d1825] mb-4" size={32} />
                  <span className="font-bold text-sm text-gray-900">{step.label}</span>
                </motion.div>
                {idx < arr.length - 1 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    className="text-[#cfa253] md:rotate-0 rotate-90 my-2"
                  >
                    <ArrowRight size={24} />
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="markets" className="py-16 md:py-24 bg-white pt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">One platform. Any environment.</h2>
            <p className="text-gray-600 text-base md:text-lg">Built for places where reliable connectivity is fundamentally required.</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 md:gap-x-8 gap-y-8 md:gap-y-12">
            {[
              { icon: Building2, title: 'Universities' },
              { icon: MapPin, title: 'Communities' },
              { icon: School, title: 'Schools' },
              { icon: Stethoscope, title: 'Healthcare' },
              { icon: Briefcase, title: 'Businesses' },
              { icon: Home, title: 'Estates' },
              { icon: Tent, title: 'Events' },
              { icon: Globe, title: 'Remote Locations' },
            ].map((env, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group border-t border-gray-200 pt-4 md:pt-6"
              >
                <env.icon className="text-gray-400 group-hover:text-[#6d1825] transition-colors mb-3 md:mb-4" size={24} />
                <h3 className="font-bold text-gray-900 text-sm md:text-base">{env.title}</h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gray-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
              <span className="text-[#cfa253] font-bold text-xs md:text-sm tracking-widest uppercase mb-4 block">The Entry Point</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                Proving the model on campus.
              </h2>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed mb-8">
                Our university deployments provide a practical, high-density starting point for the Connectly model. We replace fractured campus networks with a unified digital experience.
              </p>
              
              <div className="space-y-6 border-l border-gray-700 pl-6">
                {[
                  { title: 'Connect', desc: 'User joins the Connectly local network.', color: 'bg-[#cfa253]' },
                  { title: 'Authenticate', desc: 'Captive portal opens for seamless digital onboarding.', color: 'bg-gray-700' },
                  { title: 'Transact', desc: 'User completes secure automated payment.', color: 'bg-gray-700' },
                  { title: 'Access', desc: 'Hardware receives authorization, granting immediate internet access.', color: 'bg-[#6d1825]' },
                ].map((step, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ${step.color}`} />
                    <h4 className="font-bold">{step.title}</h4>
                    <p className="text-sm text-gray-400">{step.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative h-[300px] md:h-[600px] w-full"
            >
              <Image 
                src="/group 3.jpg" 
                alt="Students utilizing connected devices" 
                fill 
                className="object-cover rounded-sm grayscale hover:grayscale-0 transition-all duration-700"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-16 md:py-24 bg-white pt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="mb-12 md:mb-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Infrastructure, visualized.</h2>
            <p className="text-gray-600 text-base md:text-lg">Hardware and software engineered to work in unison.</p>
          </motion.div>

          <div className="bg-gray-50 border border-gray-200 p-6 md:p-16 rounded-sm">
            <div className="flex flex-col space-y-6 md:space-y-4 relative">
              <div className="absolute left-[27px] md:left-[50%] top-0 bottom-0 w-px bg-gray-300 md:-translate-x-1/2 z-0" />
              
              {[
                { icon: Globe, title: 'Satellite / Fiber Backhaul', desc: 'Sourcing reliable external bandwidth.' },
                { icon: Server, title: 'Edge Routing', desc: 'Traffic management and firewall.' },
                { icon: Wifi, title: 'Access Points', desc: 'High-density wireless distribution.' },
                { icon: Smartphone, title: 'Captive Portal', desc: 'User-facing software layer.' },
                { icon: CreditCard, title: 'Payment Verification', desc: 'Automated digital transaction routing.' },
                { icon: ShieldCheck, title: 'Access Management', desc: 'Hardware-level device authorization.' },
                { icon: Activity, title: 'Network Monitoring', desc: 'Continuous uptime and health tracking.' },
              ].map((layer, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  className={`relative z-10 flex items-center gap-4 md:gap-6 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} w-full`}
                >
                  <div className="hidden md:block w-1/2" />
                  <div className="bg-white border border-gray-200 p-3 md:p-4 rounded-full shadow-sm text-[#6d1825] shrink-0 z-10">
                    <layer.icon size={20} className="md:w-6 md:h-6" />
                  </div>
                  <div className={`w-full md:w-1/2 bg-white border border-gray-200 p-4 md:p-6 rounded-sm shadow-sm ${i % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
                    <h4 className="font-bold text-gray-900 text-sm md:text-base">{layer.title}</h4>
                    <p className="text-xs md:text-sm text-gray-500">{layer.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 grid md:grid-cols-2 gap-10 md:gap-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="flex flex-col justify-center order-2 md:order-1">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 md:mb-8 leading-tight">
              We don't just sell bandwidth. We build the operational layer.
            </h2>
            <p className="text-gray-400 text-base md:text-xl leading-relaxed mb-8">
              Connectly differentiates by managing the entire stack—from physical network deployment to user onboarding, automated payments, and technical support.
            </p>
            <div className="border-t border-gray-700 pt-6 md:pt-8 mt-auto">
              <p className="text-xs md:text-sm text-[#cfa253] font-bold uppercase tracking-widest mb-2">Technical Experience</p>
              <p className="text-sm md:text-base text-gray-300">Successfully developed and deployed enterprise-grade voting and network infrastructure within Al-Hikmah University environments.</p>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="relative h-[300px] md:h-auto rounded-sm overflow-hidden order-1 md:order-2"
          >
            <Image 
              src="/farmer.jpg" 
              alt="Connectly infrastructure deployment and technical support" 
              fill 
              className="object-cover"
            />
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-12 md:mb-20">
            Start where connectivity is needed. <br className="hidden md:block"/>Build the infrastructure. Expand.
          </h2>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative max-w-4xl mx-auto pl-6 md:pl-0">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200 hidden md:block -z-10" />
            <div className="absolute left-[31px] top-4 bottom-4 w-px bg-gray-200 block md:hidden -z-10" />

            {['One Location', 'One Community', 'Multiple Locations', 'Broader Infrastructure'].map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="bg-white py-2 md:py-4 pr-4 md:px-6 mb-6 md:mb-0 flex md:block items-center text-left md:text-center w-full md:w-auto"
              >
                <div className="h-3 w-3 md:h-4 md:w-4 bg-[#6d1825] rounded-full mr-4 md:mx-auto md:mb-4 ring-4 ring-white shrink-0" />
                <span className="font-bold text-xs md:text-sm text-gray-900 uppercase tracking-wider">{step}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative h-[80svh] md:h-screen flex items-center overflow-hidden bg-black">
        <div className="absolute inset-0 z-0">
          <Image 
            src="/community.jpg" 
            alt="Rural connectivity and digital access" 
            fill 
            className="object-cover object-center opacity-50 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 w-full text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-6 md:mb-8">
              Connectivity should not depend on where you live.
            </h2>
            <p className="text-lg md:text-2xl text-gray-200 leading-relaxed font-light">
              We are building toward a future where reliable internet access can be deployed closer to the people, institutions, and businesses that need it most. Access to the digital economy is a requirement, regardless of location.
            </p>
          </motion.div>
        </div>
      </section>

      <section id="company" className="py-20 md:py-24 bg-[#6d1825] text-white pt-24">
        <div className="max-w-5xl mx-auto px-4 md:px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 md:mb-6">
              Let’s build the next layer of connectivity.
            </h2>
            <p className="text-[#e2b66a] text-lg md:text-xl mb-10 md:mb-12">
              Calling universities, ISPs, satellite providers, investors, and strategic partners.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a href="mailto:connectly.hq@outlook.com" className="bg-white text-[#6d1825] px-10 py-4 rounded-sm font-bold hover:bg-gray-100 transition-colors text-center">
                Partner With Us
              </a>
              <a href="mailto:connectly.hq@outlook.com" className="border border-white/30 text-white px-10 py-4 rounded-sm font-bold hover:bg-white/10 transition-colors text-center">
                Talk to Our Team
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-12 md:py-16 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-12">
          <div className="col-span-2">
            <span className="text-xl md:text-2xl font-bold text-white tracking-tighter mb-4 block">CONNECTLY</span>
            <p className="text-xs md:text-sm leading-relaxed max-w-sm mb-6">
              Connectly builds and manages reliable internet connectivity infrastructure for places that need better access.
            </p>
            <p className="text-xs text-gray-500">
              CONNECTLY TECHNOLOGIES LTD <br/>
              RC 9843504 <br/>
              Abuja, Nigeria
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Platform</h4>
            <ul className="space-y-2 text-xs md:text-sm">
              <li><Link href="#solution" className="hover:text-white transition-colors">The Solution</Link></li>
              <li><Link href="#how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="#markets" className="hover:text-white transition-colors">Markets & Environments</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Company</h4>
            <ul className="space-y-2 text-xs md:text-sm">
              <li><a href="mailto:connectly.hq@outlook.com" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="mailto:connectly.hq@outlook.com" className="hover:text-white transition-colors">Partnerships</a></li>
              <li><a href="mailto:connectly.hq@outlook.com" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 mt-12 md:mt-16 pt-8 border-t border-gray-800 text-xs flex justify-between">
          <span>&copy; {new Date().getFullYear()} Connectly Technologies Ltd. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}