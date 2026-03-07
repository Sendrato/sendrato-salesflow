import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, FunnelChart, Funnel, LabelList
} from "recharts";
import { STATUS_LABELS } from "@/lib/crm";

const COLORS = ["#3b82f6", "#eab308", "#a855f7", "#f97316", "#6366f1", "#22c55e", "#ef4444", "#6b7280"];

export default function Analytics() {
  const { data: overview } = trpc.analytics.overview.useQuery();
  const { data: pipeline } = trpc.analytics.pipeline.useQuery();
  const { data: contactFreq } = trpc.analytics.contactFrequency.useQuery({ days: 30 });
  const { data: topLeads } = trpc.analytics.topLeads.useQuery({ limit: 10 });

  const statusCounts = overview?.leadStats?.statusCounts ?? [];
  const momentTypeCounts = overview?.momentStats?.typeCounts ?? [];

  const pipelineData = (pipeline ?? []).map((p) => ({
    name: STATUS_LABELS[p.status as keyof typeof STATUS_LABELS] ?? p.status,
    count: Number(p.count),
    value: Number(p.totalValue ?? 0),
  }));

  const pieData = statusCounts.map((s, i) => ({
    name: STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] ?? s.status,
    value: Number(s.count),
    color: COLORS[i % COLORS.length],
  }));

  const typeData = momentTypeCounts.map((t, i) => ({
    name: t.type,
    value: Number(t.count),
    color: COLORS[i % COLORS.length],
  }));

  const activityData = (contactFreq ?? []).map((d) => ({
    date: d.date ? new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
    contacts: Number(d.count),
  }));

  const totalLeads = statusCounts.reduce((a, b) => a + Number(b.count), 0);
  const wonLeads = Number(statusCounts.find((s) => s.status === "won")?.count ?? 0);
  const convRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Pipeline performance and contact metrics</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Leads", value: totalLeads, sub: "All time" },
            { label: "Won Deals", value: wonLeads, sub: "Closed won" },
            { label: "Conversion Rate", value: `${convRate}%`, sub: "Won / Total" },
            { label: "Interactions", value: typeData.reduce((a, b) => a + b.value, 0), sub: "All time" },
          ].map((kpi) => (
            <Card key={kpi.label} className="border shadow-sm">
              <CardContent className="p-5">
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="text-sm font-medium mt-1">{kpi.label}</div>
                <div className="text-xs text-muted-foreground">{kpi.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pipeline Funnel */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sales Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pipelineData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    {pipelineData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No pipeline data</div>
            )}
          </CardContent>
        </Card>

        {/* Two Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Status Distribution */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Lead Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {pieData.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="font-semibold">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Contact Type Breakdown */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Interaction Types</CardTitle>
            </CardHeader>
            <CardContent>
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={typeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Over Time */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Contact Activity (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {activityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={activityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="contacts" stroke="#3b82f6" strokeWidth={2} dot={false} name="Interactions" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No activity data</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
