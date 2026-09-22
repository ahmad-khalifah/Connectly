'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';

const METRICS = ['Revenue', 'Transactions', 'Customers', 'Data Usage', 'Active Users'];
const PERIODS = ['Today', '7 Days', '30 Days', '3 Months', '6 Months', '12 Months'];

export function MetricTimelineChart() {
  const [activeMetric, setActiveMetric] = useState(METRICS[0]);
  const [activePeriod, setActivePeriod] = useState(PERIODS[1]);

  return (
    <div className="flex flex-col h-full">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {METRICS.map((metric) => (
            <button
              key={metric}
              onClick={() => setActiveMetric(metric)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeMetric === metric
                  ? 'bg-[#6d1825] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {metric}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-colors ${
                activePeriod === period
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Visualization Area */}
      <div className="flex-1 min-h-[320px] w-full bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-center relative overflow-hidden">
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between py-8 px-4 pointer-events-none opacity-40">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-full border-b border-dashed border-slate-300"></div>
          ))}
        </div>

        <div className="text-center z-10 relative bg-white/80 p-4 rounded-xl border border-slate-100 backdrop-blur-sm shadow-sm">
          <BarChart3 className="h-8 w-8 text-[#cfa253] mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800">
            {activeMetric} Data ({activePeriod})
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            The data aggregation API is connected. Integrate a charting library (like Recharts) to render this visualizer.
          </p>
        </div>
      </div>
    </div>
  );
}