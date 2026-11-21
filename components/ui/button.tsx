import Link from 'next/link';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'indigo';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong',
  indigo: 'bg-indigo text-white hover:bg-indigo-strong',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-canvas',
  quiet: 'text-brand hover:bg-brand-soft',
  danger: 'border border-bad/30 bg-surface text-bad hover:bg-bad-soft',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
};

export function buttonClass({ variant = 'primary', size = 'md', full = false, className }: { variant?: Variant; size?: Size; full?: boolean; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], full && 'w-full', className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; full?: boolean };

export function Button({ variant, size, full, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, full, className })} {...rest} />;
}

type LinkProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size; full?: boolean };

export function ButtonLink({ variant, size, full, className, ...rest }: LinkProps) {
  return <Link prefetch={false} className={buttonClass({ variant, size, full, className })} {...rest} />;
}
