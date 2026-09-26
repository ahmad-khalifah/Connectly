import Link from 'next/link';
import PlanForm from '../../components/plan-form'; // Adjust path based on where you saved PlanForm

export default function NewPlanPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 mt-8">
      <Link href="/admin/plans" className="text-sm font-bold text-slate-500 hover:text-[#6d1825] transition-colors">
        &larr; Back to Plans
      </Link>
      <PlanForm />
    </div>
  );
}