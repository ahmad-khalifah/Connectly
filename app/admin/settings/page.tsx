import { Settings, Shield, Users, Cable, Bell } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-[#6d1825]" /> System Settings
        </h1>
        <p className="text-sm text-slate-500">Configure business parameters, access roles, and external APIs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Sidebar for Settings */}
        <div className="md:col-span-1 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-[#6d1825] text-white shadow-sm">
            <Shield className="h-4 w-4 text-[#cfa253]" /> Roles & Access
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <Cable className="h-4 w-4 text-slate-400" /> API Integrations
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <Bell className="h-4 w-4 text-slate-400" /> Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <Users className="h-4 w-4 text-slate-400" /> Staff Directory
          </button>
        </div>

        {/* Configuration Panel */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Roles & Access Control</h2>
          
          <div className="space-y-4">
            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Network Engineer</h3>
                  <p className="text-xs text-slate-500">Full access to hardware telemetry, routers, and backhauls.</p>
                </div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200">Active</span>
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Finance & Operations</h3>
                  <p className="text-xs text-slate-500">Access to transaction logs, revenue analytics, and OPEX tracking.</p>
                </div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200">Active</span>
              </div>
            </div>

            <button className="mt-4 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors w-full">
              Create New Role
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}