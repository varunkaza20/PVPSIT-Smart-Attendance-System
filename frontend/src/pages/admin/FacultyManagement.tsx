import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { UserMinus, UserPlus, Pencil, ShieldAlert } from 'lucide-react';

interface IUserProfile {
  _id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  role: 'ADMIN' | 'FACULTY';
  department: string;
  designation: string;
  isActive: boolean;
}

export const FacultyManagement: React.FC = () => {
  const [users, setUsers] = useState<IUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Custom delete confirmation modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'FACULTY',
    department: 'CSE',
    designation: 'Assistant Professor'
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/faculty');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load user records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      employeeId: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      role: 'FACULTY',
      department: 'CSE',
      designation: 'Assistant Professor'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (user: IUserProfile) => {
    setEditingId(user._id);
    setFormData({
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      password: '', // leave empty to not change
      role: user.role,
      department: user.department,
      designation: user.designation
    });
    setShowModal(true);
  };

  const handleDeleteClick = (id: string) => {
    setUserToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const res = await axios.delete(`/api/admin/faculty/${userToDelete}`);
      if (res.data.success) {
        toast.success('Account deactivated successfully.');
        fetchUsers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate account.');
    } finally {
      setDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const payload: any = { ...formData };
        if (!payload.password) delete payload.password; // do not update if empty
        const res = await axios.put(`/api/admin/faculty/${editingId}`, payload);
        if (res.data.success) {
          toast.success('User details updated successfully.');
          setShowModal(false);
          fetchUsers();
        }
      } else {
        const res = await axios.post('/api/admin/faculty', formData);
        if (res.data.success) {
          toast.success(`${formData.role === 'ADMIN' ? 'Administrator' : 'Faculty'} account created.`);
          setShowModal(false);
          fetchUsers();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-pvpsit-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-pvpsit-blue">User & Faculty Management</h1>
          <p className="text-xs text-slate-500 mt-1">Configure and manage teacher credentials and administrative accounts.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center px-4 py-2.5 bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-slate-500">Loading user accounts...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No user accounts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-pvpsit-border text-slate-600 font-semibold">
                <tr>
                  <th className="px-6 py-4">Employee ID</th>
                  <th className="px-6 py-4">Full Name</th>
                  <th className="px-6 py-4">System Role</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pvpsit-border">
                {users.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-pvpsit-dark">{item.employeeId}</td>
                    <td className="px-6 py-4 font-medium">{item.fullName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${
                        item.role === 'ADMIN' 
                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                          : 'bg-blue-50 text-pvpsit-blue border-blue-200'
                      }`}>
                        {item.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{item.email}</td>
                    <td className="px-6 py-4">{item.department}</td>
                    <td className="px-6 py-4 text-slate-600">{item.designation}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-2 text-slate-600 hover:bg-slate-100 hover:text-pvpsit-blue rounded-lg transition-colors inline-flex"
                        title="Edit Details"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(item._id)}
                        className="p-2 text-slate-600 hover:bg-slate-100 hover:text-pvpsit-danger rounded-lg transition-colors inline-flex"
                        title="Deactivate User"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-xl border border-pvpsit-border shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-pvpsit-border flex items-center justify-between">
              <h3 className="font-bold text-pvpsit-blue">
                {editingId ? 'Edit Account Details' : 'Add New Account'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingId}
                    className="w-full px-3 py-2 text-xs font-bold border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue uppercase tracking-wider"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">System Role *</label>
                  <select
                    className="w-full px-3 py-2 text-xs font-bold border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue text-pvpsit-blue"
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value as 'ADMIN' | 'FACULTY';
                      setFormData({ ...formData, role: newRole });
                    }}
                  >
                    <option value="FACULTY">Faculty Member</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Department *</label>
                  <select
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="IT">IT</option>
                    <option value="ME">ME</option>
                    <option value="CE">CE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Designation</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Email *</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Phone</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">
                  Password {editingId ? '(Leave empty to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  minLength={editingId ? undefined : 8}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
                  placeholder={editingId ? 'Enter new password if changing' : 'Choose a password (min 8 characters)'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="px-6 py-4 border-t border-pvpsit-border flex items-center justify-end space-x-3 -mx-6 -mb-6 bg-slate-50 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingId ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Confirm Account Deactivation"
        message="Are you sure you want to deactivate this user account? They will no longer be able to log in or conduct attendance sessions."
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setUserToDelete(null); }}
      />
    </div>
  );
};
