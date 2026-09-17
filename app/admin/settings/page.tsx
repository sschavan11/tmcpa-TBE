import { Inbox } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { AddDeliverableButton } from '@/components/admin/AddDeliverableButton';
import { DeliverableRow } from '@/components/admin/DeliverableRow';
import { ResetSemesterCard } from '@/components/admin/ResetSemesterCard';
import type {
  DeliverableRow as DeliverableRowType,
  StudentRow,
  TeamGradeRow,
  TeamRow,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  const supabase = getSupabaseAdmin();
  const [
    { data: deliverables, error: dErr },
    { data: teams, error: tErr },
    { data: students, error: sErr },
    { data: grades, error: gErr },
  ] = await Promise.all([
    supabase.from('deliverables').select('*').order('number'),
    supabase.from('teams').select('*').order('team_number'),
    supabase.from('students').select('email,team_number'),
    supabase.from('team_grades').select('*'),
  ]);
  if (dErr || tErr || sErr || gErr) {
    throw new Error(
      `Supabase read failed: ${
        dErr?.message || tErr?.message || sErr?.message || gErr?.message
      }`,
    );
  }

  const dels = (deliverables ?? []) as DeliverableRowType[];
  const teamList = (teams ?? []) as TeamRow[];
  const studentList = (students ?? []) as Pick<StudentRow, 'email' | 'team_number'>[];
  const gradeList = (grades ?? []) as TeamGradeRow[];

  // team_number → member count
  const memberCounts = new Map<number, number>();
  for (const s of studentList) {
    memberCounts.set(s.team_number, (memberCounts.get(s.team_number) ?? 0) + 1);
  }

  // deliverable_id → (team_number → grade)
  const gradesByDeliverable = new Map<number, Map<number, number | null>>();
  for (const g of gradeList) {
    if (!gradesByDeliverable.has(g.deliverable_id)) {
      gradesByDeliverable.set(g.deliverable_id, new Map());
    }
    gradesByDeliverable.get(g.deliverable_id)!.set(g.team_number, g.grade);
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px' }}>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.1 }}>
          Course <em style={{ color: 'var(--accent)' }}>settings.</em>
        </h1>
        <AddDeliverableButton />
      </div>
      <p
        style={{
          color: 'var(--ink-2)',
          marginBottom: 32,
          fontSize: 15,
          maxWidth: 720,
        }}
      >
        Configure the {dels.length}{' '}
        {dels.length === 1 ? 'deliverable' : 'deliverables'} for this course.
        Changes apply to all students immediately.
      </p>

      {dels.length === 0 ? (
        <div
          className="tmcpa-card"
          style={{ padding: '60px 32px', textAlign: 'center', marginBottom: 48 }}
        >
          <Inbox size={32} style={{ color: 'var(--ink-3)', margin: '0 auto 16px' }} />
          <h2 className="serif" style={{ fontSize: 28, lineHeight: 1.1 }}>
            No deliverables yet.
          </h2>
          <p
            style={{
              color: 'var(--ink-2)',
              marginTop: 12,
              maxWidth: 480,
              margin: '12px auto 0',
            }}
          >
            Click <strong>Add deliverable</strong> above to create the first one.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginBottom: 48,
          }}
        >
          {dels.map((d) => (
            <DeliverableRow
              key={d.id}
              deliverable={d}
              teams={teamList}
              grades={gradesByDeliverable.get(d.id) ?? new Map()}
              memberCounts={memberCounts}
              canDelete={true}
            />
          ))}
        </div>
      )}

      <ResetSemesterCard />
    </div>
  );
}
