'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';

export default function NewLocationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    building: ''
  });

  const BRAND = {
    burgundy: '#6d1825',
    sand: '#cfa253'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to create location');
      }

      // Redirect back to the locations directory after successful creation
      router.push('/admin/locations');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setFormData({ ...formData, name, slug });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <MapPin className="h-6 w-6 text-[#6d1825]" />
        <h1 className="text-2xl font-bold text-slate-900">Add New Facility</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
          <input 
            type="text" 
            required 
            placeholder="e.g., Silver Hostel Block B" 
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]"
            value={formData.name} 
            onChange={handleNameChange} 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
          <input 
            type="text" 
            required 
            placeholder="silver-hostel-b" 
            className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]"
            value={formData.slug} 
            onChange={e => setFormData({...formData, slug: e.target.value})} 
          />
          <p className="text-xs text-gray-500 mt-1">This forms the QR code link.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Building / Zone</label>
          <input 
            type="text" 
            placeholder="e.g., Block B" 
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]"
            value={formData.building} 
            onChange={e => setFormData({...formData, building: e.target.value})} 
          />
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full rounded-lg py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50 shadow-sm"
          style={{ backgroundColor: BRAND.burgundy }}
        >
          {loading ? 'Saving Location...' : 'Save Location'}
        </button>
      </form>
    </div>
  );
}