import Link from 'next/link';

export function LogoMark({ color = '#FB923C' }) {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14c2-6 6-9 8-9s6 3 8 9" />
        <path d="M3 18h18" />
        <path d="M12 5V3" />
      </svg>
    </span>
  );
}

export default function Logo({ href = '/', mark = '#FB923C' }) {
  return (
    <Link href={href} className="logo" aria-label="AutoFlow Cocina, inicio">
      <LogoMark color={mark} />
      AutoFlow <span>Cocina</span>
    </Link>
  );
}
