"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card } from "@/components/ui/primitives";

type Row = {
  date: string; throughput: number; rework: number;
  passRate: number; defectRate: number; hours: number;
};

export function MetricsCharts({ rows }: { rows: Row[] }) {
  const axis = { stroke: "#94a3b8", fontSize: 11 };
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel title="Throughput (unique vs rework)">
        <LineChart data={rows}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="2 2" />
          <XAxis dataKey="date" {...axis} /><YAxis {...axis} />
          <Tooltip /><Legend />
          <Line type="monotone" dataKey="throughput" name="Unique" stroke="#0a0a0a" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="rework" name="Rework" stroke="#94a3b8" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>
      <Panel title="Pass rate vs defect rate (%)">
        <LineChart data={rows}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="2 2" />
          <XAxis dataKey="date" {...axis} /><YAxis {...axis} />
          <Tooltip /><Legend />
          <Line type="monotone" dataKey="passRate" name="Pass %" stroke="#15803d" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="defectRate" name="Defect %" stroke="#b91c1c" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>
      <Panel title="Hours worked">
        <LineChart data={rows}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="2 2" />
          <XAxis dataKey="date" {...axis} /><YAxis {...axis} />
          <Tooltip />
          <Line type="monotone" dataKey="hours" name="Hours" stroke="#1d4ed8" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </Card>
  );
}
