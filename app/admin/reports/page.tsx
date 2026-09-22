import { FileText, Download, Calendar, Filter } from 'lucide-react';

export default function ReportsPage() {
  const reportTypes = [
    { title: 'Gross Revenue & Yield', desc: 'Complete breakdown of gateway processing fees, net revenue, and transaction volume.', format: 'CSV / PDF' },
    { title: 'OPEX vs CAPEX Ledger', desc: 'Export all logged network operational expenses against specific facility locations.', format: 'CSV' },
    { title: 'Subscriber Churn Analysis', desc: 'List of accounts that failed to renew their active internet pass within 30 days.', format: 'CSV' },
    { title: 'Network Data Consumption', desc: 'Bandwidth utilization categorized by location, plan tier, and hour of the day.', format: 'CSV / JSON' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#6d1825]" /> Business Reports
          </h1>
          <p className="text-sm text-slate-500">Generate formatted operational exports for accounting and network auditing.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs mb-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" /> Global Export Filters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date Range</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#6d1825] bg-white">
                <option>This Month (Sept 2026)</option>
                <option>Last Month (Aug 2026)</option>
                <option>Year to Date (2026)</option>
                <option>Custom Range...</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Target Facility</label>
            <select className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#6d1825] bg-white">
              <option>All Locations (Network Wide)</option>
              <option>FUHSA Campus Network</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportTypes.map((report, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between hover:border-[#cfa253] transition-colors shadow-xs">
            <div>
              <h3 className="font-bold text-slate-900 mb-2">{report.title}</h3>
              <p className="text-sm text-slate-500 mb-4">{report.desc}</p>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs font-mono font-bold text-slate-400">{report.format}</span>
              <button className="flex items-center gap-2 text-sm font-bold text-[#6d1825] hover:text-[#5a141e] transition-colors">
                <Download className="h-4 w-4" /> Generate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}