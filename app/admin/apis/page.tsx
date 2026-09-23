import { Cable, Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function APIsIntegrationsPage() {
  const integrations = [
    { name: 'Paystack Payment Gateway', status: 'connected', latency: '124ms', lastPing: '2 mins ago', type: 'Webhook' },
    { name: 'MikroTik RADIUS Auth', status: 'connected', latency: '45ms', lastPing: 'Just now', type: 'Internal API' },
    { name: 'Connectly Core Backend', status: 'connected', latency: '18ms', lastPing: 'Just now', type: 'Database' },
    { name: 'Starlink Telemetry', status: 'degraded', latency: '850ms', lastPing: '14 mins ago', type: 'External API' },
    { name: 'SMS Notification Gateway', status: 'offline', latency: '-', lastPing: '3 hrs ago', type: 'REST API' }
  ];

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'connected': return <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4"/> Operational</span>;
      case 'degraded': return <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-4 w-4"/> Degraded</span>;
      case 'offline': return <span className="flex items-center gap-1 text-red-600"><XCircle className="h-4 w-4"/> Offline</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Cable className="h-6 w-6 text-[#6d1825]" /> APIs & Integrations
        </h1>
        <p className="text-sm text-slate-500">Monitor external webhooks, payment gateways, and RADIUS backend health.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-6 py-4">Service</th>
              <th className="px-6 py-4">Integration Type</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Current Latency</th>
              <th className="px-6 py-4">Last Sync</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {integrations.map((integration, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-900">{integration.name}</td>
                <td className="px-6 py-4 text-xs font-mono text-slate-500">{integration.type}</td>
                <td className="px-6 py-4 font-medium">{getStatusDisplay(integration.status)}</td>
                <td className="px-6 py-4 font-mono text-slate-700">{integration.latency}</td>
                <td className="px-6 py-4 text-xs text-slate-500">{integration.lastPing}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-xs font-bold text-[#cfa253] hover:text-[#6d1825] uppercase tracking-wider">Test Config</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-3">
        <Activity className="h-5 w-5 shrink-0 mt-0.5" />
        <p>API Keys and webhook secrets have been moved to the <strong className="font-bold">Settings & Security</strong> module. Do not expose live production keys in the operations views.</p>
      </div>
    </div>
  );
}