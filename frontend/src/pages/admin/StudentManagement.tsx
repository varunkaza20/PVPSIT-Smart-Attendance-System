import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Upload, Trash, Pencil, Users, Info, ShieldAlert, Plus, UserCheck } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

interface IStudent {
  _id: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  section: string;
  year: number;
  semester: number;
  department: string;
  regulation: string;
  admissionYear: number;
}

export const StudentManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'roster' | 'bulk-import' | 'custom-list'>('roster');
  const [students, setStudents] = useState<IStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    year: 4,
    section: 'S1'
  });

  // Delete modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);

  // Edit Student states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<IStudent | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    section: '',
    year: 4,
    department: 'CSE',
    regulation: 'PVPS19'
  });

  // Excel Upload states
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [showUploadPromptModal, setShowUploadPromptModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importConfig, setImportConfig] = useState({
    year: 4,
    department: 'CSE',
    regulation: 'PVPS19',
    admissionYear: 2022
  });
  const [uploadResult, setUploadResult] = useState<any | null>(null);

  // Custom Training List states
  const [customListConfig, setCustomListConfig] = useState({
    programTitle: '',
    sectionName: 'FDP-ML-2026',
    year: 4,
    department: 'CSE',
    regulation: 'FDP2026',
    admissionYear: 2026
  });
  const [rawStudentList, setRawStudentList] = useState('');
  const [creatingCustomList, setCreatingCustomList] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/students', { params: filters });
      if (res.data.success) {
        setStudents(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load students list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'roster') {
      fetchStudents();
    }
  }, [filters, activeTab]);

  const handleDeleteClick = (id: string) => {
    setStudentToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    try {
      const res = await axios.delete(`/api/admin/students/${studentToDelete}`);
      if (res.data.success) {
        toast.success('Student deactivated successfully.');
        fetchStudents();
      }
    } catch (err) {
      toast.error('Failed to deactivate student.');
    } finally {
      setDeleteModalOpen(false);
      setStudentToDelete(null);
    }
  };

  const handleOpenEdit = (std: IStudent) => {
    setEditingStudent(std);
    setEditForm({
      firstName: std.firstName,
      lastName: std.lastName,
      section: std.section,
      year: std.year,
      department: std.department,
      regulation: std.regulation
    });
    setShowEditModal(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const res = await axios.put(`/api/admin/students/${editingStudent._id}`, editForm);
      if (res.data.success) {
        toast.success('Student details updated.');
        setShowEditModal(false);
        fetchStudents();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExcelFile(e.target.files[0]);
      setUploadResult(null);
      // Prompt user for import details immediately after selecting the file
      setShowUploadPromptModal(true);
    }
  };

  const handleExcelRosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json<any>(ws);

          const parsedLines: string[] = [];
          data.forEach((row) => {
            const roll = String(row['Roll_Number'] || row['Roll Number'] || row['rollNumber'] || row['RollNo'] || '').trim().toUpperCase();
            const name = String(row['Name'] || row['Student Name'] || row['studentName'] || '').trim();
            if (roll && name) {
              parsedLines.push(`${roll}, ${name}`);
            }
          });

          if (parsedLines.length > 0) {
            setRawStudentList(parsedLines.join('\n'));
            toast.success(`Successfully parsed ${parsedLines.length} students from Excel!`);
          } else {
            toast.error('No students found in the Excel. Make sure it contains "Roll Number" and "Name" columns.');
          }
        } catch (error) {
          toast.error('Failed to parse Excel file.');
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleExcelImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) return;

    setUploading(true);
    setShowUploadPromptModal(false);

    const formData = new FormData();
    formData.append('file', excelFile);
    formData.append('year', String(importConfig.year));
    formData.append('department', importConfig.department);
    formData.append('regulation', importConfig.regulation);
    formData.append('admissionYear', String(importConfig.admissionYear));

    try {
      const res = await axios.post('/api/admin/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success('Students spreadsheet imported successfully.');
        setUploadResult(res.data.data);
        setExcelFile(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to import Excel file.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateCustomList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawStudentList.trim()) {
      toast.error('Student list text is empty.');
      return;
    }

    setCreatingCustomList(true);
    
    // Parse raw text: lines containing "RollNumber, Name"
    const lines = rawStudentList.split('\n');
    const parsedRoster: any[] = [];
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      const firstCommaIdx = trimmed.indexOf(',');
      let roll = '';
      let name = '';
      
      if (firstCommaIdx !== -1) {
        roll = trimmed.slice(0, firstCommaIdx).trim().toUpperCase();
        name = trimmed.slice(firstCommaIdx + 1).trim();
      } else {
        // Space fallback
        const parts = trimmed.split(/\s+/);
        roll = parts[0]?.trim().toUpperCase() || '';
        name = parts.slice(1).join(' ')?.trim() || '';
      }

      if (roll && name) {
        parsedRoster.push({
          rollNumber: roll,
          studentName: name
        });
      }
    });

    if (parsedRoster.length === 0) {
      toast.error('Could not parse any valid student entries. Format: RollNumber, Full Name');
      setCreatingCustomList(false);
      return;
    }

    // Map parsed array to student schema records
    const studentRecords = parsedRoster.map((item) => {
      const nameParts = item.studentName.split(' ');
      const firstName = nameParts[0] || 'Student';
      const lastName = nameParts.slice(1).join(' ') || 'Name';
      return {
        rollNumber: item.rollNumber,
        firstName,
        lastName,
        fullName: item.studentName,
        section: customListConfig.sectionName.toUpperCase(),
        year: Number(customListConfig.year),
        semester: 1, // Default to 1 as semester is removed from students
        department: customListConfig.department,
        regulation: customListConfig.regulation,
        admissionYear: Number(customListConfig.admissionYear),
        isActive: true
      };
    });

    try {
      const res = await axios.post('/api/admin/students/import-raw', {
        studentRecords
      });
      if (res.data.success) {
        toast.success(`Registered ${studentRecords.length} custom program students!`);
        setRawStudentList('');
        setActiveTab('roster');
        setFilters({
          year: Number(customListConfig.year),
          section: customListConfig.sectionName.toUpperCase()
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit custom list.');
    } finally {
      setCreatingCustomList(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tab Navigation header */}
      <div className="flex border-b border-pvpsit-border bg-white rounded-t-xl overflow-hidden p-1.5 space-x-1">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center px-4 py-2.5 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'roster' ? 'bg-pvpsit-blue text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 mr-1.5" />
          Roster Viewer
        </button>
        <button
          onClick={() => setActiveTab('bulk-import')}
          className={`flex items-center px-4 py-2.5 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'bulk-import' ? 'bg-pvpsit-blue text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Spreadsheet Import
        </button>
        <button
          onClick={() => setActiveTab('custom-list')}
          className={`flex items-center px-4 py-2.5 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'custom-list' ? 'bg-pvpsit-blue text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Training / FDP Programs
        </button>
      </div>

      {/* --- TAB 1: ROSTER VIEW --- */}
      {activeTab === 'roster' && (
        <div className="grid grid-cols-3 gap-6">
          
          {/* Filters Sidebar */}
          <div className="col-span-1 bg-pvpsit-card rounded-xl border border-pvpsit-border p-6 h-fit space-y-4">
            <h3 className="font-bold text-pvpsit-blue text-sm">Class Roster Filters</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Academic Year</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}
                >
                  <option value={2}>II Year (Sophomores)</option>
                  <option value={3}>III Year (Juniors)</option>
                  <option value={4}>IV Year (Seniors)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Section / Program Group</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                  value={filters.section}
                  onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                >
                  <option value="S1">Section 1</option>
                  <option value="S2">Section 2</option>
                  <option value="S3">Section 3</option>
                  <option value="S4">Section 4</option>
                  {/* Handle any user entered custom section lookup dynamically */}
                  {filters.section !== 'S1' && filters.section !== 'S2' && filters.section !== 'S3' && filters.section !== 'S4' && (
                    <option value={filters.section}>{filters.section}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Student List Grid */}
          <div className="col-span-2 space-y-4">
            <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border overflow-hidden">
              {loading ? (
                <div className="p-12 flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-slate-500">Loading student roster...</p>
                </div>
              ) : students.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold">No students registered in Section {filters.section}.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 border-b border-pvpsit-border text-slate-600 font-semibold sticky top-0">
                      <tr>
                        <th className="px-6 py-3.5">Roll Number</th>
                        <th className="px-6 py-3.5">Student Name</th>
                        <th className="px-6 py-3.5">Section</th>
                        <th className="px-6 py-3.5">Regulation</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pvpsit-border">
                      {students.map((std) => (
                        <tr key={std._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 font-semibold text-pvpsit-dark">{std.rollNumber}</td>
                          <td className="px-6 py-3 font-medium">{std.fullName}</td>
                          <td className="px-6 py-3 text-slate-600">{std.section}</td>
                          <td className="px-6 py-3 text-slate-500">{std.regulation}</td>
                          <td className="px-6 py-3 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEdit(std)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-pvpsit-blue rounded transition-colors inline-flex"
                              title="Edit Info"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(std._id)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-pvpsit-danger rounded transition-colors inline-flex"
                              title="Deactivate Student"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: EXCEL SPREADSHEET IMPORT --- */}
      {activeTab === 'bulk-import' && (
        <div className="max-w-xl mx-auto bg-pvpsit-card rounded-xl border border-pvpsit-border p-6 space-y-6">
          <div className="flex items-center space-x-3 text-pvpsit-blue">
            <Upload className="w-6 h-6" />
            <h3 className="font-bold text-sm">Excel Student Spreadsheet Import</h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Upload student spreadsheet files. The system automatically reads columns (such as `Roll_Number`, `Name`, and `Section`) and bulk-upserts all sections concurrently.
          </p>

          <div className="border-2 border-dashed border-slate-200 hover:border-pvpsit-blue/50 rounded-xl p-8 text-center cursor-pointer relative bg-slate-50 transition-colors">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <span className="text-xs font-semibold text-slate-600 block">
              {excelFile ? excelFile.name : 'Select or drop student Excel file (.xlsx / .xls)'}
            </span>
          </div>

          {uploading && (
            <div className="flex items-center justify-center p-3 bg-blue-50 border border-blue-200 text-pvpsit-blue rounded-lg text-xs font-bold space-x-2">
              <div className="w-4 h-4 border-2 border-pvpsit-blue border-t-transparent rounded-full animate-spin"></div>
              <span>Uploading and parsing database records...</span>
            </div>
          )}

          {uploadResult && (
            <div className="p-4 bg-slate-50 border border-pvpsit-border rounded-lg space-y-2 text-xs">
              <div className="font-bold text-pvpsit-blue flex items-center">
                <Info className="w-4 h-4 mr-1.5" /> Import Process Results
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 font-semibold pt-1">
                <div>Total rows detected: {uploadResult.totalRecords}</div>
                <div className="text-pvpsit-success">Success imports/upserts: {uploadResult.imported}</div>
                <div className="text-pvpsit-danger">Skipped lines: {uploadResult.skipped}</div>
              </div>
              {uploadResult.reasons.length > 0 && (
                <div className="border-t border-slate-200 pt-2 mt-2">
                  <span className="font-bold text-slate-500 block mb-1">Skip reasons:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[10px]">
                    {uploadResult.reasons.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: CUSTOM LIST CREATION (FDPs / Trainings) --- */}
      {activeTab === 'custom-list' && (
        <form onSubmit={handleCreateCustomList} className="max-w-3xl mx-auto bg-pvpsit-card rounded-xl border border-pvpsit-border p-6 space-y-6">
          <div className="flex items-center space-x-3 text-pvpsit-blue">
            <Plus className="w-6 h-6" />
            <h3 className="font-bold text-sm">Register Custom Training / FDP Roster</h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Useful for one-off trainings, FDPs, seminars, workshops, or bootcamps. Assign a program section name (e.g. `FDP-ML-2026`) and paste the attendees.
          </p>

          <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-6">
            <div>
              <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Course/Program Name *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                placeholder="e.g. AI/ML Bootcamp"
                value={customListConfig.programTitle}
                onChange={(e) => setCustomListConfig({ ...customListConfig, programTitle: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Program Section Code *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 uppercase focus:outline-none"
                placeholder="e.g. FDP-ML-2026"
                value={customListConfig.sectionName}
                onChange={(e) => setCustomListConfig({ ...customListConfig, sectionName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Regulation Identifier *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 uppercase focus:outline-none"
                value={customListConfig.regulation}
                onChange={(e) => setCustomListConfig({ ...customListConfig, regulation: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Target Year</label>
              <select
                className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50"
                value={customListConfig.year}
                onChange={(e) => setCustomListConfig({ ...customListConfig, year: Number(e.target.value) })}
              >
                <option value={4}>4th Year</option>
                <option value={3}>3rd Year</option>
                <option value={2}>2nd Year</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Department</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 uppercase"
                value={customListConfig.department}
                onChange={(e) => setCustomListConfig({ ...customListConfig, department: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Admission Year</label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50"
                value={customListConfig.admissionYear}
                onChange={(e) => setCustomListConfig({ ...customListConfig, admissionYear: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border border-pvpsit-border rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-pvpsit-dark mb-1">
                Quick Excel Roster Upload (Optional)
              </label>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelRosterUpload}
                className="w-full px-3 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-white cursor-pointer file:mr-3 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-pvpsit-blue hover:file:bg-blue-100"
              />
            </div>
            <div className="flex items-center text-[10px] text-slate-400 font-semibold leading-relaxed">
              Upload an Excel spreadsheet containing columns for student Roll Numbers and Names. It will instantly parse and prefill the text area below.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-pvpsit-dark mb-1 mt-2">
              Attendee List (Format: RollNumber, Student Name — One per line) *
            </label>
            <textarea
              required
              rows={8}
              className="w-full px-3 py-2 text-xs font-mono border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
              placeholder="23501A0501, SOOM RAJ&#10;23501A0502, HARISH REDDY&#10;23501A0503, PRASAD K"
              value={rawStudentList}
              onChange={(e) => setRawStudentList(e.target.value)}
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={creatingCustomList}
              className="flex items-center px-6 py-2.5 bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:bg-blue-400"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {creatingCustomList ? 'Processing registration...' : 'Create Roster List'}
            </button>
          </div>
        </form>
      )}

      {/* MODAL PROMPT FOR EXCEL FILE METADATA */}
      {showUploadPromptModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-xl border border-pvpsit-border shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-pvpsit-border flex items-center justify-between">
              <h3 className="font-bold text-pvpsit-blue text-sm">Enter Roster Metadata</h3>
              <button
                type="button"
                onClick={() => { setShowUploadPromptModal(false); setExcelFile(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleExcelImportSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-pvpsit-blue font-semibold">
                Selected file: {excelFile?.name}
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Academic Year</label>
                <select
                  className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50"
                  value={importConfig.year}
                  onChange={(e) => setImportConfig({ ...importConfig, year: Number(e.target.value) })}
                >
                  <option value={2}>II Year</option>
                  <option value={3}>III Year</option>
                  <option value={4}>IV Year</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Dept</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 uppercase"
                    value={importConfig.department}
                    onChange={(e) => setImportConfig({ ...importConfig, department: e.target.value })}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Regulation</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 uppercase"
                    value={importConfig.regulation}
                    onChange={(e) => setImportConfig({ ...importConfig, regulation: e.target.value })}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Adm Year</label>
                  <input
                    type="number"
                    required
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50"
                    value={importConfig.admissionYear}
                    onChange={(e) => setImportConfig({ ...importConfig, admissionYear: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-pvpsit-border flex items-center justify-end space-x-3 -mx-6 -mb-6 bg-slate-50 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowUploadPromptModal(false); setExcelFile(null); }}
                  className="px-4 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg"
                >
                  Submit & Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT REGULAR STUDENT INFO MODAL */}
      {showEditModal && editingStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-xl border border-pvpsit-border shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-pvpsit-border flex items-center justify-between">
              <h3 className="font-bold text-pvpsit-blue">Edit Student Info ({editingStudent.rollNumber})</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleUpdateStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Section *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Regulation *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                    value={editForm.regulation}
                    onChange={(e) => setEditForm({ ...editForm, regulation: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Academic Year</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                  value={editForm.year}
                  onChange={(e) => setEditForm({ ...editForm, year: Number(e.target.value) })}
                >
                  <option value={2}>II Year</option>
                  <option value={3}>III Year</option>
                  <option value={4}>IV Year</option>
                </select>
              </div>

              <div className="px-6 py-4 border-t border-pvpsit-border flex items-center justify-end space-x-3 -mx-6 -mb-6 bg-slate-50 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg"
                >
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION IN-APP MODAL */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Confirm Student Deactivation"
        message="Are you sure you want to deactivate this student? They will not appear in subsequent class session rosters."
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setStudentToDelete(null); }}
      />
    </div>
  );
};
