import Link from 'next/link';
import {
  ChevronRight,
  Clock,
  Inbox,
  Plus,
  Users,
} from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { StatCard } from '@/components/ui/StatCard';
import { DeliverableSelect } from '@/components/admin/DeliverableSelect';
import { computeScore, type Score } from '@/lib/scoring';
import type {
  DeliverableRow,
  RatingRow,
  StudentRow,
  TeamGradeRow,
  TeamRow,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ deliverable?: string }>;
};

export default async function AdminOverview({ searchParams }: Props) {
  const { deliverable: deliverableParam } = await searchParams;
  const supabase = getSupabaseAdmin();

  const [
    { data: deliverables, error: dErr },
    { data: teams, error: tErr },
    { data: students, error: sErr },
  ] = await Promise.all([
    supabase.from('deliverables').select('*').order('number'),
    supabase.from('teams').select('*').order('team_number'),
    supabase.from('students').select('*').order('name'),
  ]);

  if (dErr || tErr || sErr) {
    throw new Error(
      `Supabase read failed: ${dErr?.message || tErr?.message || sErr?.message}`,
    );
  }

  const dels = (deliverables ?? []) as DeliverableRow[];
  const teamList = (teams ?? []) as TeamRow[];
  const studentList = (students ?? []) as StudentRow[];

  // Empty state: no deliverables defined yet
  if (dels.length === 0) {
    return (
      <div
        style={{
          maxWidth: 720,
          margin: '80px auto',
          padding: '40px 32px',
          textAlign: 'center',
        }}
      >
        <Inbox size={32} style={{ color: 'var(--ink-3)', margin: '0 auto 16px' }} />
        <h2 className="serif" style={{ fontSize: 36, lineHeight: 1.1 }}>
          No deliverables yet.
        </h2>
        <p style={{ color: 'var(--ink-2)', marginTop: 12, marginBottom: 24 }}>
          Start by adding deliverables in Course Settings. Students join as they
          register with their team number.
        </p>
        <Link
          href="/admin/settings"
          className="tmcpa-btn"
          style={{ textDecoration: 'none' }}
        >
          <Plus size={14} /> Add your first deliverable
        </Link>
      </div>
    );
  }

  // Resolve current deliverable: requested → active → first
  const requestedId = Number(deliverableParam);
  const currentDel =
    dels.find((d) => d.id === requestedId) ??
    dels.find((d) => d.status === 'open') ??
    dels[0];

  // Fetch ratings + team grades for the current deliverable
  const [{ data: ratings, error: rErr }, { data: grades, error: gErr }] =
    await Promise.all([
      supabase
        .from('ratings')
        .select('*')
        .eq('deliverable_id', currentDel.id),
      supabase
        .from('team_grades')
        .select('*')
        .eq('deliverable_id', currentDel.id),
    ]);

  if (rErr || gErr) {
    throw new Error(`Supabase read failed: ${rErr?.message || gErr?.message}`);
  }

  const ratingList = (ratings ?? []) as RatingRow[];
  const gradeList = (grades ?? []) as TeamGradeRow[];

  const teamGradeFor = (teamNum: number) =>
    gradeList.find((g) => g.team_number === teamNum)?.grade ?? null;

  const teamProgress = (teamNum: number) => {
    const memberEmails = studentList
      .filter((s) => s.team_number === teamNum)
      .map((s) => s.email);
    const submitted = new Set(
      ratingList
        .filter((r) => r.submitted && memberEmails.includes(r.rater_email))
        .map((r) => r.rater_email),
    );
    return { submitted: submitted.size, total: memberEmails.length, raters: submitted };
  };

  const studentScore = (email: string, teamNum: number) => {
    const received = ratingList.filter(
      (r) => r.ratee_email === email && r.submitted,
    );
    return computeScore(received, teamGradeFor(teamNum));
  };

  const totalSubmissions = teamList.reduce(
    (sum, t) => sum + teamProgress(t.team_number).submitted,
    0,
  );
  const teamsComplete = teamList.filter((t) => {
    const p = teamProgress(t.team_number);
    return p.submitted === p.total && p.total > 0;
  }).length;
  const allValidScores = studentList
    .map((s) => studentScore(s.email, s.team_number))
    .filter((sc): sc is Score => !!sc && !('pending' in sc));
  const avgIndividual = allValidScores.length
    ? (
        allValidScores.reduce((sum, sc) => sum + sc.individualScore, 0) /
        allValidScores.length
      ).toFixed(1)
    : '—';

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px' }}>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.1 }}>
          Course <em style={{ color: 'var(--accent)' }}>overview.</em>
        </h1>
        <div className="flex items-center gap-3">
          <DeliverableSelect deliverables={dels} selectedId={currentDel.id} />
          
          <a
            href="/api/admin/export"
            className="tmcpa-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontSize: 14,
              border: '1px solid var(--line)',
              borderRadius: 8,
              textDecoration: 'none',
              color: 'var(--ink-1)',
            }}
          >
            Export to Excel
          </a>
        </div>
      </div>
      <p style={{ color: 'var(--ink-2)', marginBottom: 32, fontSize: 15 }}>
        EMGT 6600 · Spring 2026 · {teamList.length}{' '}
        {teamList.length === 1 ? 'team' : 'teams'} · {studentList.length} students
        enrolled · {dels.length} {dels.length === 1 ? 'deliverable' : 'deliverables'}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          label="Active deliverable"
          value={`#${currentDel.number}`}
          sub={currentDel.name}
        />
        <StatCard
          label="Total submissions"
          value={totalSubmissions}
          sub={`of ${studentList.length} expected`}
        />
        <StatCard
          label="Teams complete"
          value={`${teamsComplete}/${teamList.length}`}
          sub="all ratings submitted"
        />
        <StatCard label="Avg individual" value={avgIndividual} sub="across all students" />
      </div>

      {teamList.length === 0 ? (
        <div
          className="tmcpa-card"
          style={{ padding: '60px 32px', textAlign: 'center' }}
        >
          <Inbox size={32} style={{ color: 'var(--ink-3)', margin: '0 auto 16px' }} />
          <h2 className="serif" style={{ fontSize: 28, lineHeight: 1.1 }}>
            No teams yet.
          </h2>
          <p style={{ color: 'var(--ink-2)', marginTop: 12, maxWidth: 480, margin: '12px auto 0' }}>
            Teams appear here as students register. Each student picks a team number on
            registration — the team is created on the first registration, and subsequent
            students join.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
          }}
        >
          {teamList.map((team) => {
            const progress = teamProgress(team.team_number);
            const complete = progress.submitted === progress.total && progress.total > 0;
            const teamGrade = teamGradeFor(team.team_number);
            const members = studentList.filter(
              (s) => s.team_number === team.team_number,
            );
            const scores = members
              .map((m) => studentScore(m.email, m.team_number))
              .filter((sc): sc is Score => !!sc && !('pending' in sc));
            const avgScore =
              scores.length > 0
                ? scores.reduce((sum, sc) => sum + sc.individualScore, 0) /
                  scores.length
                : null;
            const submittedPct = progress.total
              ? (progress.submitted / progress.total) * 100
              : 0;

            return (
              <Link
                key={team.team_number}
                href={`/admin/teams/${team.team_number}?deliverable=${currentDel.id}`}
                className="tmcpa-card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="serif" style={{ fontSize: 28 }}>
                    {team.name}
                  </h3>
                  {complete ? (
                    <span className="tmcpa-pill tmcpa-pill-good">Complete</span>
                  ) : (
                    <span className="tmcpa-pill tmcpa-pill-warn">
                      <Clock size={11} /> {progress.submitted}/{progress.total}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>
                  <Users
                    size={11}
                    style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }}
                  />
                  {members.length} {members.length === 1 ? 'member' : 'members'} · Team
                  grade{' '}
                  {teamGrade != null ? (
                    <span className="mono tnum">{teamGrade}</span>
                  ) : (
                    <span style={{ color: 'var(--warn)' }}>not set</span>
                  )}
                </p>
                <div
                  style={{
                    height: 6,
                    background: 'var(--paper-3)',
                    borderRadius: 999,
                    overflow: 'hidden',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${submittedPct}%`,
                      background: complete ? 'var(--good)' : 'var(--accent)',
                      transition: 'width 0.6s',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    marginBottom: 14,
                  }}
                >
                  {members.map((m) => {
                    const submitted = progress.raters.has(m.email);
                    return (
                      <div
                        key={m.email}
                        title={`${m.name} — ${submitted ? 'submitted' : 'pending'}`}
                        style={{
                          padding: '3px 8px',
                          fontSize: 10,
                          borderRadius: 3,
                          background: submitted
                            ? 'rgba(63,107,71,0.12)'
                            : 'var(--paper-2)',
                          color: submitted ? 'var(--good)' : 'var(--ink-3)',
                          border: `1px solid ${submitted ? 'var(--good)' : 'var(--line-2)'}`,
                          fontWeight: 500,
                        }}
                      >
                        {m.name.split(' ')[0]}
                      </div>
                    );
                  })}
                </div>
                <div
                  className="flex items-center"
                  style={{
                    paddingTop: 12,
                    borderTop: '1px solid var(--line)',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    {avgScore != null && complete ? (
                      <>
                        Avg score:{' '}
                        <span className="mono tnum" style={{ fontWeight: 600 }}>
                          {avgScore.toFixed(1)}
                        </span>
                      </>
                    ) : (
                      'View team details'
                    )}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--ink-3)' }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
