'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowRight, Globe, Building2, School, Stethoscope, 
  Briefcase, Home, Tent, MapPin, Zap, Wifi, ShieldCheck, 
  CreditCard, Smartphone, Signal, Users 
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
            <Link href="#services" className="hover:text-[#cfa253] transition-colors">Services</Link>
            <Link href="#how-it-works" className="hover:text-[#cfa253] transition-colors">How It Works</Link>
            <Link href="#locations" className="hover:text-[#cfa253] transition-colors">Locations</Link>
            <Link href="#company" className="hover:text-[#cfa253] transition-colors">Company</Link>
          </div>
          <a href="/login" className="bg-[#6d1825] text-white px-4 py-2 md:px-6 md:py-2.5 rounded-sm text-sm font-bold hover:bg-[#56131d] transition-colors">
            Get Connected
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
              Seamless internet access, wherever you are.
            </h1>
            <p className="text-base md:text-xl text-gray-300 leading-relaxed mb-10 max-w-2xl">
              Connectly provides high-speed Starlink-powered Wi-Fi hotspots and instant mobile data bundles for MTN and Airtel—all through one convenient digital platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="/login" className="bg-[#cfa253] text-gray-900 px-8 py-4 rounded-sm font-bold hover:bg-[#b88c42] transition-colors flex items-center justify-center gap-2 text-center">
                Buy Data / Wi-Fi <ArrowRight size={18} />
              </a>
              <Link href="#services" className="border border-gray-400 text-white px-8 py-4 rounded-sm font-bold hover:bg-white/10 transition-colors text-center">
                Explore Our Services
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
                Connectivity shouldn't be complicated.
              </h2>
              <p className="text-gray-600 text-base md:text-lg leading-relaxed mb-6">
                Whether you need a quick data top-up on the go, or ultra-fast broadband to work and study on campus, accessing reliable internet in Nigeria often involves juggling multiple apps, physical scratch cards, or enduring slow network speeds.
              </p>
              <p className="text-gray-600 text-base md:text-lg leading-relaxed">
                Connectly simplifies this. We combine the reliability of major mobile networks with the raw speed of satellite internet into a single, easy-to-use digital portal.
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
                alt="Students utilizing mobile data and Wi-Fi networks" 
                fill 
                className="object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <section id="services" className="py-16 md:py-24 bg-gray-50 border-y border-gray-200 pt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="max-w-3xl mx-auto mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">One platform. Two ways to connect.</h2>
            <p className="text-gray-600 text-base md:text-lg">
              We offer flexible connectivity options designed for your smartphone, your laptop, and your lifestyle.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white p-8 md:p-12 rounded-sm shadow-sm border border-gray-100 flex flex-col items-center text-center"
            >
              <Smartphone className="text-[#6d1825] mb-6 h-12 w-12" />
              <h3 className="font-bold text-2xl text-gray-900 mb-4">Mobile Data Bundles</h3>
              <p className="text-gray-600 mb-6">
                Instantly purchase and recharge data bundles for MTN and Airtel. Our digital platform processes your transaction and credits your phone line in seconds.
              </p>
              <span className="text-sm font-bold text-[#cfa253] uppercase tracking-wider mt-auto">Available Nationwide</span>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white p-8 md:p-12 rounded-sm shadow-sm border border-gray-100 flex flex-col items-center text-center"
            >
              <Wifi className="text-[#6d1825] mb-6 h-12 w-12" />
              <h3 className="font-bold text-2xl text-gray-900 mb-4">Starlink Wi-Fi Hubs</h3>
              <p className="text-gray-600 mb-6">
                Purchase an access pass to connect to our managed Starlink hotspots deployed across campuses and communities. Experience next-generation broadband speeds.
              </p>
              <span className="text-sm font-bold text-[#cfa253] uppercase tracking-wider mt-auto">Available at Select Locations</span>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gray-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
              <span className="text-[#cfa253] font-bold text-xs md:text-sm tracking-widest uppercase mb-4 block">The Connectly Experience</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                Instant access. Zero friction.
              </h2>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed mb-8">
                Whether you're topping up your phone's data or logging into a Connectly Starlink zone, our platform handles the technical heavy lifting so you can get back to what matters.
              </p>
              
              <div className="space-y-6 border-l border-gray-700 pl-6">
                {[
                  { title: 'Select Service', desc: 'Choose between an MTN/Airtel data bundle or a Wi-Fi Hotspot pass.', color: 'bg-[#cfa253]' },
                  { title: 'Secure Payment', desc: 'Pay instantly via bank transfer, card, or USSD using our secure gateway.', color: 'bg-gray-700' },
                  { title: 'Instant Activation', desc: 'Data is credited to your line, or network access is granted to your device immediately.', color: 'bg-[#6d1825]' },
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

      <section id="locations" className="py-16 md:py-24 bg-white pt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Where you can find us.</h2>
            <p className="text-gray-600 text-base md:text-lg">Mobile data is available everywhere. Our Wi-Fi zones are expanding rapidly.</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 md:gap-x-8 gap-y-8 md:gap-y-12">
            {[
              { icon: Smartphone, title: 'Everywhere (Mobile Data)' },
              { icon: Building2, title: 'University Campuses' },
              { icon: Home, title: 'Residential Estates' },
              { icon: Briefcase, title: 'Co-working Spaces' },
              { icon: MapPin, title: 'Local Communities' },
              { icon: School, title: 'Student Hostels' },
              { icon: Tent, title: 'Event Venues' },
              { icon: Globe, title: 'Rural Hubs' },
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
              By providing reliable mobile data and building physical Starlink hubs, we are ensuring that access to the digital economy is available to everyone, regardless of location.
            </p>
          </motion.div>
        </div>
      </section>

      <section id="company" className="py-20 md:py-24 bg-[#6d1825] text-white pt-24">
        <div className="max-w-5xl mx-auto px-4 md:px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 md:mb-6">
              Ready to get connected?
            </h2>
            <p className="text-[#e2b66a] text-lg md:text-xl mb-10 md:mb-12">
              Buy MTN or Airtel data instantly, or access a Connectly Wi-Fi hotspot near you.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a href="/login" className="bg-white text-[#6d1825] px-10 py-4 rounded-sm font-bold hover:bg-gray-100 transition-colors text-center">
                Access Portal
              </a>
              <a href="mailto:connectly.hq@outlook.com" className="border border-white/30 text-white px-10 py-4 rounded-sm font-bold hover:bg-white/10 transition-colors text-center">
                Request a Hotspot Location
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
              Connectly Technologies Ltd sells mobile data bundles from major Nigerian network providers, including MTN and Airtel, and provides Starlink-based internet connectivity through a convenient digital platform. Customers can purchase mobile data or access Connectly managed Starlink-powered Wi-Fi services.
            </p>
            <p className="text-xs text-gray-500">
              CONNECTLY TECHNOLOGIES LTD <br/>
              RC 9843504 <br/>
              38, Ebitu Ukiwe Street, Jabi <br/>
              Abuja, Nigeria
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Services</h4>
            <ul className="space-y-2 text-xs md:text-sm">
              <li><Link href="#services" className="hover:text-white transition-colors">MTN Data Bundles</Link></li>
              <li><Link href="#services" className="hover:text-white transition-colors">Airtel Data Bundles</Link></li>
              <li><Link href="#services" className="hover:text-white transition-colors">Starlink Wi-Fi Zones</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Company</h4>
            <ul className="space-y-2 text-xs md:text-sm">
              <li><a href="mailto:connectly.hq@outlook.com" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="mailto:connectly.hq@outlook.com" className="hover:text-white transition-colors">Hotspot Partnerships</a></li>
              <li><a href="mailto:connectly.hq@outlook.com" className="hover:text-white transition-colors">Contact Support</a></li>
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