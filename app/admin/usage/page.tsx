import { redirect } from 'next/navigation';

// Data use is not measured yet (nothing records router sessions), so this
// page showed zeros as if they were real. The dashboard says "Not yet measured".
export default function UsagePage() {
  redirect('/admin');
}
