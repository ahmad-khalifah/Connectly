import Link from 'next/link';
import { Wifi } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/connect" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Wifi className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Get Connected
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link 
            href="/recover" 
            className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            Restore Access
          </Link>
        </nav>
      </div>
    </header>
  );
}