'use client';

import { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const METRICS = ['Revenue', 'Transactions', 'Customers', 'Data Usage', 'Active Users'];
const PERIODS = ['Today', '7 Days', '30 Days', '3 Months', '6 Months', '12 Months'];

export function MetricTimelineChart({ transactions = [] }: { transactions?: any[] }) {
  const [activeMetric, setActiveMetric] = useState(METRICS[0]);
  const [activePeriod, setActivePeriod] = useState(PERIODS[1]);

  // Aggregate revenue by date
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const grouped = transactions.reduce((acc: any, curr: any) => {
      // Format date to "Sep 26"
      const date = new Date(curr.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
      
      if (!acc[date]) {
        acc[date] = { date, amount: 0, count: 0 };
      }
      
      acc[date].amount += Number(curr.net_amount_ngn || 0);
      acc[date].count += 1;
      
      return acc;
    }, {});

    // Reverse so the chart goes chronologically from left to right
    return Object.values(grouped).reverse();
  }, [transactions]);

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
      <div className="flex-1 min-h-[320px] w-full bg-white rounded-xl flex items-center justify-center relative overflow-hidden">
        
        {chartData.length > 0 && activeMetric === 'Revenue' ? (
          <div className="w-full h-[320px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `₦${value.toLocaleString()}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`₦${value.toLocaleString('en-NG')}`, 'Revenue']}
                />
                <Bar dataKey="amount" fill="#6d1825" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center z-10 relative bg-white/80 p-4 rounded-xl border border-slate-100 backdrop-blur-sm shadow-sm">
            <BarChart3 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">
              {activeMetric} Data ({activePeriod})
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              No data available for this metric in the selected period.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}