import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', {
        employeeId: data.employeeId.trim(),
        password: data.password
      });

      const { token, user } = response.data;
      login(token, user);
      toast.success('Login successful! Welcome back.');

      // Redirect depending on user role
      if (user.role === 'ADMIN') {
        navigate('/admin/faculty');
      } else {
        navigate('/regular-attendance');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Invalid Employee ID or Password.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-pvpsit-bg px-4">
      <div className="w-full max-w-md bg-pvpsit-card rounded-xl border border-pvpsit-border shadow-sm p-8">
        
        {/* LOGO & TITLE */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/pvpsit_logo.png" 
            alt="PVPSIT Logo" 
            className="w-36 h-36 object-contain mb-3 drop-shadow-sm" 
          />
          <h2 className="text-xl font-bold text-pvpsit-blue text-center">
            PVPSIT Smart Attendance
          </h2>
          <p className="text-xs text-slate-500 font-medium text-center mt-1">
            Faculty & Administrator Login Portal
          </p>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-pvpsit-dark mb-2" htmlFor="employeeId">
              Employee ID
            </label>
            <input
              id="employeeId"
              type="text"
              className={`w-full px-4 py-3 text-sm border rounded-lg focus:outline-none focus:border-pvpsit-blue bg-slate-50 ${
                errors.employeeId ? 'border-pvpsit-danger' : 'border-pvpsit-border'
              }`}
              placeholder="e.g. FAC001 / ADMIN001"
              {...register('employeeId', { required: 'Employee ID is required.' })}
            />
            {errors.employeeId && (
              <p className="text-xs text-pvpsit-danger mt-1">
                {String(errors.employeeId.message)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-pvpsit-dark mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={`w-full px-4 py-3 text-sm border rounded-lg focus:outline-none focus:border-pvpsit-blue bg-slate-50 ${
                errors.password ? 'border-pvpsit-danger' : 'border-pvpsit-border'
              }`}
              placeholder="••••••••"
              {...register('password', { required: 'Password is required.' })}
            />
            {errors.password && (
              <p className="text-xs text-pvpsit-danger mt-1">
                {String(errors.password.message)}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'LOGIN'}
          </button>
        </form>
      </div>
    </div>
  );
};
