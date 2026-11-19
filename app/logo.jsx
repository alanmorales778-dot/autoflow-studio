import Link from 'next/link';

export function LogoMark({ color = '#FB923C' }) {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h4l3-7 4 14 3-7h4" />
      </svg>
    </span>
  );
}

export default function Logo({ href = '/', mark = '#FB923C' }) {
  return (
    <Link href={href} className="logo" aria-label="AutoFlow, inicio">
      <LogoMark color={mark} />
      Auto<span style={{ marginLeft: -10 }}>Flow</span>
    </Link>
  );
}
