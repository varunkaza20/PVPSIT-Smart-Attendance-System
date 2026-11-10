/**
 * Demo data for testing the Regular Attendance flow.
 *
 *   node src/scripts/demoSetup.js            -> DRY RUN: shows what would be created, changes nothing
 *   node src/scripts/demoSetup.js --apply    -> creates the demo data
 *   node src/scripts/demoSetup.js --remove   -> deletes everything this script created
 *
 * Creates:
 *   1. A weekly timetable (Mon-Sat) for IV Year, Semester 1, Section S2, taught by FAC001,
 *      PLUS a "test slot" for TODAY starting now (sessions auto-end at the slot's end time).
 *   2. 23501A0569 on the Block List.
 *   3. 23501A0577 as a DEFAULTER: a few COMPLETED demo sessions (codes DEMO-DEF-xx) containing
 *      only that student, enough to push their overall attendance below the threshold.
 *
 * Everything created is recorded in backend/backups/demo-data.json so --remove can undo it.
 * Existing timetables, students and real attendance are never modified.
 */
const path = require('path');
const fs = require('fs');

const BACKUP_FILE = path.join(__dirname, '../../backups/demo-data.json');
const TARGET = { year: 4, semester: 1, section: 'S2', department: 'CSE' };
const BLOCK_ROLL = '23501A0569';
const DEFAULTER_ROLL = '23501A0577';
const FACULTY_ID = 'FAC001';

const SUBJECTS = {
  CNS: { subjectCode: '19CS3701', subjectName: 'Cryptography & Network Security', shortName: 'CNS', isLaboratory: false, credits: 3 },
  DS: { subjectCode: '19CS3702', subjectName: 'Data Science', shortName: 'DS', isLaboratory: false, credits: 3 },
  LAB: { subjectCode: '19CS3751', subjectName: 'CNS Laboratory', shortName: 'CNS Lab', isLaboratory: true, credits: 1.5 }
};
const LAB = { laboratoryCode: 'CSE-LAB-102', laboratoryName: 'Networks Lab', building: 'Main Block', floor: 'Second Floor', capacity: 60 };

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const localDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const academicYear = (d) => (d.getMonth() >= 5 ? `${d.getFullYear()}-${d.getFullYear() + 1}` : `${d.getFullYear() - 1}-${d.getFullYear()}`);

async function run(db, { apply = false, remove = false, now = new Date(), log = console.log } = {}) {
  const col = (n) => db.collection(n);
  const stamp = { createdAt: now, updatedAt: now, __v: 0 };

  // ---------- REMOVE ----------
  const readBackup = () => (fs.existsSync(BACKUP_FILE) ? JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8')) : null);
  const undoPrevious = async (prev) => {
    if (!prev) return;
    const { ObjectId } = require('mongodb');
    const ids = (a) => (a || []).map((s) => new ObjectId(s));
    const t = await col('timetables').deleteMany({ _id: { $in: ids(prev.timetableIds) } });
    const s = await col('attendancesessions').deleteMany({ _id: { $in: ids(prev.sessionIds) } });
    let b = { deletedCount: 0 };
    if (prev.blockCreated) b = await col('blockedstudents').deleteMany({ rollNumber: BLOCK_ROLL });
    log(`  removed: ${t.deletedCount} timetable slots, ${s.deletedCount} demo sessions, ${b.deletedCount} block-list entry`);
  };

  if (remove) {
    const prev = readBackup();
    if (!prev) { log('Nothing to remove (no backend/backups/demo-data.json).'); return { removed: false }; }
    await undoPrevious(prev);
    fs.writeFileSync(BACKUP_FILE, JSON.stringify({ removedAt: now.toISOString() }, null, 2));
    log('Demo data removed. (Subjects/laboratory created for the demo, if any, were kept.)');
    return { removed: true };
  }

  log(apply ? '*** APPLY MODE ***' : '--- DRY RUN (nothing will be changed) ---');

  // ---------- Checks ----------
  const faculty = await col('users').findOne({ employeeId: FACULTY_ID });
  if (!faculty) throw new Error(`Faculty ${FACULTY_ID} not found. Run resetUsers.js --apply first.`);

  const roster = await col('students').find({ year: TARGET.year, section: TARGET.section, isActive: true }).toArray();
  log(`Students in IV Year / ${TARGET.section}: ${roster.length}`);
  if (roster.length === 0) {
    const secs = await col('students').distinct('section', { year: TARGET.year });
    throw new Error(`No active IV Year students in section "${TARGET.section}". Sections that exist for year 4: ${secs.join(', ') || 'none'}.`);
  }
  const defaulter = roster.find((s) => s.rollNumber.toUpperCase() === DEFAULTER_ROLL);
  const blocked = roster.find((s) => s.rollNumber.toUpperCase() === BLOCK_ROLL);
  log(`  ${DEFAULTER_ROLL} in roster: ${defaulter ? 'yes (' + (defaulter.fullName || defaulter.firstName) + ')' : 'NO'}`);
  log(`  ${BLOCK_ROLL} in roster: ${blocked ? 'yes (' + (blocked.fullName || blocked.firstName) + ')' : 'no (will still be blocked)'}`);
  if (!defaulter) throw new Error(`${DEFAULTER_ROLL} is not an active IV Year ${TARGET.section} student, so it cannot be made a defaulter.`);

  const settings = await col('settings').findOne({});
  const threshold = (settings && settings.attendanceThreshold) || 75;

  // ---------- Plan: defaulter sessions ----------
  const existing = await col('attendancesessions').aggregate([
    { $match: { sessionStatus: 'COMPLETED', sessionCode: { $not: /^DEMO-DEF-/ } } }, { $unwind: '$attendance' }, { $match: { 'attendance.rollNumber': DEFAULTER_ROLL } },
    { $group: { _id: null, classes: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$attendance.finalDecision', '$attendance.status'] }, 'PRESENT'] }, 1, 0] } } } }
  ]).toArray();
  const had = existing[0] || { classes: 0, present: 0 };
  let demoPresent = 0, demoAbsent;
  if (had.classes === 0) { demoPresent = 2; demoAbsent = 6; }
  else {
    const goal = Math.max(threshold - 10, 5) / 100; // aim 10 points under the threshold
    demoAbsent = Math.max(6, Math.ceil(had.present / goal - had.classes));
  }
  if (demoAbsent > 150) throw new Error(`${DEFAULTER_ROLL} already has ${had.present}/${had.classes} real classes; making them a defaulter would need ${demoAbsent} fake sessions. Aborting.`);
  const total = had.classes + demoPresent + demoAbsent;
  const pct = Math.round(((had.present + demoPresent) / total) * 1000) / 10;
  log(`Defaulter plan: ${DEFAULTER_ROLL} real record ${had.present}/${had.classes}; adding ${demoPresent + demoAbsent} demo sessions (${demoPresent} present) -> ${pct}% (threshold ${threshold}%)`);

  // ---------- Plan: timetable ----------
  const today = now.getDay() === 0 ? 1 : now.getDay();
  const weekly = [];
  for (let day = 1; day <= 6; day++) {
    weekly.push({ day, subj: 'CNS', start: '09:00', end: '09:50', duration: 50 });
    weekly.push({ day, subj: 'DS', start: '10:00', end: '10:50', duration: 50 });
    weekly.push({ day, subj: 'CNS', start: '11:00', end: '11:50', duration: 50 });
    if (day === 2 || day === 5) weekly.push({ day, subj: 'LAB', start: '14:00', end: '16:50', duration: 170 });
  }
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 0, 0);
  const slotEnd = new Date(Math.min(now.getTime() + 120 * 60000, endOfDay.getTime()));
  const testDuration = Math.floor((slotEnd - now) / 60000);
  const testSlot = { day: today, subj: 'CNS', start: hhmm(now), end: hhmm(slotEnd), duration: testDuration, isTest: true };
  log(`Timetable plan: ${weekly.length} weekly slots (Mon-Sat) + test slot today ${testSlot.start}-${testSlot.end} (${testDuration} min)`);
  if (testDuration < 20) log('  WARNING: very little time left today, the test slot will end almost immediately. Re-run tomorrow, or earlier in the day.');
  const alreadyThere = await col('timetables').countDocuments({ year: TARGET.year, section: TARGET.section, isActive: true });
  if (alreadyThere) log(`  note: ${alreadyThere} active timetable slot(s) already exist for IV ${TARGET.section}; demo slots are added next to them.`);
  log(`Block list plan: ${BLOCK_ROLL}`);

  if (!apply) { log('\nDry run only. Run again with --apply to create this.'); return { applied: false, plan: { weekly, testSlot, demoPresent, demoAbsent, pct } }; }

  // ---------- Apply ----------
  const prevRun = readBackup(); // re-runs replace the previous demo data
  await undoPrevious(prevRun && prevRun.timetableIds ? prevRun : null);
  const ensure = async (coll, key, doc) => {
    const found = await col(coll).findOne({ [key]: doc[key] });
    if (found) return found;
    const res = await col(coll).insertOne({ ...doc, isActive: true, ...stamp });
    return { _id: res.insertedId, ...doc };
  };
  const subj = {};
  for (const k of Object.keys(SUBJECTS)) subj[k] = await ensure('subjects', 'subjectCode', { ...SUBJECTS[k], year: TARGET.year, semester: TARGET.semester, department: TARGET.department });
  const lab = await ensure('laboratories', 'laboratoryCode', LAB);

  const ay = academicYear(now);
  const slotDocs = [...weekly, testSlot].map((s) => ({
    academicYear: ay, year: TARGET.year, semester: TARGET.semester, section: TARGET.section,
    facultyId: faculty._id, subjectId: subj[s.subj]._id, ...(s.subj === 'LAB' ? { laboratoryId: lab._id } : {}),
    dayOfWeek: s.day, startTime: s.start, endTime: s.end, duration: s.duration, isActive: true, ...stamp
  }));
  const tRes = await col('timetables').insertMany(slotDocs);

  const sessionDocs = [];
  const name = defaulter.fullName || `${defaulter.firstName} ${defaulter.lastName}`.trim();
  for (let i = 0; i < demoPresent + demoAbsent; i++) {
    const present = i < demoPresent;
    const start = new Date(now); start.setDate(start.getDate() - (i + 1)); start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 50 * 60000);
    sessionDocs.push({
      sessionCode: `DEMO-DEF-${String(i + 1).padStart(3, '0')}`, sessionType: 'REGULAR', facultyId: faculty._id, subjectId: subj.CNS._id,
      academicYear: academicYear(start), year: TARGET.year, semester: TARGET.semester, section: TARGET.section,
      sessionDate: new Date(localDateStr(start)), totalStudents: 1, startTime: start, endTime: end, sessionStatus: 'COMPLETED',
      attendance: [{ studentId: defaulter._id, rollNumber: DEFAULTER_ROLL, studentName: name, status: present ? 'PRESENT' : 'ABSENT',
        scans: present ? [{ action: 'IN', timestamp: start }] : [], totalAwayMinutes: 0, finalDecision: present ? 'PRESENT' : 'ABSENT' }],
      editHistory: [], ...stamp
    });
  }
  const sRes = await col('attendancesessions').insertMany(sessionDocs);

  let blockCreated = false;
  if (!(await col('blockedstudents').findOne({ rollNumber: BLOCK_ROLL }))) {
    await col('blockedstudents').insertOne({ rollNumber: BLOCK_ROLL, reason: 'Demo: block list test', ...stamp });
    blockCreated = true;
  }

  fs.mkdirSync(path.dirname(BACKUP_FILE), { recursive: true });
  fs.writeFileSync(BACKUP_FILE, JSON.stringify({
    createdAt: now.toISOString(),
    timetableIds: Object.values(tRes.insertedIds).map(String),
    sessionIds: Object.values(sRes.insertedIds).map(String),
    blockCreated
  }, null, 2));

  log(`\nDone: ${slotDocs.length} timetable slots, ${sessionDocs.length} demo sessions, block list ${blockCreated ? 'entry added' : 'already had ' + BLOCK_ROLL}.`);
  log(`Test slot today: ${testSlot.start}-${testSlot.end}. Open Regular Attendance, pick the CNS slot for IV / ${TARGET.section}, and start.`);
  log('Undo anytime with: node src/scripts/demoSetup.js --remove');
  return { applied: true };
}

module.exports = { run };

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  const mongoose = require('mongoose');
  (async () => {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pvpsit-attendance';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log('Database:', mongoose.connection.db.databaseName);
    try {
      await run(mongoose.connection.db, { apply: process.argv.includes('--apply'), remove: process.argv.includes('--remove') });
    } finally { await mongoose.disconnect(); }
  })().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
}
