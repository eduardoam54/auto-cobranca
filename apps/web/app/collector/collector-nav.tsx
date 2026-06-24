'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function CollectorNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-md">
        <NavItem
          href="/collector/tasks"
          label="Tarefas"
          active={pathname.startsWith('/collector/tasks')}
          icon={<IconTasks />}
        />
        <NavItem
          href="/collector/progress"
          label="Progresso"
          active={pathname.startsWith('/collector/progress')}
          icon={<IconProgress />}
        />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-semibold transition-colors ${
        active ? 'text-brand' : 'text-muted'
      }`}
    >
      <span className={`flex h-6 w-6 items-center justify-center ${active ? 'text-brand' : 'text-muted'}`}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

function IconTasks() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconProgress() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
