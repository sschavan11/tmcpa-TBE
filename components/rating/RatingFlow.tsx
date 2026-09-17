'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Slider } from '@/components/ui/Slider';
import type { DeliverableRow, RatingRow, StudentRow } from '@/lib/types';

type Draft = {
  contribution: number;
  professionalism: number;
  contComment: string;
  profComment: string;
  hasContent: boolean;
};

type Props = {
  deliverable: DeliverableRow;
  teamMembers: StudentRow[];
  currentEmail: string;
  initialRatings: RatingRow[];
};

function defaultDraft(): Draft {
  return {
    contribution: 4.5,
    professionalism: 4.5,
    contComment: '',
    profComment: '',
    hasContent: false,
  };
}

export function RatingFlow({
  deliverable,
  teamMembers,
  currentEmail,
  initialRatings,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );

  // ratings keyed by ratee email; seed from server props
  const [ratings, setRatings] = useState<Record<string, Draft>>(() => {
    const seed: Record<string, Draft> = {};
    for (const m of teamMembers) seed[m.email] = defaultDraft();
    for (const r of initialRatings) {
      seed[r.ratee_email] = {
        contribution: r.contribution,
        professionalism: r.professionalism,
        contComment: r.cont_comment ?? '',
        profComment: r.prof_comment ?? '',
        hasContent: true,
      };
    }
    return seed;
  });

  const [idx, setIdx] = useState(0);
  const ratee = teamMembers[idx];
  const draft = ratings[ratee?.email ?? ''] ?? defaultDraft();
  const isMe = ratee?.email === currentEmail;

  // Form values mirror the current ratee's draft. Editing the form mutates them
  // immediately so the UI feels live; the network save happens on Save & Continue
  // (or on sidebar navigation).
  const [cont, setCont] = useState(draft.contribution);
  const [prof, setProf] = useState(draft.professionalism);
  const [contComment, setContComment] = useState(draft.contComment);
  const [profComment, setProfComment] = useState(draft.profComment);

  // When we navigate to a different ratee, re-sync form to that ratee's draft.
  // Use a ref to track which ratee the form is currently bound to so we don't clobber edits.
  const boundRatee = useRef(ratee?.email);
  useEffect(() => {
    if (!ratee) return;
    if (boundRatee.current === ratee.email) return;
    const d = ratings[ratee.email] ?? defaultDraft();
    setCont(d.contribution);
    setProf(d.professionalism);
    setContComment(d.contComment);
    setProfComment(d.profComment);
    boundRatee.current = ratee.email;
  }, [ratee, ratings]);

  // The current ratee counts as "rated" for Submit purposes — Submit calls
  // saveCurrent() before submitting, so the row will exist by the time the
  // POST hits the server. Without this, a user on the last teammate is
  // trapped: they can't trigger a save (Save & Continue has nowhere to go)
  // and Submit refuses to enable.
  const allRated = useMemo(
    () =>
      teamMembers.every(
        (m) => ratings[m.email]?.hasContent || m.email === ratee?.email,
      ),
    [teamMembers, ratings, ratee],
  );

  const saveCurrent = async (): Promise<boolean> => {
    if (!ratee) return false;
    setSaveStatus('saving');
    setSubmitError('');
    const body = {
      deliverable_id: deliverable.id,
      ratee_email: ratee.email,
      contribution: cont,
      professionalism: prof,
      cont_comment: contComment || null,
      prof_comment: profComment || null,
    };
    const res = await fetch('/api/ratings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveStatus('error');
      setSubmitError(data?.error ?? 'Save failed.');
      return false;
    }
    setRatings((prev) => ({
      ...prev,
      [ratee.email]: {
        contribution: cont,
        professionalism: prof,
        contComment,
        profComment,
        hasContent: true,
      },
    }));
    setSaveStatus('saved');
    return true;
  };

  const goTo = async (nextIdx: number) => {
    const ok = await saveCurrent();
    if (!ok) return;
    setIdx(nextIdx);
  };

  const handleSubmit = async () => {
    const ok = await saveCurrent();
    if (!ok) return;
    setSubmitError('');
    const res = await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliverable_id: deliverable.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitError(data?.error ?? 'Submit failed.');
      return;
    }
    startTransition(() => {
      router.replace('/dashboard');
      router.refresh();
    });
  };

  if (!ratee) {
    return (
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '80px 32px',
          textAlign: 'center',
        }}
      >
        <Link
          href="/dashboard"
          className="tmcpa-btn tmcpa-btn-ghost"
          style={{ textDecoration: 'none' }}
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <p style={{ marginTop: 24 }}>No teammates to rate yet.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '40px 32px',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Link
        href="/dashboard"
        className="tmcpa-btn tmcpa-btn-ghost mb-6"
        style={{ textDecoration: 'none' }}
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 32,
          marginTop: 24,
        }}
      >
        {/* Sidebar */}
        <div>
          <div className="label-tiny mb-2">Deliverable #{deliverable.number}</div>
          <h3
            className="serif"
            style={{ fontSize: 20, lineHeight: 1.2, marginBottom: 16 }}
          >
            {deliverable.name}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {teamMembers.map((m, i) => {
              const has = ratings[m.email]?.hasContent;
              const isCurrent = i === idx;
              return (
                <button
                  type="button"
                  key={m.email}
                  onClick={() => goTo(i)}
                  disabled={isPending}
                  className="flex items-center gap-3 text-left"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 4,
                    background: isCurrent ? 'var(--ink)' : 'transparent',
                    color: isCurrent ? 'var(--paper)' : 'var(--ink)',
                    border: 'none',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                  }}
                >
                  <Avatar name={m.name} size={24} active={isCurrent} />
                  <span style={{ flex: 1 }}>
                    {m.name.split(' ')[0]}{' '}
                    {m.email === currentEmail && (
                      <span style={{ opacity: 0.6, fontSize: 11 }}>(self)</span>
                    )}
                  </span>
                  {has ? (
                    <CheckCircle2
                      size={14}
                      style={{ color: isCurrent ? 'var(--paper)' : 'var(--good)' }}
                    />
                  ) : (
                    <Circle size={14} style={{ opacity: 0.4 }} />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allRated || isPending}
            className="tmcpa-btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: 24,
            }}
          >
            {isPending ? 'Submitting…' : 'Submit all ratings'}{' '}
            {!isPending && <ArrowRight size={14} />}
          </button>
          {!allRated && (
            <p
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                marginTop: 8,
                textAlign: 'center',
              }}
            >
              Rate all teammates first
            </p>
          )}
          {submitError && (
            <p
              style={{
                fontSize: 11,
                color: 'var(--bad)',
                marginTop: 8,
                textAlign: 'center',
              }}
            >
              {submitError}
            </p>
          )}
        </div>

        {/* Form */}
        <div className="tmcpa-card" style={{ padding: 36 }}>
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <div className="label-tiny mb-1">
                Rating {idx + 1} of {teamMembers.length}
              </div>
              <h2 className="serif" style={{ fontSize: 36, lineHeight: 1 }}>
                {ratee.name}
                {isMe && (
                  <em style={{ color: 'var(--ink-3)', fontSize: 18 }}>
                    {' '}
                    · self-assessment
                  </em>
                )}
              </h2>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <Slider value={cont} onChange={setCont} label="Contribution" />
            <p
              style={{
                fontSize: 12,
                color: 'var(--ink-3)',
                marginTop: 8,
                marginBottom: 12,
              }}
            >
              <strong style={{ color: 'var(--ink-2)' }}>
                Productivity &amp; Usefulness.
              </strong>{' '}
              Did they contribute productively and usefully to team goals?
            </p>
            <ul
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                marginTop: -4,
                marginBottom: 12,
                paddingLeft: 16,
              }}
            >
              <li>5 – Ideal level of contribution</li>
              <li>4 – A little below ideal</li>
              <li>3 – Below ideal</li>
              <li>2 – Marginal level of contribution</li>
              <li>1 – Minimal level of contribution</li>
              <li>0 – No contribution — free riding</li>
            </ul>
            <label
              className="label-tiny"
              style={{ display: 'block', marginBottom: 6 }}
            >
              What was meritorious / what could improve?
            </label>
            <textarea
              value={contComment}
              onChange={(e) => setContComment(e.target.value)}
              className="tmcpa-textarea"
              placeholder="e.g. Took strong ownership of the risk modeling section."
            />
          </div>

          <div className="tmcpa-divider" />

          <div>
            <Slider value={prof} onChange={setProf} label="Professionalism" />
            <p
              style={{
                fontSize: 12,
                color: 'var(--ink-3)',
                marginTop: 8,
                marginBottom: 12,
              }}
            >
              <strong style={{ color: 'var(--ink-2)' }}>
                Preparation, Respect &amp; Flexibility.
              </strong>{' '}
              Came prepared, respected others, was flexible?
            </p>
            <ul
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                marginTop: -4,
                marginBottom: 12,
                paddingLeft: 16,
              }}
            >
              <li>5 – Ideal level of professionalism</li>
              <li>4 – A little below ideal</li>
              <li>3 – Below ideal</li>
              <li>2 – Marginal level of professionalism</li>
              <li>1 – Minimal level of professionalism</li>
              <li>0 – No professionalism</li>
            </ul>
            <label
              className="label-tiny"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Notes
            </label>
            <textarea
              value={profComment}
              onChange={(e) => setProfComment(e.target.value)}
              className="tmcpa-textarea"
              placeholder="e.g. Consistently prepared and respectful of team input."
            />
          </div>

          <div
            className="flex items-center justify-between"
            style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: '1px solid var(--line)',
            }}
          >
            <button
              type="button"
              onClick={() => goTo(idx - 1)}
              disabled={idx === 0 || isPending}
              className="tmcpa-btn tmcpa-btn-outline"
            >
              <ArrowLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'saved'
                  ? 'Saved'
                  : saveStatus === 'error'
                    ? 'Save failed'
                    : 'Saved automatically'}
            </span>
            <button
              type="button"
              onClick={() => {
                // Last teammate: mirror the top "Submit all ratings" button —
                // saveCurrent + POST submit. Avoids the confusing "Save"
                // label that looked like the final action but only persisted
                // a draft. Earlier teammates: usual save + advance.
                if (idx === teamMembers.length - 1) handleSubmit();
                else goTo(idx + 1);
              }}
              disabled={isPending}
              className="tmcpa-btn"
            >
              {idx === teamMembers.length - 1
                ? isPending
                  ? 'Submitting…'
                  : 'Submit all ratings'
                : 'Save & Continue'}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
