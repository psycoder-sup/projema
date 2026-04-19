'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  label: string;
}

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname() ?? '';
  const isActive =
    href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center border-r-2 border-ink px-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors',
        'hover:bg-acid hover:text-ink',
        isActive && 'bg-ink text-paper hover:bg-ink hover:text-paper',
      )}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute -bottom-[2px] left-0 right-0 h-[4px] bg-acid"
        />
      )}
      {label}
    </Link>
  );
}
