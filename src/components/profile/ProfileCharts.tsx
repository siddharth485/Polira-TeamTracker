import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EmployeeMetrics } from '../../lib/metrics'

const GRID = 'var(--border)'
const AXIS = 'var(--text-3)'

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="chart-card">
      <div className="chart-head">
        <h4>{title}</h4>
        <span>{subtitle}</span>
      </div>
      <div className="chart-body">{children}</div>
    </div>
  )
}

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--text)',
}

export function ProfileCharts({ m }: { m: EmployeeMetrics }) {
  return (
    <div className="chart-grid">
      <Panel title="Tasks completed over time" subtitle="Cumulative delivery">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={m.tasksOverTime} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="g-tasks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6d5efc" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#6d5efc" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="completed" stroke="#6d5efc" strokeWidth={2.5} fill="url(#g-tasks)" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Avg hours / task — weekly" subtitle="Resolution speed by week">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={m.hoursPerWeek} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="hours" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Avg hours / task — monthly" subtitle="Resolution speed by month">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={m.hoursPerMonth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="hours" fill="#22c55e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Work-type mix" subtitle="Where effort goes">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={m.typeMix} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
              {m.typeMix.map((d) => <Cell key={d.type} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="legend">
          {m.typeMix.map((d) => (
            <span key={d.type}><i style={{ background: d.color }} />{d.label} ({d.value})</span>
          ))}
        </div>
      </Panel>
    </div>
  )
}
