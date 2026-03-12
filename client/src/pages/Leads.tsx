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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, Filter, Building2, ChevronLeft, ChevronRight, ExternalLink, TrendingUp, Trash2, Loader2, Tag, UserCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, ALL_STATUSES, ALL_PRIORITIES, formatRelativeTime, getInitials
} from "@/lib/crm";
import { getLeadTypeOptions, LEAD_TYPE_SCHEMAS } from "@shared/leadAttributeSchemas";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const PAGE_SIZE = 20;
const leadTypeOptions = getLeadTypeOptions();

export default function Leads() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");
  const [leadType, setLeadType] = useState<string>("all");
  const [label, setLabel] = useState<string>("all");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkLabelOpen, setBulkLabelOpen] = useState(false);
  const [bulkLabelValue, setBulkLabelValue] = useState("");
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [sizeFilter, setSizeFilter] = useState<string>("all");

  const { data: userList } = trpc.auth.listUsers.useQuery();
  const users = userList ?? [];

  const { data, isLoading, refetch } = trpc.leads.list.useQuery({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    priority: priority === "all" ? undefined : priority,
    country: country === "all" ? undefined : country,
    leadType: leadType === "all" ? undefined : leadType,
    label: label === "all" ? undefined : label,
    assignedTo: assignedToFilter === "all" ? undefined : Number(assignedToFilter),
    sizeMin: sizeFilter === "small" ? undefined : sizeFilter === "medium" ? 100 : sizeFilter === "large" ? 1000 : sizeFilter === "xl" ? 10000 : undefined,
    sizeMax: sizeFilter === "small" ? 99 : sizeFilter === "medium" ? 999 : sizeFilter === "large" ? 9999 : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  // Fetch all leads (without filters) to extract distinct countries for the filter dropdown
  const { data: allLeadsData } = trpc.leads.list.useQuery({ limit: 1000 });
  const countries = Array.from(
    new Set((allLeadsData?.items ?? []).map((l) => l.country?.trim()).filter(Boolean) as string[])
  ).sort();
  const labels = Array.from(
    new Set((allLeadsData?.items ?? []).map((l) => ((l as any).label as string | null)?.trim()).filter(Boolean) as string[])
  ).sort();

  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const bulkDeleteMutation = trpc.leads.bulkDelete.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.deleted} lead${result.deleted > 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      refetch();
    },
    onError: () => toast.error("Failed to delete leads"),
  });

  const bulkAssignMutation = trpc.leads.bulkUpdateAssignedTo.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.updated} lead${result.updated > 1 ? "s" : ""} reassigned`);
      setSelectedIds(new Set());
      setBulkAssignOpen(false);
      refetch();
    },
    onError: () => toast.error("Failed to reassign leads"),
  });

  const bulkLabelMutation = trpc.leads.bulkUpdateLabel.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.updated} lead${result.updated > 1 ? "s" : ""} updated`);
      setSelectedIds(new Set());
      setBulkLabelOpen(false);
      setBulkLabelValue("");
      refetch();
    },
    onError: () => toast.error("Failed to update labels"),
  });

  const allOnPageSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        leads.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        leads.forEach((l) => next.add(l.id));
        return next;
      });
    }
  }

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
              <Select value={leadType} onValueChange={(v) => { setLeadType(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All Lead Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lead Types</SelectItem>
                  {leadTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {countries.length > 0 && (
                <Select value={country} onValueChange={(v) => { setCountry(v); setPage(0); }}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={label} onValueChange={(v) => { setLabel(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All Labels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Labels</SelectItem>
                  {labels.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assignedToFilter} onValueChange={(v) => { setAssignedToFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sizeFilter} onValueChange={(v) => { setSizeFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Sizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  <SelectItem value="small">Small (&lt; 100)</SelectItem>
                  <SelectItem value="medium">Medium (100-1K)</SelectItem>
                  <SelectItem value="large">Large (1K-10K)</SelectItem>
                  <SelectItem value="xl">XL (10K+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Selection bar */}
        {someSelected && (
          <div className="flex items-center gap-3 px-4 py-2 bg-muted border rounded-lg">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Popover open={bulkLabelOpen} onOpenChange={setBulkLabelOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Set Label
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Assign label to {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""}</div>
                  <Input
                    value={bulkLabelValue}
                    onChange={(e) => setBulkLabelValue(e.target.value)}
                    placeholder="Type label or leave empty to clear"
                    className="text-sm"
                    list="bulk-label-suggestions"
                    autoFocus
                  />
                  <datalist id="bulk-label-suggestions">
                    {labels.map((l) => (
                      <option key={l} value={l} />
                    ))}
                  </datalist>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setBulkLabelOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={bulkLabelMutation.isPending}
                      onClick={() => bulkLabelMutation.mutate({ ids: Array.from(selectedIds), label: bulkLabelValue.trim() })}
                    >
                      {bulkLabelMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Popover open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <UserCircle className="h-3.5 w-3.5" />
                  Assign
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="start">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Assign owner</div>
                  {users.map((u) => (
                    <Button
                      key={u.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-sm"
                      disabled={bulkAssignMutation.isPending}
                      onClick={() => bulkAssignMutation.mutate({ ids: Array.from(selectedIds), assignedTo: u.id })}
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                          {getInitials(u.name || u.email || "?")}
                        </AvatarFallback>
                      </Avatar>
                      {u.name || u.email}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm text-muted-foreground"
                    disabled={bulkAssignMutation.isPending}
                    onClick={() => bulkAssignMutation.mutate({ ids: Array.from(selectedIds), assignedTo: null })}
                  >
                    Unassign
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        {/* Table */}
        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allOnPageSelected && leads.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-[280px]">Company</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="w-[90px]">
                    <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Score</span>
                  </TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last Contact</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 13 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-16 text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No leads found</p>
                      {search && <p className="text-sm mt-1">Try adjusting your search</p>}
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className={`cursor-pointer hover:bg-muted/30 transition-colors ${selectedIds.has(lead.id) ? "bg-primary/5" : ""}`}
                      onClick={() => setLocation(`/leads/${lead.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                          aria-label={`Select ${lead.companyName}`}
                        />
                      </TableCell>
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
                        {(() => {
                          const owner = lead.assignedTo ? users.find((u) => u.id === lead.assignedTo) : null;
                          return owner ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                                  {getInitials(owner.name || owner.email || "?")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs truncate max-w-[80px]">{owner.name || owner.email}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          );
                        })()}
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
                        {(lead as any).leadSize != null ? (
                          <div className="text-xs font-medium tabular-nums">
                            {(lead as any).leadSize >= 1000
                              ? `${((lead as any).leadSize / 1000).toFixed((lead as any).leadSize >= 10000 ? 0 : 1)}K`
                              : (lead as any).leadSize}
                            <span className="text-muted-foreground ml-1">
                              {LEAD_TYPE_SCHEMAS[lead.leadType]?.sizeUnit ?? ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(lead as any).label ? (
                          <Badge variant="secondary" className="text-xs">{(lead as any).label}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {LEAD_TYPE_SCHEMAS[lead.leadType] ? (
                          <Badge variant="outline" className={`text-xs border ${LEAD_TYPE_SCHEMAS[lead.leadType].color}`}>
                            {LEAD_TYPE_SCHEMAS[lead.leadType].label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{lead.country ?? "—"}</span>
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
        {/* Delete confirmation */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the selected lead{selectedIds.size > 1 ? "s" : ""} and all associated data (contact moments, documents, persons links, competitor links, etc.). This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => {
                  bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) });
                  setDeleteConfirmOpen(false);
                }}
              >
                {bulkDeleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
