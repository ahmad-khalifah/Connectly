'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export default function DeletePlanButton({ planId }: { planId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || 'Failed to delete plan.');
      } else {
        router.refresh();
      }
    } catch (err) {
      alert('Network error while deleting.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
      title="Delete Plan"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}