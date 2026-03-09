import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2, TrendingUp, MessageSquare, Target, ArrowRight, Plus, Clock, CheckCircle2, AlertCircle, Video
} from "lucide-react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, formatRelativeTime, formatCurrency, formatDate
} from "@/lib/crm";

const PIPELINE_COLORS = [
  "#3b82f6", "#eab308", "#a855f7", "#f97316", "#6366f1", "#22c55e", "#ef4444", "#6b7280"
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: overview } = trpc.analytics.overview.useQuery();
  const { data: pipeline } = trpc.analytics.pipeline.useQuery();
  const { data: topLeads } = trpc.analytics.topLeads.useQuery({ limit: 8 });
  const { data: recentActivity } = trpc.analytics.recentActivity.useQuery({ limit: 8 });
  const { data: contactFreq } = trpc.analytics.contactFrequency.useQuery({ days: 30 });
  const { data: followUpData } = trpc.analytics.followUps.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const totalLeads = overview?.leadStats?.total ?? 0;
  const statusCounts = overview?.leadStats?.statusCounts ?? [];
  const wonCount = statusCounts.find((s) => s.status === "won")?.count ?? 0;
  const newCount = statusCounts.find((s) => s.status === "new")?.count ?? 0;
  const totalMoments = (overview?.momentStats?.typeCounts ?? []).reduce((a, b) => a + Number(b.count), 0);

  const pipelineData = (pipeline ?? []).map((p) => ({
    name: STATUS_LABELS[p.status as keyof typeof STATUS_LABELS] ?? p.status,
    count: Number(p.count),
    value: Number(p.totalValue),
  }));

  const pieData = statusCounts.map((s, i) => ({
    name: STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] ?? s.status,
    value: Number(s.count),
    color: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
  }));

  const activityData = (contactFreq ?? []).map((d) => ({
    date: d.date ? new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
    contacts: Number(d.count),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your sales pipeline at a glance</p>
          </div>
          <Button onClick={() => setLocation("/leads/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            New Lead
          </Button>
        </div>

        {/* Follow-Up Alerts */}
        {((followUpData?.overdueCount ?? 0) > 0 || (followUpData?.upcomingCount ?? 0) > 0 || (followUpData?.upcomingMeetingsCount ?? 0) > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(followUpData?.overdueCount ?? 0) > 0 && (
              <Card className="border border-red-200 dark:border-red-900 shadow-sm bg-red-50/50 dark:bg-red-950/20">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    Overdue Follow-ups ({followUpData!.overdueCount})
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/calendar")} className="gap-1 text-xs text-red-600">
                    Calendar <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-red-100 dark:divide-red-900/50">
                    {(followUpData?.overdue ?? []).slice(0, 5).map((item) => (
                      <div
                        key={item.momentId}
                        className="flex items-center justify-between px-6 py-2.5 hover:bg-red-100/50 dark:hover:bg-red-950/30 cursor-pointer transition-colors"
                        onClick={() => setLocation(item.companyName && item.leadId ? `/leads/${item.leadId}` : `/persons/${item.personId}`)}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{item.companyName || item.personName || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.subject ?? item.type}</div>
                        </div>
                        <span className="text-xs text-red-600 dark:text-red-400 shrink-0 ml-2">
                          {item.followUpAt ? formatDate(item.followUpAt) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {(followUpData?.upcomingCount ?? 0) > 0 && (
              <Card className="border border-amber-200 dark:border-amber-900 shadow-sm bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                    Upcoming Follow-ups ({followUpData!.upcomingCount})
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/calendar")} className="gap-1 text-xs text-amber-600">
                    Calendar <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-amber-100 dark:divide-amber-900/50">
                    {(followUpData?.upcoming ?? []).slice(0, 5).map((item) => (
                      <div
                        key={item.momentId}
                        className="flex items-center justify-between px-6 py-2.5 hover:bg-amber-100/50 dark:hover:bg-amber-950/30 cursor-pointer transition-colors"
                        onClick={() => setLocation(item.companyName && item.leadId ? `/leads/${item.leadId}` : `/persons/${item.personId}`)}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{item.companyName || item.personName || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.subject ?? item.type}</div>
                        </div>
                        <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0 ml-2">
                          {item.followUpAt ? formatDate(item.followUpAt) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {(followUpData?.upcomingMeetingsCount ?? 0) > 0 && (
              <Card className="border border-blue-200 dark:border-blue-900 shadow-sm bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Video className="h-4 w-4" />
                    Upcoming Meetings ({followUpData!.upcomingMeetingsCount})
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/calendar")} className="gap-1 text-xs text-blue-600">
                    Calendar <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-blue-100 dark:divide-blue-900/50">
                    {(followUpData?.upcomingMeetings ?? []).slice(0, 5).map((item) => (
                      <div
                        key={item.momentId}
                        className="flex items-center justify-between px-6 py-2.5 hover:bg-blue-100/50 dark:hover:bg-blue-950/30 cursor-pointer transition-colors"
                        onClick={() => setLocation(item.companyName && item.leadId ? `/leads/${item.leadId}` : `/persons/${item.personId}`)}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{item.companyName || item.personName || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.subject ?? "Meeting"}</div>
                        </div>
                        <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0 ml-2">
                          {item.occurredAt ? formatDate(item.occurredAt) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <div className="text-2xl font-bold">{totalLeads}</div>
              <div className="text-sm text-muted-foreground mt-1">Leads</div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-xs text-muted-foreground">Closed</span>
              </div>
              <div className="text-2xl font-bold">{wonCount}</div>
              <div className="text-sm text-muted-foreground mt-1">Won Deals</div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                </div>
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
              <div className="text-2xl font-bold">{newCount}</div>
              <div className="text-sm text-muted-foreground mt-1">New Leads</div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-xs text-muted-foreground">All time</span>
              </div>
              <div className="text-2xl font-bold">{totalMoments}</div>
              <div className="text-sm text-muted-foreground mt-1">Interactions</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pipeline Bar Chart */}
          <Card className="lg:col-span-2 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Pipeline by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              {pipelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={pipelineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value, name) => [value, name === "count" ? "Leads" : "Value"]}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  No pipeline data yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Pie */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Lead Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-2">
                    {pieData.slice(0, 4).map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="font-medium">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  No data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Chart */}
        {activityData.length > 0 && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Contact Activity (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={activityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="contacts" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Leads */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Leads</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/leads")} className="gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {(topLeads ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No leads yet</div>
              ) : (
                <div className="divide-y">
                  {(topLeads ?? []).map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/leads/${lead.id}`)}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{lead.companyName}</div>
                        <div className="text-xs text-muted-foreground truncate">{lead.contactPerson ?? "—"}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge className={`text-xs border ${STATUS_COLORS[lead.status as keyof typeof STATUS_COLORS] ?? ""}`} variant="outline">
                          {STATUS_LABELS[lead.status as keyof typeof STATUS_LABELS] ?? lead.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/activity")} className="gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {(recentActivity ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No activity yet</div>
              ) : (
                <div className="divide-y">
                  {(recentActivity ?? []).map((item) => (
                    <div key={item.moment.id} className="flex items-start gap-3 px-6 py-3">
                      <div className="p-1.5 bg-muted rounded-md mt-0.5 shrink-0">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {item.lead?.companyName ?? "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.moment.type} · {item.moment.subject ?? item.moment.notes?.slice(0, 60) ?? "No notes"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {formatRelativeTime(item.moment.occurredAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
