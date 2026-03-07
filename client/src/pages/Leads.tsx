import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Filter, Building2, ChevronLeft, ChevronRight, ExternalLink, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, ALL_STATUSES, ALL_PRIORITIES, formatRelativeTime, getInitials
} from "@/lib/crm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const PAGE_SIZE = 20;

export default function Leads() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data, isLoading } = trpc.leads.list.useQuery({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    priority: priority === "all" ? undefined : priority,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leads</h1>
            <p className="text-sm text-muted-foreground">{total} total leads</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/import")} className="gap-2">
              <Filter className="h-4 w-4" />
              Import
            </Button>
            <Button onClick={() => setLocation("/leads/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company, contact, email..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {ALL_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[280px]">Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="w-[90px]">
                    <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Score</span>
                  </TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last Contact</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No leads found</p>
                      {search && <p className="text-sm mt-1">Try adjusting your search</p>}
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setLocation(`/leads/${lead.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                              {getInitials(lead.companyName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate max-w-[180px]">{lead.companyName}</div>
                            {lead.website && (
                              <div className="text-xs text-muted-foreground truncate max-w-[180px]">{lead.website}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{lead.contactPerson ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{lead.email ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs border ${STATUS_COLORS[lead.status as keyof typeof STATUS_COLORS] ?? ""}`}
                          variant="outline"
                        >
                          {STATUS_LABELS[lead.status as keyof typeof STATUS_LABELS] ?? lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs border capitalize ${PRIORITY_COLORS[lead.priority as keyof typeof PRIORITY_COLORS] ?? ""}`}
                          variant="outline"
                        >
                          {lead.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(lead as any).priorityScore != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  (lead as any).priorityScore >= 70 ? "bg-emerald-500" :
                                  (lead as any).priorityScore >= 40 ? "bg-amber-500" : "bg-red-400"
                                }`}
                                style={{ width: `${Math.min(100, (lead as any).priorityScore)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium tabular-nums">{(lead as any).priorityScore}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground capitalize">{lead.source ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(lead.lastContactedAt)}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/leads/${lead.id}`); }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20">
              <span className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
