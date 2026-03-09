import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle,
  Clock, Phone, Mail, Users, MessageSquare, Presentation, Loader2, Bell, CheckCircle2
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CONTACT_TYPE_ICONS, formatDate } from "@/lib/crm";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

type CalEvent = {
  id: number;
  leadId: number;
  leadName: string;
  type: string;
  subject?: string | null;
  notes?: string | null;
  outcome?: string | null;
  date: Date;
  isFollowUp: boolean;
  followUpDone?: boolean;
  originalMomentId?: number;
};

const TYPE_COLORS: Record<string, string> = {
  email: "bg-blue-500",
  phone: "bg-green-500",
  meeting: "bg-purple-500",
  linkedin: "bg-sky-500",
  slack: "bg-yellow-500",
  demo: "bg-orange-500",
  proposal: "bg-pink-500",
  other: "bg-gray-500",
};

const OUTCOME_DOT: Record<string, string> = {
  positive: "bg-emerald-400",
  neutral: "bg-gray-400",
  negative: "bg-red-400",
  no_response: "bg-yellow-400",
};

function EventDot({ type }: { type: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${TYPE_COLORS[type] ?? "bg-gray-400"}`} />;
}

export default function CalendarPage() {
  const [, setLocation] = useLocation();
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [view, setView] = useState<"month" | "week">("month");

  const utils = trpc.useUtils();
  const markDoneMutation = trpc.contactMoments.update.useMutation({
    onSuccess: () => {
      utils.contactMoments.listAll.invalidate();
      utils.analytics.followUps.invalidate();
      toast.success("Follow-up marked as done");
    },
  });

  // Fetch all contact moments with follow-up dates
  const { data: allMoments, isLoading } = trpc.contactMoments.listAll.useQuery({
    limit: 500,
  });

  // Build calendar events from contact moments
  const events = useMemo<CalEvent[]>(() => {
    if (!allMoments || !Array.isArray(allMoments)) return [];
    const evts: CalEvent[] = [];
    for (const row of allMoments) {
      const m = row.moment;
      const leadName = row.lead?.companyName || (row as any).person?.name || "Unknown";
      // Actual contact moment
      evts.push({
        id: m.id,
        leadId: m.leadId,
        leadName,
        type: m.type,
        subject: m.subject,
        notes: m.notes,
        outcome: m.outcome,
        date: new Date(m.occurredAt),
        isFollowUp: false,
      });
      // Follow-up reminder
      if (m.followUpAt && !m.followUpDone) {
        evts.push({
          id: m.id * 10000 + 1,
          leadId: m.leadId,
          leadName,
          type: m.type,
          subject: `Follow-up: ${m.subject ?? leadName}`,
          notes: m.notes,
          outcome: m.outcome,
          date: new Date(m.followUpAt),
          isFollowUp: true,
          followUpDone: m.followUpDone ?? false,
          originalMomentId: m.id,
        });
      }
    }
    return evts;
  }, [allMoments]);

  // Overdue follow-ups
  const overdueFollowUps = useMemo(() =>
    events.filter((e) => e.isFollowUp && !e.followUpDone && e.date < today),
    [events]
  );

  // Upcoming follow-ups (next 7 days)
  const upcomingFollowUps = useMemo(() => {
    const next7 = new Date(today);
    next7.setDate(next7.getDate() + 7);
    return events.filter((e) => e.isFollowUp && !e.followUpDone && e.date >= today && e.date <= next7);
  }, [events]);

  // Build month grid
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthCells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) monthCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) monthCells.push(new Date(year, month, d));

  function eventsForDay(date: Date): CalEvent[] {
    return events.filter((e) => {
      const d = e.date;
      return d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate();
    });
  }

  function isToday(date: Date) {
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  }

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }

  // Week view
  const weekStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, []);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : [];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Scheduled contact moments and follow-up reminders</p>
          </div>
          <div className="flex gap-2">
            <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>Month</Button>
            <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")}>Week</Button>
          </div>
        </div>

        {/* Reminders Banner */}
        {(overdueFollowUps.length > 0 || upcomingFollowUps.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overdueFollowUps.length > 0 && (
              <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-700 dark:text-red-400 text-sm">
                        {overdueFollowUps.length} Overdue Follow-up{overdueFollowUps.length !== 1 ? "s" : ""}
                      </p>
                      <div className="mt-1 space-y-1">
                        {overdueFollowUps.slice(0, 3).map((e) => (
                          <p key={e.id} className="text-xs text-red-600 dark:text-red-300">
                            <button
                              className="hover:underline font-medium"
                              onClick={() => setLocation(`/leads/${e.leadId}`)}
                            >
                              {e.leadName}
                            </button>
                            {" — "}{e.subject} ({formatDate(e.date)})
                          </p>
                        ))}
                        {overdueFollowUps.length > 3 && (
                          <p className="text-xs text-red-500">+{overdueFollowUps.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {upcomingFollowUps.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
                        {upcomingFollowUps.length} Upcoming Follow-up{upcomingFollowUps.length !== 1 ? "s" : ""} (next 7 days)
                      </p>
                      <div className="mt-1 space-y-1">
                        {upcomingFollowUps.slice(0, 3).map((e) => (
                          <p key={e.id} className="text-xs text-amber-600 dark:text-amber-300">
                            <button
                              className="hover:underline font-medium"
                              onClick={() => setLocation(`/leads/${e.leadId}`)}
                            >
                              {e.leadName}
                            </button>
                            {" — "}{e.subject} ({formatDate(e.date)})
                          </p>
                        ))}
                        {upcomingFollowUps.length > 3 && (
                          <p className="text-xs text-amber-500">+{upcomingFollowUps.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === "month" ? (
          /* Month View */
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <CardTitle className="text-lg">{MONTHS[month]} {year}</CardTitle>
                <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b">
                {DAYS.map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
                ))}
              </div>
              {/* Calendar cells */}
              <div className="grid grid-cols-7">
                {monthCells.map((date, i) => {
                  if (!date) return <div key={`empty-${i}`} className="min-h-[90px] border-b border-r last:border-r-0 bg-muted/10" />;
                  const dayEvents = eventsForDay(date);
                  const hasOverdue = dayEvents.some((e) => e.isFollowUp && e.date < today);
                  return (
                    <div
                      key={date.toISOString()}
                      className={`min-h-[90px] border-b border-r last:border-r-0 p-1.5 cursor-pointer transition-colors hover:bg-muted/30 ${
                        isToday(date) ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
                      } ${hasOverdue ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}
                      onClick={() => setSelectedDay(date)}
                    >
                      <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday(date) ? "bg-primary text-primary-foreground" : "text-foreground"
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className={`flex items-center gap-1 px-1 py-0.5 rounded text-xs truncate ${
                              e.isFollowUp
                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            <EventDot type={e.type} />
                            <span className="truncate">{e.leadName}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Week View */
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Week of {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b">
                {weekDays.map((d) => (
                  <div
                    key={d.toISOString()}
                    className={`py-3 text-center border-r last:border-r-0 cursor-pointer hover:bg-muted/30 ${
                      isToday(d) ? "bg-primary/5" : ""
                    }`}
                    onClick={() => setSelectedDay(d)}
                  >
                    <div className="text-xs text-muted-foreground">{DAYS[d.getDay()]}</div>
                    <div className={`text-sm font-semibold mt-0.5 mx-auto w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday(d) ? "bg-primary text-primary-foreground" : ""
                    }`}>
                      {d.getDate()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-h-[300px]">
                {weekDays.map((d) => {
                  const dayEvents = eventsForDay(d);
                  return (
                    <div
                      key={d.toISOString()}
                      className="border-r last:border-r-0 p-2 space-y-1 cursor-pointer hover:bg-muted/10"
                      onClick={() => setSelectedDay(d)}
                    >
                      {dayEvents.map((e) => (
                        <div
                          key={e.id}
                          className={`p-1.5 rounded text-xs ${
                            e.isFollowUp
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/50"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <EventDot type={e.type} />
                            <span className="font-medium truncate">{e.leadName}</span>
                          </div>
                          {e.subject && <div className="truncate mt-0.5 opacity-70">{e.subject}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Day Detail Dialog */}
        <Dialog open={!!selectedDay} onOpenChange={(o) => { if (!o) setSelectedDay(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDay?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </DialogTitle>
            </DialogHeader>
            {selectedDayEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No events on this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((e) => (
                  <div
                    key={e.id}
                    className={`p-3 rounded-lg border ${
                      e.isFollowUp
                        ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50"
                        : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <EventDot type={e.type} />
                        <div>
                          <div className="font-medium text-sm">
                            <button
                              className="hover:underline"
                              onClick={() => { setSelectedDay(null); setLocation(`/leads/${e.leadId}`); }}
                            >
                              {e.leadName}
                            </button>
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">{e.type}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {e.isFollowUp && (
                          <>
                            <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">
                              Follow-up
                            </Badge>
                            {e.originalMomentId && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs gap-1"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  markDoneMutation.mutate({
                                    id: e.originalMomentId!,
                                    data: { followUpDone: true },
                                  });
                                }}
                                disabled={markDoneMutation.isPending}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Done
                              </Button>
                            )}
                          </>
                        )}
                        {e.outcome && (
                          <span className={`w-2 h-2 rounded-full ${OUTCOME_DOT[e.outcome] ?? "bg-gray-400"}`} title={e.outcome} />
                        )}
                      </div>
                    </div>
                    {e.subject && <p className="text-sm mt-1.5 font-medium">{e.subject}</p>}
                    {e.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{e.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {e.date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
