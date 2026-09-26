'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlanForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    priceNaira: '',
    durationValue: '',
    durationUnit: 'hours',
    downloadMbps: '7',
    uploadMbps: '3'
  });

  const BRAND = {
    burgundy: '#6d1825',
    sand: '#cfa253'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Payload mapped precisely to the Supabase schema
    const payload = {
      name: formData.name,
      price_kobo: Number(formData.priceNaira) * 100,
      duration_seconds: formData.durationUnit === 'hours' 
        ? Number(formData.durationValue) * 60 * 60 
        : Number(formData.durationValue) * 60 * 60 * 24, 
      download_speed: Number(formData.downloadMbps) * 1024,
      upload_speed: Number(formData.uploadMbps) * 1024,
    };

    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create plan');
      }

      setFormData({ ...formData, name: '', priceNaira: '', durationValue: '' });
      
      // Redirect back to the main plans list and refresh the data
      router.push('/admin/plans');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <h2 className="font-semibold text-gray-900 mb-2 border-b pb-2">Create New Plan</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
        <input 
          type="text" 
          required 
          placeholder="e.g., 7 Days Unlimited" 
          className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]"
          value={formData.name} 
          onChange={e => setFormData({...formData, name: e.target.value})} 
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Price (₦)</label>
        <input 
          type="number" 
          required 
          min="1" 
          placeholder="500" 
          className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]"
          value={formData.priceNaira} 
          onChange={e => setFormData({...formData, priceNaira: e.target.value})} 
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
          <input 
            type="number" 
            required 
            min="1" 
            placeholder="24" 
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]"
            value={formData.durationValue} 
            onChange={e => setFormData({...formData, durationValue: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <select 
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825] bg-white"
            value={formData.durationUnit} 
            onChange={e => setFormData({...formData, durationUnit: e.target.value})}
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">DL (Mbps)</label>
          <input 
            type="number" 
            required 
            min="1" 
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]"
            value={formData.downloadMbps} 
            onChange={e => setFormData({...formData, downloadMbps: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">UL (Mbps)</label>
          <input 
            type="number" 
            required 
            min="1" 
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]"
            value={formData.uploadMbps} 
            onChange={e => setFormData({...formData, uploadMbps: e.target.value})} 
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button 
        type="submit" 
        disabled={loading} 
        className="w-full rounded-lg py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50 shadow-sm"
        style={{ backgroundColor: BRAND.burgundy }}
      >
        {loading ? 'Saving Plan...' : 'Save Plan'}
      </button>
    </form>
  );
}