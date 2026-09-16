'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Hash,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

type Tab = 'student' | 'admin';
type StudentMode = 'signin' | 'register';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const adminRedirect = searchParams.get('redirect') || '/admin';

  const [tab, setTab] = useState<Tab>('student');
  const [mode, setMode] = useState<StudentMode>('signin');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [teamNumber, setTeamNumber] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const [teams, setTeams] = useState<
    { team_number: number; name: string; member_count: number }[]
  >([]);

  // Load teams list once when entering register mode (for the join/create preview).
  useEffect(() => {
    if (tab !== 'student' || mode !== 'register') return;
    fetch('/api/teams')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setTeams(d.teams ?? []))
      .catch(() => null);
  }, [tab, mode]);

  const reset = () => {
    setEmail('');
    setPassword('');
    setName('');
    setTeamNumber('');
    setConfirmPw('');
    setCode('');
    setError('');
  };

  const teamPreview = useMemo(() => {
    const n = Number(teamNumber);
    if (!Number.isInteger(n) || n < 1 || n > 99) return null;
    const existing = teams.find((t) => t.team_number === n);
    if (existing) return { type: 'join' as const, count: existing.member_count };
    return { type: 'create' as const };
  }, [teamNumber, teams]);

  const goAfterStudentAuth = () => {
    startTransition(() => {
      router.replace('/dashboard');
      router.refresh();
    });
  };

  const handleStudentSignIn = async () => {
    setError('');
    if (!email || !password) {
      setError('Enter email and password.');
      return;
    }
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || 'Sign in failed.');
      return;
    }
    goAfterStudentAuth();
  };

  const handleStudentRegister = async () => {
    setError('');
    if (!name.trim()) return setError('Please enter your name.');
    if (!email.toLowerCase().endsWith('@northeastern.edu')) {
      return setError('Use your Northeastern email.');
    }
    const teamNum = Number(teamNumber);
    if (!Number.isInteger(teamNum) || teamNum < 1 || teamNum > 99) {
      return setError('Enter a valid team number (1–99).');
    }
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPw) return setError('Passwords do not match.');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        team_number: teamNum,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || 'Registration failed.');
      return;
    }
    goAfterStudentAuth();
  };

  const handleAdminSignIn = async () => {
    setError('');
    if (!code) return setError('Enter the access code.');
    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || 'Invalid access code.');
      return;
    }
    startTransition(() => {
      router.replace(adminRedirect);
      router.refresh();
    });
  };

  return (
    <div
      style={{
        minHeight: '90vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{ maxWidth: 460, width: '100%' }}>
        <div className="serif" style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>
          Team Member<br />
          <em style={{ color: 'var(--accent)' }}>Assessment.</em>
        </div>
        <p
          style={{
            fontSize: 15,
            color: 'var(--ink-2)',
            marginBottom: 28,
            maxWidth: 380,
          }}
        >
          Anonymous peer evaluation for the EMGT 6600 semester project. Sign in or
          register with your Northeastern email.
        </p>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
          <button
            type="button"
            className={`tab-button ${tab === 'student' ? 'active' : ''}`}
            onClick={() => {
              setTab('student');
              setMode('signin');
              reset();
            }}
          >
            <GraduationCap
              size={14}
              style={{ verticalAlign: -2, marginRight: 6 }}
            />
            Student
          </button>
          <button
            type="button"
            className={`tab-button ${tab === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setTab('admin');
              reset();
            }}
          >
            <ShieldCheck
              size={14}
              style={{ verticalAlign: -2, marginRight: 6 }}
            />
            Instructor
          </button>
        </div>

        <div
          className="tmcpa-card"
          style={{ borderRadius: '0 0 6px 6px', borderTop: 'none' }}
        >
          {tab === 'student' && (
            <>
              <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    reset();
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: 13,
                    background:
                      mode === 'signin' ? 'var(--paper-2)' : 'transparent',
                    border: '1px solid var(--line-2)',
                    borderRadius: '4px 0 0 4px',
                    borderRight: 'none',
                    cursor: 'pointer',
                    color: mode === 'signin' ? 'var(--ink)' : 'var(--ink-3)',
                    fontWeight: mode === 'signin' ? 600 : 400,
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    reset();
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: 13,
                    background:
                      mode === 'register' ? 'var(--paper-2)' : 'transparent',
                    border: '1px solid var(--line-2)',
                    borderRadius: '0 4px 4px 0',
                    cursor: 'pointer',
                    color: mode === 'register' ? 'var(--ink)' : 'var(--ink-3)',
                    fontWeight: mode === 'register' ? 600 : 400,
                  }}
                >
                  Register
                </button>
              </div>

              {mode === 'register' && (
                <div style={{ marginBottom: 14 }}>
                  <label
                    className="label-tiny"
                    style={{ display: 'block', marginBottom: 6 }}
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="tmcpa-input"
                    placeholder="Your name"
                  />
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label
                  className="label-tiny"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Northeastern Email
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={14}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: 13,
                      color: 'var(--ink-3)',
                    }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@northeastern.edu"
                    className="tmcpa-input"
                    style={{ paddingLeft: 36 }}
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div style={{ marginBottom: 14 }}>
                  <label
                    className="label-tiny"
                    style={{ display: 'block', marginBottom: 6 }}
                  >
                    Team Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Hash
                      size={14}
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: 13,
                        color: 'var(--ink-3)',
                      }}
                    />
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={teamNumber}
                      onChange={(e) => setTeamNumber(e.target.value)}
                      placeholder="Enter your team number"
                      className="tmcpa-input"
                      style={{ paddingLeft: 36 }}
                    />
                  </div>
                  {teamPreview && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color:
                          teamPreview.type === 'create'
                            ? 'var(--accent)'
                            : 'var(--good)',
                      }}
                    >
                      {teamPreview.type === 'create' ? (
                        <>
                          → This will <strong>create Team {teamNumber}</strong>{' '}
                          (you&apos;ll be the first member).
                        </>
                      ) : (
                        <>
                          → Joining <strong>Team {teamNumber}</strong> (currently{' '}
                          {teamPreview.count}{' '}
                          {teamPreview.count === 1 ? 'member' : 'members'}).
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label
                  className="label-tiny"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={14}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: 13,
                      color: 'var(--ink-3)',
                    }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="tmcpa-input"
                    style={{ paddingLeft: 36 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && mode === 'signin') {
                        handleStudentSignIn();
                      }
                    }}
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div style={{ marginBottom: 14 }}>
                  <label
                    className="label-tiny"
                    style={{ display: 'block', marginBottom: 6 }}
                  >
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className="tmcpa-input"
                    placeholder="••••••••"
                  />
                </div>
              )}
            </>
          )}

          {tab === 'admin' && (
            <>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  marginBottom: 18,
                }}
              >
                Enter the instructor access code to open the course dashboard.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label
                  className="label-tiny"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Access Code
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={14}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: 13,
                      color: 'var(--ink-3)',
                    }}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, ''))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAdminSignIn();
                    }}
                    placeholder="• • • •"
                    className="tmcpa-input mono"
                    style={{
                      paddingLeft: 36,
                      fontSize: 18,
                      letterSpacing: '0.3em',
                      textAlign: 'center',
                      fontWeight: 600,
                    }}
                    autoFocus
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(140,45,45,0.08)',
                border: '1px solid var(--accent)',
                borderRadius: 4,
                color: 'var(--accent)',
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              <AlertCircle
                size={12}
                style={{
                  display: 'inline',
                  marginRight: 6,
                  verticalAlign: -1,
                }}
              />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={
              tab === 'admin'
                ? handleAdminSignIn
                : mode === 'signin'
                  ? handleStudentSignIn
                  : handleStudentRegister
            }
            disabled={isPending}
            className="tmcpa-btn"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {tab === 'admin'
              ? isPending
                ? 'Signing in…'
                : 'Enter Dashboard'
              : mode === 'signin'
                ? isPending
                  ? 'Signing in…'
                  : 'Sign In'
                : isPending
                  ? 'Creating account…'
                  : 'Create Account'}{' '}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
