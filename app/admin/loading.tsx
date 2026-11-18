import { Loader2 } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8" role="status" aria-label="Loading">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
    </div>
  );
}
