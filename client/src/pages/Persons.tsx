import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, Search, Plus, Linkedin, Mail, Phone, Building2,
  ExternalLink, Tag, Clock, Link2, UserPlus, Trash2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/crm";

const PERSON_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  prospect:   { label: "Prospect",   color: "text-slate-700",  bg: "bg-slate-100" },
  contact:    { label: "Contact",    color: "text-blue-700",   bg: "bg-blue-100" },
  partner:    { label: "Partner",    color: "text-green-700",  bg: "bg-green-100" },
  reseller:   { label: "Reseller",   color: "text-purple-700", bg: "bg-purple-100" },
  influencer: { label: "Influencer", color: "text-orange-700", bg: "bg-orange-100" },
  investor:   { label: "Investor",   color: "text-yellow-700", bg: "bg-yellow-100" },
  other:      { label: "Other",      color: "text-gray-700",   bg: "bg-gray-100" },
};

function PersonTypeBadge({ type }: { type: string }) {
  const cfg = PERSON_TYPE_CONFIG[type] ?? PERSON_TYPE_CONFIG.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function AddPersonDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [personType, setPersonType] = useState("prospect");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("linkedin");

  // LinkedIn AI import state
  const [linkedInImportUrl, setLinkedInImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ fetchedProfile: boolean; pageTextLength: number } | null>(null);

  const createMutation = trpc.persons.create.useMutation({
    onSuccess: () => {
      toast.success(`${name} added to your network`);
      setOpen(false);
      resetForm();
      onSuccess();
    },
    onError: () => toast.error("Failed to add person"),
  });

  function resetForm() {
    setName(""); setEmail(""); setPhone(""); setLinkedInUrl("");
    setPersonType("prospect"); setCompany(""); setTitle(""); setNotes("");
    setSource("linkedin"); setLinkedInImportUrl(""); setImportResult(null);
  }

  async function handleLinkedInImport() {
    const url = linkedInImportUrl.trim();
    if (!url || !url.includes("linkedin.com")) {
      toast.error("Please enter a valid LinkedIn profile URL");
      return;
    }
    setIsImporting(true);
    try {
      const resp = await fetch("/api/linkedin-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await resp.json() as { success?: boolean; data?: Record<string, string | null>; error?: string };
      if (!json.success || !json.data) {
        toast.error(json.error ?? "Import failed — please fill in details manually");
        return;
      }
      const d = json.data;
      if (d.name)       setName(d.name);
      if (d.title)      setTitle(d.title);
      if (d.company)    setCompany(d.company);
      if (d.email)      setEmail(d.email);
      if (d.phone)      setPhone(d.phone);
      if (d.personType) setPersonType(d.personType);
      if (d.linkedInUrl) setLinkedInUrl(d.linkedInUrl);
      if (d.summary)    setNotes((prev) => prev ? prev : d.summary ?? "");
      setSource("linkedin");
      setImportResult({ fetchedProfile: d.fetchedProfile === "true" || (d as any).fetchedProfile === true, pageTextLength: Number(d.pageTextLength ?? 0) });
      if ((d as any).fetchedProfile) {
        toast.success("Profile imported — please review and edit the pre-filled fields");
      } else {
        toast.warning("LinkedIn requires login to view full profiles. Fields pre-filled from URL — please complete manually.");
      }
    } catch {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Person
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Person to Network
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* LinkedIn AI Import section */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5 text-blue-800">
              <Linkedin className="h-3.5 w-3.5" />
              Import from LinkedIn
            </Label>
            <div className="flex gap-2">
              <Input
                value={linkedInImportUrl}
                onChange={(e) => setLinkedInImportUrl(e.target.value)}
                placeholder="https://linkedin.com/in/firstname-lastname"
                className="text-sm bg-white"
                onKeyDown={(e) => e.key === "Enter" && handleLinkedInImport()}
              />
              <Button
                size="sm"
                variant="default"
                className="shrink-0 bg-blue-600 hover:bg-blue-700"
                disabled={!linkedInImportUrl.trim() || isImporting}
                onClick={handleLinkedInImport}
              >
                {isImporting ? (
                  <span className="flex items-center gap-1"><span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />Importing...</span>
                ) : "Import"}
              </Button>
            </div>
            {importResult && (
              <p className="text-xs text-blue-700">
                {importResult.fetchedProfile
                  ? `✓ Profile fetched (${importResult.pageTextLength} chars) — fields pre-filled below. Review and edit before saving.`
                  : "⚠️ LinkedIn requires login for full profiles. URL-based hints applied — please complete fields manually."}
              </p>
            )}
            <p className="text-xs text-blue-600 opacity-75">Paste a LinkedIn profile URL and click Import to auto-fill the form using AI.</p>
          </div>

          {/* Manual LinkedIn URL field */}
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5">
              <Linkedin className="h-3.5 w-3.5 text-blue-600" />
              LinkedIn Profile URL
            </Label>
            <Input
              value={linkedInUrl}
              onChange={(e) => setLinkedInUrl(e.target.value)}
              placeholder="https://linkedin.com/in/firstname-lastname"
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Full Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Person Type</Label>
              <Select value={personType} onValueChange={setPersonType}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERSON_TYPE_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Title / Role</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Head of Events"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Company / Organisation</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Royal Welsh Show"
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 900000"
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">How did you find them?</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="event">Event / Conference</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="manual">Manual entry</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why is this person interesting? What did you discuss?"
              className="text-sm min-h-[70px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name: name.trim(),
                  email: email || undefined,
                  phone: phone || undefined,
                  linkedInUrl: linkedInUrl || undefined,
                  personType: personType as any,
                  company: company || undefined,
                  title: title || undefined,
                  notes: notes || undefined,
                  source,
                })
              }
            >
              {createMutation.isPending ? "Adding..." : "Add to Network"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PersonsPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [personType, setPersonType] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data, isLoading, refetch } = trpc.persons.list.useQuery({
    search: debouncedSearch || undefined,
    personType: personType !== "all" ? personType : undefined,
    limit: 100,
  });

  const persons = data?.persons ?? [];
  const total = data?.total ?? 0;

  const bulkDeleteMutation = trpc.persons.bulkDelete.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.deleted} person${result.deleted > 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      refetch();
    },
    onError: () => toast.error("Failed to delete persons"),
  });

  const allSelected = persons.length > 0 && persons.every((p) => selectedIds.has(p.id));
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
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        persons.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        persons.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout((window as any)._personSearchTimer);
    (window as any)._personSearchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              People
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              LinkedIn contacts, partners, resellers, and other people in your network
            </p>
          </div>
          <AddPersonDialog onSuccess={refetch} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(PERSON_TYPE_CONFIG).slice(0, 4).map(([type, cfg]) => {
            const count = persons.filter((p) => p.personType === type).length;
            return (
              <Card key={type} className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}s</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, company, email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={personType} onValueChange={setPersonType}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(PERSON_TYPE_CONFIG).map(([val, cfg]) => (
                <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection bar */}
        {someSelected && (
          <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
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
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
            ) : persons.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No people yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add LinkedIn contacts, partners, and resellers to your network
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected && persons.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-semibold">Person</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold">Company</TableHead>
                    <TableHead className="text-xs font-semibold">Contact</TableHead>
                    <TableHead className="text-xs font-semibold">Last Contact</TableHead>
                    <TableHead className="text-xs font-semibold">Source</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {persons.map((person) => (
                    <TableRow
                      key={person.id}
                      className={`cursor-pointer hover:bg-muted/40 transition-colors ${selectedIds.has(person.id) ? "bg-primary/5" : ""}`}
                      onClick={() => navigate(`/persons/${person.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(person.id)}
                          onCheckedChange={() => toggleSelect(person.id)}
                          aria-label={`Select ${person.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {getInitials(person.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{person.name}</div>
                            {person.title && (
                              <div className="text-xs text-muted-foreground">{person.title}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PersonTypeBadge type={person.personType} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {person.company ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {person.email && (
                            <a
                              href={`mailto:${person.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {person.phone && (
                            <a
                              href={`tel:${person.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {person.linkedInUrl && (
                            <a
                              href={person.linkedInUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <Linkedin className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {person.lastContactedAt
                            ? formatRelativeTime(person.lastContactedAt)
                            : "Never"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground capitalize">
                          {person.source ?? "manual"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {total > persons.length && (
          <p className="text-xs text-muted-foreground text-center">
            Showing {persons.length} of {total} people
          </p>
        )}

        {/* Delete confirmation */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} person{selectedIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the selected person{selectedIds.size > 1 ? "s" : ""} and all associated data (lead links, contact moments, etc.). This action cannot be undone.
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
