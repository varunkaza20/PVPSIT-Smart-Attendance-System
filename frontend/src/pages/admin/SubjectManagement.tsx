import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Pencil, Trash, Plus, ShieldAlert } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

interface ISubject {
  _id: string;
  subjectCode: string;
  subjectName: string;
  shortName: string;
  year: number;
  semester: number;
  department: string;
  isLaboratory: boolean;
  credits: number;
}

export const SubjectManagement: React.FC = () => {
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // In-app delete modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    subjectCode: '',
    subjectName: '',
    shortName: '',
    year: 4,
    semester: 1,
    department: 'CSE',
    isLaboratory: false,
    credits: 3
  });

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/subjects');
      if (res.data.success) {
        setSubjects(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load subjects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      subjectCode: '',
      subjectName: '',
      shortName: '',
      year: 4,
      semester: 1,
      department: 'CSE',
      isLaboratory: false,
      credits: 3
    });
    setShowModal(true);
  };

  const handleOpenEdit = (sub: ISubject) => {
    setEditingId(sub._id);
    setFormData({
      subjectCode: sub.subjectCode,
      subjectName: sub.subjectName,
      shortName: sub.shortName,
      year: sub.year,
      semester: sub.semester,
      department: sub.department,
      isLaboratory: sub.isLaboratory,
      credits: sub.credits
    });
    setShowModal(true);
  };

  const handleDeleteClick = (id: string) => {
    setSubjectToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!subjectToDelete) return;
    try {
      const res = await axios.delete(`/api/admin/subjects/${subjectToDelete}`);
      if (res.data.success) {
        toast.success('Subject deactivated.');
        fetchSubjects();
      }
    } catch (err) {
      toast.error('Failed to deactivate subject.');
    } finally {
      setDeleteModalOpen(false);
      setSubjectToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await axios.put(`/api/admin/subjects/${editingId}`, formData);
        if (res.data.success) {
          toast.success('Subject updated.');
          setShowModal(false);
          fetchSubjects();
        }
      } else {
        const res = await axios.post('/api/admin/subjects', formData);
        if (res.data.success) {
          toast.success('Subject created.');
          setShowModal(false);
          fetchSubjects();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-pvpsit-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-pvpsit-blue">Subject Management</h1>
          <p className="text-xs text-slate-500 mt-1">Configure syllabus codes and course credits.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center px-4 py-2.5 bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Subject
        </button>
      </div>

      <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-slate-500">Loading syllabus list...</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No subjects configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-pvpsit-border text-slate-600 font-semibold">
                <tr>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Subject Name</th>
                  <th className="px-6 py-4">Acronym</th>
                  <th className="px-6 py-4">Year/Sem</th>
                  <th className="px-6 py-4">Credits</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pvpsit-border">
                {subjects.map((sub) => (
                  <tr key={sub._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-pvpsit-dark">{sub.subjectCode}</td>
                    <td className="px-6 py-4 font-medium">{sub.subjectName}</td>
                    <td className="px-6 py-4 text-slate-600">{sub.shortName}</td>
                    <td className="px-6 py-4">Year {sub.year} / Sem {sub.semester}</td>
                    <td className="px-6 py-4 font-medium">{sub.credits}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        sub.isLaboratory ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-pvpsit-blue border border-blue-200'
                      }`}>
                        {sub.isLaboratory ? 'Lab Session' : 'Theory Lecture'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(sub)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-pvpsit-blue rounded transition-colors inline-flex"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(sub._id)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-pvpsit-danger rounded transition-colors inline-flex"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-xl border border-pvpsit-border shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-pvpsit-border flex items-center justify-between">
              <h3 className="font-bold text-pvpsit-blue">
                {editingId ? 'Edit Subject Info' : 'Add New Subject'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Subject Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingId}
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                    value={formData.subjectCode}
                    onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Short Acronym *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                    placeholder="e.g. CNS / DS"
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Subject Name *</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                  value={formData.subjectName}
                  onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Year *</label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                  >
                    <option value={2}>II Year</option>
                    <option value={3}>III Year</option>
                    <option value={4}>IV Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Semester *</label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                  >
                    <option value={1}>Sem 1</option>
                    <option value={2}>Sem 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Credits *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Department *</label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="IT">IT</option>
                    <option value="ME">ME</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <input
                    id="isLaboratory"
                    type="checkbox"
                    className="w-4 h-4 text-pvpsit-blue border-pvpsit-border rounded"
                    checked={formData.isLaboratory}
                    onChange={(e) => setFormData({ ...formData, isLaboratory: e.target.checked })}
                  />
                  <label htmlFor="isLaboratory" className="ml-2 text-sm font-semibold text-pvpsit-dark">
                    Is Laboratory course
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-pvpsit-border flex items-center justify-end space-x-3 -mx-6 -mb-6 bg-slate-50 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg"
                >
                  {editingId ? 'Save Updates' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Confirm Subject Deactivation"
        message="Are you sure you want to deactivate this subject? It will no longer be available to schedule in the timetables."
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setSubjectToDelete(null); }}
      />
    </div>
  );
};
