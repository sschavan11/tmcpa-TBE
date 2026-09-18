import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { computeScore } from '@/lib/scoring';
import type {
  DeliverableRow,
  RatingRow,
  StudentRow,
  TeamGradeRow,
  TeamRow,
} from '@/lib/types';

// GET /api/admin/export — downloads a full Excel workbook of the course data.
// Guarded by proxy.ts (/api/admin/:path*), same as the rest of app/api/admin.
export async function GET() {
  const supabase = getSupabaseAdmin();

  const [
    { data: deliverables, error: dErr },
    { data: teams, error: tErr },
    { data: students, error: sErr },
    { data: ratings, error: rErr },
    { data: teamGrades, error: gErr },
  ] = await Promise.all([
    supabase.from('deliverables').select('*').order('number'),
    supabase.from('teams').select('*').order('team_number'),
    supabase.from('students').select('*').order('name'),
    supabase.from('ratings').select('*'),
    supabase.from('team_grades').select('*'),
  ]);

  if (dErr || tErr || sErr || rErr || gErr) {
    return NextResponse.json(
      { error: dErr?.message || tErr?.message || sErr?.message || rErr?.message || gErr?.message },
      { status: 500 },
    );
  }

  const dels = (deliverables ?? []) as DeliverableRow[];
  const teamList = (teams ?? []) as TeamRow[];
  const studentList = (students ?? []) as StudentRow[];
  const ratingList = (ratings ?? []) as RatingRow[];
  const gradeList = (teamGrades ?? []) as TeamGradeRow[];

  const delById = new Map(dels.map((d) => [d.id, d]));
  const teamGradeFor = (deliverableId: number, teamNumber: number) =>
    gradeList.find(
      (g) => g.deliverable_id === deliverableId && g.team_number === teamNumber,
    )?.grade ?? null;

  // Sheet 1: Students / Teams roster
  const rosterSheet = studentList.map((s) => ({
    Name: s.name,
    Email: s.email,
    Team: s.team_number,
  }));

  // Sheet 2: Team grades
  const gradesSheet: Record<string, string | number>[] = [];
  for (const d of dels) {
    for (const t of teamList) {
      const grade = teamGradeFor(d.id, t.team_number);
      gradesSheet.push({
        Deliverable: d.name,
        Team: t.team_number,
        Grade: grade ?? '',
      });
    }
  }

  // Sheet 3: Raw ratings (anonymized rater is still shown here for the
  // instructor's own records — students never see this level of detail).
  const ratingsSheet = ratingList
    .filter((r) => r.submitted)
    .map((r) => {
      const d = delById.get(r.deliverable_id);
      return {
        Deliverable: d?.name ?? r.deliverable_id,
        Rater: r.rater_email,
        Ratee: r.ratee_email,
        Contribution: r.contribution,
        Professionalism: r.professionalism,
        'Contribution Comment': r.cont_comment ?? '',
        'Professionalism Comment': r.prof_comment ?? '',
      };
    });

  // Sheet 4: Computed individual scores per student per deliverable
  const scoresSheet: Record<string, string | number>[] = [];
  for (const d of dels) {
    for (const s of studentList) {
      const received = ratingList
        .filter(
          (r) => r.ratee_email === s.email && r.deliverable_id === d.id && r.submitted,
        )
        .map((r) => ({
          contribution: r.contribution,
          professionalism: r.professionalism,
        }));
      const grade = teamGradeFor(d.id, s.team_number);
      const score = computeScore(received, grade);
      if (!score) continue;
      if ('pending' in score) {
        scoresSheet.push({
          Deliverable: d.name,
          Student: s.name,
          Email: s.email,
          Team: s.team_number,
          'Ratings Received': score.ratingsReceived,
          'Avg Contribution': '',
          'Avg Professionalism': '',
          'Team Grade': '',
          'Individual Score': 'Pending team grade',
        });
      } else {
        scoresSheet.push({
          Deliverable: d.name,
          Student: s.name,
          Email: s.email,
          Team: s.team_number,
          'Ratings Received': score.ratingsReceived,
          'Avg Contribution': Number(score.avgCont.toFixed(2)),
          'Avg Professionalism': Number(score.avgProf.toFixed(2)),
          'Team Grade': score.teamGrade,
          'Individual Score': Number(score.individualScore.toFixed(2)),
        });
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rosterSheet), 'Roster');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gradesSheet), 'Team Grades');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scoresSheet), 'Individual Scores');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ratingsSheet), 'Raw Ratings');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tmcpa-export.xlsx"',
    },
  });
}
