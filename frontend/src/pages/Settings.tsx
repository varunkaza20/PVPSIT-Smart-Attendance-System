import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Sliders, Save, Info } from 'lucide-react';

export const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    collegeName: '',
    collegeShortName: '',
    attendanceThreshold: 75,
    timezone: 'Asia/Kolkata',
    sessionTimeout: 50,
    enableScannerSound: false
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/settings');
      if (res.data.success) {
        setFormData({
          collegeName: res.data.data.collegeName,
          collegeShortName: res.data.data.collegeShortName,
          attendanceThreshold: res.data.data.attendanceThreshold,
          timezone: res.data.data.timezone,
          sessionTimeout: res.data.data.sessionTimeout,
          enableScannerSound: res.data.data.enableScannerSound
        });
      }
    } catch (err) {
      toast.error('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put('/api/settings', formData);
      if (res.data.success) {
        toast.success('System settings saved successfully!');
      }
    } catch (err) {
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center bg-pvpsit-card rounded-xl border border-pvpsit-border">
        <div className="w-10 h-10 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-slate-500 font-medium">Loading system configurations...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-pvpsit-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-pvpsit-blue">System Settings</h1>
          <p className="text-xs text-slate-500 mt-1">Configure global application variables and thresholds.</p>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-pvpsit-border flex items-center bg-slate-50">
          <Sliders className="w-4 h-4 mr-2 text-pvpsit-blue" />
          <h3 className="font-bold text-pvpsit-blue text-sm">ERP Global Parameters</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-pvpsit-dark mb-2">College Full Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
              value={formData.collegeName}
              onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-pvpsit-dark mb-2">Short Acronym</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                value={formData.collegeShortName}
                onChange={(e) => setFormData({ ...formData, collegeShortName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-pvpsit-dark mb-2">Local Timezone</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
            <div>
              <label className="block text-sm font-semibold text-pvpsit-dark mb-2">Defaulters Threshold (%)</label>
              <input
                type="number"
                required
                min="0"
                max="100"
                className="w-full px-4 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                value={formData.attendanceThreshold}
                onChange={(e) => setFormData({ ...formData, attendanceThreshold: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-pvpsit-dark mb-2">Scanner Timeout (mins)</label>
              <input
                type="number"
                required
                className="w-full px-4 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                value={formData.sessionTimeout}
                onChange={(e) => setFormData({ ...formData, sessionTimeout: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center border-t border-slate-100 pt-6">
            <input
              id="enableScannerSound"
              type="checkbox"
              className="w-4 h-4 text-pvpsit-blue border-pvpsit-border rounded"
              checked={formData.enableScannerSound}
              onChange={(e) => setFormData({ ...formData, enableScannerSound: e.target.checked })}
            />
            <label htmlFor="enableScannerSound" className="ml-2 text-sm font-semibold text-pvpsit-dark">
              Enable Scanner Success sound beep
            </label>
          </div>

          <div className="p-4 bg-slate-50 border border-pvpsit-border rounded-lg flex items-start space-x-2">
            <Info className="w-4 h-4 text-pvpsit-blue shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 font-medium">
              Updating these values affects live defaulter report calculations instantly. Beeps require compatible barcode wedge hardware signals.
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-2.5 bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:bg-blue-400"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
