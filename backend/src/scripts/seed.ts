import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import path from 'path';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User } from '../models/User';
import { Student } from '../models/Student';
import { Subject } from '../models/Subject';
import { Laboratory } from '../models/Laboratory';
import { Timetable } from '../models/Timetable';
import { Settings } from '../models/Settings';

const excelFilePath = path.join(__dirname, '../../../IV_Year_Students_Data.xlsx');

async function seed() {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pvpsit-attendance';
  console.log('Connecting to database:', mongoURI);
  
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB.');

  // 1. Reset Collections
  console.log('Resetting collections...');
  await User.deleteMany({});
  await Student.deleteMany({});
  await Subject.deleteMany({});
  await Laboratory.deleteMany({});
  await Timetable.deleteMany({});
  await Settings.deleteMany({});

  // 2. Seed Global Settings
  console.log('Seeding global settings...');
  const appSettings = new Settings({
    collegeName: 'Prasad V. Potluri Siddhartha Institute of Technology',
    collegeShortName: 'PVPSIT',
    attendanceThreshold: 75,
    timezone: 'Asia/Kolkata',
    sessionTimeout: 50,
    enableScannerSound: false
  });
  await appSettings.save();

  // 3. Seed Users (Admin & Faculty)
  console.log('Seeding users...');
  // Passwords come from backend/.env (SEED_ADMIN_PASSWORD / SEED_FACULTY_PASSWORD). If unset, random ones are generated and printed once.
  const pick = (name: string) => {
    const v = process.env[name];
    if (v && v.length >= 8) return { value: v, generated: false };
    return { value: require('crypto').randomBytes(9).toString('base64url'), generated: true };
  };
  const adminPw = pick('SEED_ADMIN_PASSWORD');
  const facultyPw = pick('SEED_FACULTY_PASSWORD');
  const hashedPasswordAdmin = await bcrypt.hash(adminPw.value, 10);
  const hashedPasswordFaculty = await bcrypt.hash(facultyPw.value, 10);

  const adminUser = new User({
    employeeId: 'ADMIN001',
    firstName: 'Varun',
    lastName: 'K',
    email: 'admin@pvpsit.ac.in',
    phone: '9876543210',
    password: hashedPasswordAdmin,
    role: 'ADMIN',
    department: 'CSE',
    designation: 'System Administrator',
    isActive: true
  });
  await adminUser.save();

  const facultyUser = new User({
    employeeId: 'FAC001',
    firstName: 'Ram',
    lastName: 'Prasad',
    email: 'ramprasad@pvpsit.ac.in',
    phone: '9876543211',
    password: hashedPasswordFaculty,
    role: 'FACULTY',
    department: 'CSE',
    designation: 'Assistant Professor',
    isActive: true
  });
  await facultyUser.save();

  console.log('Seeded users: ADMIN001 and FAC001');
  if (adminPw.generated) console.log(`  ADMIN001 generated password (shown once): ${adminPw.value}`);
  if (facultyPw.generated) console.log(`  FAC001 generated password (shown once): ${facultyPw.value}`);

  // 4. Seed Subjects
  console.log('Seeding subjects...');
  const subCNS = await new Subject({
    subjectCode: '19CS3701',
    subjectName: 'Cryptography & Network Security',
    shortName: 'CNS',
    year: 4,
    semester: 1,
    department: 'CSE',
    isLaboratory: false,
    credits: 3,
    isActive: true
  }).save();

  const subDS = await new Subject({
    subjectCode: '19CS3702',
    subjectName: 'Data Science',
    shortName: 'DS',
    year: 4,
    semester: 1,
    department: 'CSE',
    isLaboratory: false,
    credits: 3,
    isActive: true
  }).save();

  const subCNSLab = await new Subject({
    subjectCode: '19CS3751',
    subjectName: 'CNS Laboratory',
    shortName: 'CNS Lab',
    year: 4,
    semester: 1,
    department: 'CSE',
    isLaboratory: true,
    credits: 1.5,
    isActive: true
  }).save();

  // 5. Seed Laboratories
  console.log('Seeding laboratories...');
  const labProgramming = await new Laboratory({
    laboratoryCode: 'CSE-LAB-101',
    laboratoryName: 'Programming Lab',
    building: 'Main Block',
    floor: 'First Floor',
    capacity: 65,
    isActive: true
  }).save();

  const labNetworks = await new Laboratory({
    laboratoryCode: 'CSE-LAB-102',
    laboratoryName: 'Networks Lab',
    building: 'Main Block',
    floor: 'Second Floor',
    capacity: 60,
    isActive: true
  }).save();

  // 6. Seed Students from Excel
  console.log('Reading students excel from:', excelFilePath);
  let studentCount = 0;
  
  try {
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    console.log(`Found ${rows.length} rows in the spreadsheet.`);

    const studentRecords = [];
    for (const row of rows) {
      // Columns in your sheet might be 'Roll_Number', 'Name', 'Section'
      const rollNumberRaw = row['Roll_Number'] || row['Roll Number'] || row['rollNumber'] || row['RollNo'] || row['ROLL NUMBER'];
      const studentNameRaw = row['Name'] || row['Student Name'] || row['studentName'] || row['STUDENT NAME'];
      const sectionRaw = row['Section'] || row['section'] || row['SECTION'] || 'A';

      if (!rollNumberRaw || !studentNameRaw) continue;

      const rollNumber = String(rollNumberRaw).trim().toUpperCase();
      const studentName = String(studentNameRaw).trim();
      const section = String(sectionRaw).trim().toUpperCase();

      // Split name into first and last
      const nameParts = studentName.split(' ');
      const firstName = nameParts[0] || 'Student';
      const lastName = nameParts.slice(1).join(' ') || 'Name';

      studentRecords.push({
        rollNumber,
        firstName,
        lastName,
        fullName: studentName,
        section,
        year: 4, // 4th Year (IV Year)
        semester: 1, // 1st Sem
        department: 'CSE',
        regulation: 'PVPS19',
        admissionYear: 2022,
        isActive: true
      });
    }

    if (studentRecords.length > 0) {
      await Student.insertMany(studentRecords);
      studentCount = studentRecords.length;
      console.log(`Successfully parsed and imported ${studentCount} students.`);
    } else {
      console.log('No valid student records found in sheet. Importing sample student fallback...');
      await new Student({
        rollNumber: '20501A0501',
        firstName: 'Amit',
        lastName: 'Kumar',
        fullName: 'Amit Kumar',
        section: 'A',
        year: 4,
        semester: 1,
        department: 'CSE',
        regulation: 'PVPS19',
        admissionYear: 2022,
        isActive: true
      }).save();
      studentCount = 1;
    }
  } catch (err) {
    console.error('Error reading excel sheet, importing sample fallbacks:', err);
    // Add 3 sample students to allow testing if sheet parse fails
    await Student.insertMany([
      {
        rollNumber: '20501A0501',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        section: 'A',
        year: 4,
        semester: 1,
        department: 'CSE',
        regulation: 'PVPS19',
        admissionYear: 2022,
        isActive: true
      },
      {
        rollNumber: '20501A0502',
        firstName: 'Jane',
        lastName: 'Smith',
        fullName: 'Jane Smith',
        section: 'A',
        year: 4,
        semester: 1,
        department: 'CSE',
        regulation: 'PVPS19',
        admissionYear: 2022,
        isActive: true
      },
      {
        rollNumber: '20501A0503',
        firstName: 'Bobby',
        lastName: 'Brown',
        fullName: 'Bobby Brown',
        section: 'B',
        year: 4,
        semester: 1,
        department: 'CSE',
        regulation: 'PVPS19',
        admissionYear: 2022,
        isActive: true
      }
    ]);
    studentCount = 3;
  }

  // 7. Seed Timetable entries for all days Monday-Saturday so faculty today is never empty
  console.log('Seeding timetable slots...');
  const sections = ['S1', 'S2', 'S3'];
  
  for (let day = 1; day <= 6; day++) {
    for (const sec of sections) {
      // CNS Lecture
      await new Timetable({
        academicYear: '2026-2027',
        year: 4,
        semester: 1,
        section: sec,
        facultyId: facultyUser._id as any,
        subjectId: subCNS._id as any,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '10:00',
        duration: 60,
        isActive: true
      }).save();

      // DS Lecture
      await new Timetable({
        academicYear: '2026-2027',
        year: 4,
        semester: 1,
        section: sec,
        facultyId: facultyUser._id as any,
        subjectId: subDS._id as any,
        dayOfWeek: day,
        startTime: '10:00',
        endTime: '11:00',
        duration: 60,
        isActive: true
      }).save();

      // CNS Laboratory (optional link)
      await new Timetable({
        academicYear: '2026-2027',
        year: 4,
        semester: 1,
        section: sec,
        facultyId: facultyUser._id as any,
        subjectId: subCNSLab._id as any,
        laboratoryId: labProgramming._id as any,
        dayOfWeek: day,
        startTime: '13:00',
        endTime: '16:00',
        duration: 180,
        isActive: true
      }).save();
    }
  }

  console.log('Seeded 54 Timetable entries (Mon-Sat, CNS, DS, CNS Lab, Sections S1, S2, S3).');
  console.log('Database seeding process completed successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding crashed:', err);
  process.exit(1);
});
