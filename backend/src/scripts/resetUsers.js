/**
 * One-off maintenance script: reduce `users` to exactly ADMIN001 + FAC001.
 *
 *   node src/scripts/resetUsers.js            -> DRY RUN (changes nothing, prints plan)
 *   node src/scripts/resetUsers.js --apply    -> performs the changes
 *
 * What it touches:
 *   - users:  keeps/creates ADMIN001 and FAC001 (default passwords, active); deletes all others
 *   - timetables / attendancesessions / customattendancesessions:
 *       ONLY the user-id reference fields (facultyId, editedBy, editHistory[].editedBy) that
 *       point at a deleted user are repointed to FAC001. Nothing else in those documents changes.
 * Untouched: students, subjects, laboratories, settings, attendance records, scans, dates.
 * A JSON backup of the old users collection is written to backend/backups/ before any change.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const APPLY = process.argv.includes('--apply');
// Passwords come from backend/.env (SEED_ADMIN_PASSWORD / SEED_FACULTY_PASSWORD, min 8 chars).
// If unset, a random one is generated and printed once when --apply is used.
const crypto = require('crypto');
const fromEnv = (name) => { const v = process.env[name]; return v && v.length >= 8 ? { value: v, generated: false } : { value: crypto.randomBytes(9).toString('base64url'), generated: true }; };
const ADMIN_PW = fromEnv('SEED_ADMIN_PASSWORD');
const FACULTY_PW = fromEnv('SEED_FACULTY_PASSWORD');
const ADMIN_PASSWORD = ADMIN_PW.value;
const FACULTY_PASSWORD = FACULTY_PW.value;

const KEEP = [
  { employeeId: 'ADMIN001', firstName: 'Varun', lastName: 'K', email: 'admin@pvpsit.ac.in',
    phone: '9876543210', role: 'ADMIN', department: 'CSE', designation: 'System Administrator',
    password: ADMIN_PASSWORD },
  { employeeId: 'FAC001', firstName: 'Ram', lastName: 'Prasad', email: 'ramprasad@pvpsit.ac.in',
    phone: '9876543211', role: 'FACULTY', department: 'CSE', designation: 'Assistant Professor',
    password: FACULTY_PASSWORD },
];

(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pvpsit-attendance';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  const users = db.collection('users');
  console.log(APPLY ? '*** APPLY MODE ***' : '--- DRY RUN (no changes will be made) ---');
  console.log('Database:', db.databaseName);

  const all = await users.find({}).toArray();
  const keepIds = KEEP.map(k => k.employeeId);
  const existing = Object.fromEntries(all.filter(u => keepIds.includes(u.employeeId)).map(u => [u.employeeId, u]));
  const toDelete = all.filter(u => !keepIds.includes(u.employeeId));

  console.log(`\nUsers now: ${all.length}`);
  for (const k of KEEP) console.log(`  keep ${k.employeeId}: ${existing[k.employeeId] ? 'exists (password will be reset)' : 'MISSING -> will be created'}`);
  console.log(`  delete: ${toDelete.length} -> ${toDelete.map(u => `${u.employeeId}(${u.role})`).join(', ') || 'none'}`);

  // Conflicts: email is unique; make sure a user being deleted doesn't matter, but a kept-email clash is checked
  const emailClash = all.filter(u => !keepIds.includes(u.employeeId) && KEEP.some(k => k.email === u.email));
  if (emailClash.length) console.log('  note: emails of deleted users overlap with kept emails (fine, they are deleted first)');

  const deleteIds = toDelete.map(u => u._id);
  const facId = existing['FAC001']?._id; // may be undefined until created
  const refCounts = async () => ({
    timetables: await db.collection('timetables').countDocuments({ facultyId: { $in: deleteIds } }),
    sessions: await db.collection('attendancesessions').countDocuments({ facultyId: { $in: deleteIds } }),
    custom: await db.collection('customattendancesessions').countDocuments({ facultyId: { $in: deleteIds } }),
    sessionEditedBy: await db.collection('attendancesessions').countDocuments({ editedBy: { $in: deleteIds } }),
    editHistoryEntries: (await db.collection('attendancesessions').aggregate([
      { $unwind: '$editHistory' }, { $match: { 'editHistory.editedBy': { $in: deleteIds } } }, { $count: 'n' }]).toArray())[0]?.n || 0,
  });
  const c = await refCounts();
  console.log('\nReferences to deleted users that will be repointed to FAC001:');
  console.log(' ', JSON.stringify(c));
  console.log('Total docs in untouched-by-this-script collections are not modified.');

  if (!APPLY) { console.log('\nDry run complete. Re-run with --apply to execute.'); await mongoose.disconnect(); return; }

  // 1. Backup
  const dir = path.join(__dirname, '../../backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `users-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
  console.log('\nBackup written:', file);

  // 2. Ensure the two kept users
  const now = new Date();
  const ids = {};
  for (const k of KEEP) {
    const hash = await bcrypt.hash(k.password, 10);
    const { password, ...profile } = k;
    const fullName = `${k.firstName} ${k.lastName}`.trim();
    if (existing[k.employeeId]) {
      await users.updateOne({ _id: existing[k.employeeId]._id },
        { $set: { password: hash, isActive: true, role: k.role, updatedAt: now } });
      ids[k.employeeId] = existing[k.employeeId]._id;
    } else {
      // free the email if a to-be-deleted user holds it
      await users.deleteMany({ email: k.email, employeeId: { $ne: k.employeeId } });
      const r = await users.insertOne({ ...profile, fullName, password: hash, isActive: true, createdAt: now, updatedAt: now });
      ids[k.employeeId] = r.insertedId;
    }
  }
  const fac = ids['FAC001'];

  // 3. Repoint user references (only those pointing at users about to be deleted)
  const r1 = await db.collection('timetables').updateMany({ facultyId: { $in: deleteIds } }, { $set: { facultyId: fac } });
  const r2 = await db.collection('attendancesessions').updateMany({ facultyId: { $in: deleteIds } }, { $set: { facultyId: fac } });
  const r3 = await db.collection('customattendancesessions').updateMany({ facultyId: { $in: deleteIds } }, { $set: { facultyId: fac } });
  const r4 = await db.collection('attendancesessions').updateMany({ editedBy: { $in: deleteIds } }, { $set: { editedBy: fac } });
  const r5 = await db.collection('attendancesessions').updateMany({ 'editHistory.editedBy': { $in: deleteIds } },
    { $set: { 'editHistory.$[e].editedBy': fac } }, { arrayFilters: [{ 'e.editedBy': { $in: deleteIds } }] });
  console.log('Repointed -> timetables:', r1.modifiedCount, '| sessions:', r2.modifiedCount, '| custom:', r3.modifiedCount,
    '| editedBy:', r4.modifiedCount, '| editHistory docs:', r5.modifiedCount);

  // 4. Delete the other users
  const del = await users.deleteMany({ _id: { $in: deleteIds } });
  console.log('Deleted users:', del.deletedCount);

  const left = await users.find({}, { projection: { employeeId: 1, role: 1, isActive: 1 } }).toArray();
  console.log('\nUsers now:', left.map(u => `${u.employeeId}(${u.role}, active=${u.isActive})`).join(', '));
  console.log('Login -> ADMIN001 /', ADMIN_PASSWORD, '| FAC001 /', FACULTY_PASSWORD);
  await mongoose.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
