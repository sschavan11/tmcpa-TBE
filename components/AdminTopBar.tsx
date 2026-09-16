import { ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { LogoutButton } from '@/components/LogoutButton';

export function AdminTopBar() {
  return (
    <div
      style={{
        borderBottom: '1px solid var(--line)',
        background: 'var(--paper)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 32px' }}
      >
        <div className="flex items-baseline gap-3">
          <span className="serif" style={{ fontSize: 26, lineHeight: 1 }}>
            TMCPA
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Northeastern · EMGT 6600
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="tmcpa-pill tmcpa-pill-accent">
            <ShieldCheck size={11} /> Instructor
          </span>
          <div className="flex items-center gap-2">
            <Avatar name="Prof Anderson" active />
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 500 }}>Instructor</div>
              <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                Course Instructor
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
