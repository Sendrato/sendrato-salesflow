import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, Edit, Plus, Globe, Mail, Phone, Building2, Tag, Clock, FileText,
  Sparkles, Loader2, Upload, Trash2, ExternalLink, MessageSquare, Calendar,
  Share2, Link, CheckCircle2, BookOpen, FileSpreadsheet, FileCode, Copy, Eye,
  Users, UserPlus, Unlink as UnlinkIcon, Linkedin, Swords, MoreVertical, Merge, Search,
  ChevronRight, Check, PauseCircle, XCircle, CalendarRange, MapPin, Pencil, UserCircle,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, CONTACT_TYPE_ICONS, OUTCOME_COLORS,
  ALL_STATUSES, ALL_PRIORITIES, ALL_CONTACT_TYPES, ALL_OUTCOMES, formatDate, formatRelativeTime, getInitials
} from "@/lib/crm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import EmailBody from "@/components/EmailBody";
import RichNotes from "@/components/RichNotes";
import { Markdown } from "@/components/Markdown";
import { LeadAttributeEditor } from "@/components/LeadAttributeEditor";
import WebLinksCard from "@/components/WebLinksCard";
import { getPromotorEventFields } from "@shared/leadAttributeSchemas";

/** Convert plain newlines to markdown line breaks (two trailing spaces) */
function mdBreaks(text: string): string {
  return text.replace(/\n/g, "  \n");
}

function EditableMomentDate({ moment, leadId }: { moment: { id: number; occurredAt: string | Date }; leadId: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const submitting = useRef(false);
  const utils = trpc.useUtils();
  const updateMutation = trpc.contactMoments.update.useMutation({
    onSuccess: () => {
      submitting.current = false;
      utils.contactMoments.list.invalidate({ leadId });
      setEditing(false);
      toast.success("Date updated");
    },
    onError: () => { submitting.current = false; toast.error("Failed to update date"); },
  });

  const submit = () => {
    if (submitting.current || !value) { setEditing(false); return; }
    submitting.current = true;
    updateMutation.mutate({ id: moment.id, data: { occurredAt: value } });
  };

  if (editing) {
    return (
      <Input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") setEditing(false);
        }}
        className="h-6 w-44 text-xs px-1"
        autoFocus
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(new Date(moment.occurredAt).toISOString().slice(0, 16));
        setEditing(true);
      }}
      className="text-xs text-muted-foreground hover:text-primary hover:underline cursor-pointer"
      title="Click to edit date"
    >
      {formatRelativeTime(moment.occurredAt)}
    </button>
  );
}

function ContactMomentForm({ leadId, onSuccess }: { leadId: number; onSuccess: () => void }) {
  const [type, setType] = useState("email");
  const [direction, setDirection] = useState("outbound");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("neutral");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [followUpAt, setFollowUpAt] = useState("");

  const utils = trpc.useUtils();
  const createMutation = trpc.contactMoments.create.useMutation({
    onSuccess: () => {
      utils.contactMoments.list.invalidate({ leadId });
      utils.analytics.recentActivity.invalidate();
      onSuccess();
      toast.success("Contact moment logged");
    },
    onError: () => toast.error("Failed to log contact moment"),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_CONTACT_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {CONTACT_TYPE_ICONS[t as keyof typeof CONTACT_TYPE_ICONS]} {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Direction</Label>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="outbound">Outbound</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Subject</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Follow-up call about proposal" />
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened? Key takeaways..." rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Outcome</Label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_OUTCOMES.map((o) => (
                <SelectItem key={o} value={o} className="capitalize">{o.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Date & Time</Label>
          <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id="scheduleFollowUp"
            checked={!!followUpAt}
            onCheckedChange={(checked) => {
              if (checked) {
                const d = new Date(occurredAt);
                d.setDate(d.getDate() + 3);
                setFollowUpAt(d.toISOString().slice(0, 16));
              } else {
                setFollowUpAt("");
              }
            }}
          />
          <Label htmlFor="scheduleFollowUp" className="cursor-pointer text-sm font-normal">Schedule follow-up</Label>
        </div>
        {followUpAt && (
          <Input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
        )}
      </div>
      <Button
        className="w-full"
        onClick={() => createMutation.mutate({ leadId, type: type as any, direction: direction as any, subject, notes, outcome: outcome as any, occurredAt, followUpAt: followUpAt || undefined })}
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Log Interaction
      </Button>
    </div>
  );
}

function getDocIcon(mimeType?: string | null, fileName?: string) {
  const m = (mimeType ?? "").toLowerCase();
  const n = (fileName ?? "").toLowerCase();
  if (m === "text/html" || n.endsWith(".html") || n.endsWith(".htm")) return <FileCode className="h-4 w-4 text-orange-400 shrink-0" />;
  if (m === "application/pdf" || n.endsWith(".pdf")) return <FileText className="h-4 w-4 text-red-400 shrink-0" />;
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || m.includes("spreadsheet") || m.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-green-400 shrink-0" />;
  if (n.endsWith(".docx") || n.endsWith(".doc") || m.includes("word")) return <BookOpen className="h-4 w-4 text-blue-400 shrink-0" />;
  return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
}

export default function LeadDetail() {
  const params = useParams<{ id: string }>();
  const leadId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const [logOpen, setLogOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [linkPersonOpen, setLinkPersonOpen] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
  const [linkingPersonId, setLinkingPersonId] = useState<number | null>(null);
  const [linkRelationship, setLinkRelationship] = useState("contact_at");
  const [linkCompetitorOpen, setLinkCompetitorOpen] = useState(false);
  const [competitorSearch, setCompetitorSearch] = useState("");
  const [linkingCompetitorId, setLinkingCompetitorId] = useState<number | null>(null);
  const [compProduct, setCompProduct] = useState("");
  const [compContractStart, setCompContractStart] = useState("");
  const [compContractEnd, setCompContractEnd] = useState("");
  const [compSatisfaction, setCompSatisfaction] = useState("neutral");
  const [compLikes, setCompLikes] = useState("");
  const [compDislikes, setCompDislikes] = useState("");
  const [uploadCategory, setUploadCategory] = useState<"proposal"|"contract"|"presentation"|"report"|"other">("other");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [shareDialogDoc, setShareDialogDoc] = useState<any>(null);
  const [shareTitle, setShareTitle] = useState("");
  const [shareRecordMoment, setShareRecordMoment] = useState(true);
  const [shareNotes, setShareNotes] = useState("");
  const [sharing, setSharing] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Promotor Events state
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventName, setEventName] = useState("");
  const [eventAttributes, setEventAttributes] = useState<Record<string, unknown>>({});
  const [eventNotes, setEventNotes] = useState("");

  const [labelEditing, setLabelEditing] = useState(false);
  const [labelValue, setLabelValue] = useState("");

  const { data: lead, isLoading, refetch } = trpc.leads.get.useQuery({ id: leadId });
  const { data: moments } = trpc.contactMoments.list.useQuery({ leadId });
  const { data: documents } = trpc.documents.list.useQuery({ leadId });
  const { data: shares, refetch: refetchShares } = trpc.documents.listShares.useQuery({ leadId });
  const { data: linkedPersons, refetch: refetchPersons } = trpc.persons.getPersonsForLead.useQuery({ leadId });
  const { data: allPersons } = trpc.persons.list.useQuery({ search: personSearch, limit: 20 });
  const { data: linkedCompetitors, refetch: refetchCompetitors } = trpc.competitors.getCompetitorsForLead.useQuery({ leadId });
  const { data: allCompetitors } = trpc.competitors.list.useQuery({ search: competitorSearch, limit: 20 });
  const { data: allLeadsForLabels } = trpc.leads.list.useQuery({ limit: 1000 });
  const existingLabels = Array.from(
    new Set((allLeadsForLabels?.items ?? []).map((l) => (l as any).label).filter(Boolean) as string[])
  ).sort();
  const { data: userList } = trpc.auth.listUsers.useQuery();
  const users = userList ?? [];
  const assignedUser = lead?.assignedTo ? users.find((u) => u.id === lead.assignedTo) : null;
  const isEventPromotor = (lead as any)?.leadType === "event_promotor";
  const { data: promotorEventsList, refetch: refetchPromotorEvents } = trpc.promotorEvents.list.useQuery(
    { leadId },
    { enabled: isEventPromotor }
  );
  const utils = trpc.useUtils();

  const linkPersonMutation = trpc.persons.linkToLead.useMutation({
    onSuccess: () => {
      refetchPersons();
      setLinkPersonOpen(false);
      setPersonSearch("");
      setLinkingPersonId(null);
      toast.success("Person linked to lead");
    },
    onError: () => toast.error("Failed to link person"),
  });

  const unlinkPersonMutation = trpc.persons.unlinkFromLead.useMutation({
    onSuccess: () => { refetchPersons(); toast.success("Person unlinked"); },
    onError: () => toast.error("Failed to unlink person"),
  });

  const linkCompetitorMutation = trpc.competitors.linkToLead.useMutation({
    onSuccess: () => {
      refetchCompetitors();
      setLinkCompetitorOpen(false);
      setCompetitorSearch("");
      setLinkingCompetitorId(null);
      setCompProduct(""); setCompContractStart(""); setCompContractEnd("");
      setCompSatisfaction("neutral"); setCompLikes(""); setCompDislikes("");
      toast.success("Competitor linked to lead");
    },
    onError: () => toast.error("Failed to link competitor"),
  });

  const unlinkCompetitorMutation = trpc.competitors.unlinkFromLead.useMutation({
    onSuccess: () => { refetchCompetitors(); toast.success("Competitor unlinked"); },
    onError: () => toast.error("Failed to unlink competitor"),
  });

  const resetEventForm = () => { setEventName(""); setEventAttributes({}); setEventNotes(""); };

  const createEventMutation = trpc.promotorEvents.create.useMutation({
    onSuccess: () => {
      refetchPromotorEvents();
      setAddEventOpen(false);
      resetEventForm();
      toast.success("Event added");
    },
    onError: () => toast.error("Failed to add event"),
  });

  const updateEventMutation = trpc.promotorEvents.update.useMutation({
    onSuccess: () => {
      refetchPromotorEvents();
      setEditingEvent(null);
      resetEventForm();
      toast.success("Event updated");
    },
    onError: () => toast.error("Failed to update event"),
  });

  const deleteEventMutation = trpc.promotorEvents.delete.useMutation({
    onSuccess: () => { refetchPromotorEvents(); toast.success("Event deleted"); },
    onError: () => toast.error("Failed to delete event"),
  });

  const toggleFollowUpMutation = trpc.contactMoments.update.useMutation({
    onSuccess: () => {
      utils.contactMoments.list.invalidate({ leadId });
      utils.analytics.followUps.invalidate();
    },
  });

  const deleteMomentMutation = trpc.contactMoments.delete.useMutation({
    onSuccess: () => {
      utils.contactMoments.list.invalidate({ leadId });
      toast.success("Interaction deleted");
    },
    onError: () => toast.error("Failed to delete interaction"),
  });

  const updateLeadMutation = trpc.leads.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Lead updated"); },
    onError: () => toast.error("Failed to update lead"),
  });

  const deleteDocMutation = trpc.documents.delete.useMutation({
    onSuccess: () => { utils.documents.list.invalidate({ leadId }); toast.success("Document removed"); },
  });

  const deactivateShareMutation = trpc.documents.deactivateShare.useMutation({
    onSuccess: () => { refetchShares(); toast.success("Share link deactivated"); },
  });

  const deleteLeadMutation = trpc.leads.delete.useMutation({
    onSuccess: () => { toast.success("Lead deleted"); setLocation("/leads"); },
    onError: () => toast.error("Failed to delete lead"),
  });

  const mergeLeadMutation = trpc.leads.merge.useMutation({
    onSuccess: (result) => {
      toast.success("Leads merged successfully");
      setMergeOpen(false);
      setLocation(`/leads/${result?.id ?? mergeTargetId}`);
    },
    onError: () => toast.error("Failed to merge leads"),
  });

  const { data: mergeSearchResults } = trpc.leads.list.useQuery(
    { search: mergeSearch, limit: 10 },
    { enabled: mergeOpen && mergeSearch.length >= 2 },
  );

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("leadId", String(leadId));
    formData.append("category", uploadCategory);
    try {
      const res = await fetch("/api/upload-document", { method: "POST", body: formData });
      if (res.ok) {
        utils.documents.list.invalidate({ leadId });
        toast.success(`"${file.name}" uploaded and indexed for AI search`);
      } else {
        toast.error("Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [leadId, uploadCategory, utils]);

  const handleShare = async () => {
    if (!shareDialogDoc) return;
    setSharing(true);
    try {
      const res = await fetch("/api/share-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: shareDialogDoc.id,
          leadId,
          title: shareTitle || shareDialogDoc.fileName,
          recordContactMoment: shareRecordMoment,
          notes: shareNotes,
        }),
      });
      if (res.ok) {
        const { shareUrl } = await res.json();
        setSharedUrl(shareUrl);
        refetchShares();
        if (shareRecordMoment) utils.contactMoments.list.invalidate({ leadId });
        toast.success("Share link created!");
      } else {
        toast.error("Failed to create share link");
      }
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setSharing(false);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/enrich-lead/${leadId}`, { method: "POST" });
      if (res.ok) {
        await refetch();
        toast.success("Lead enriched with AI insights!");
      } else {
        toast.error("Enrichment failed");
      }
    } catch {
      toast.error("Enrichment failed");
    } finally {
      setEnriching(false);
    }
  };



  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 text-muted-foreground">Lead not found</div>
      </DashboardLayout>
    );
  }

  const enrichment = lead.enrichmentData as Record<string, unknown> | null;

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-5xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/leads")} className="gap-1 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Leads
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{lead.companyName}</span>
        </div>

        {/* Header Card */}
        <Card className="border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 border-2 border-border">
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                    {getInitials(lead.companyName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-bold">{lead.companyName}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge className={`text-xs border ${STATUS_COLORS[lead.status as keyof typeof STATUS_COLORS] ?? ""}`} variant="outline">
                      {STATUS_LABELS[lead.status as keyof typeof STATUS_LABELS] ?? lead.status}
                    </Badge>
                    <Badge className={`text-xs border capitalize ${PRIORITY_COLORS[lead.priority as keyof typeof PRIORITY_COLORS] ?? ""}`} variant="outline">
                      {lead.priority} priority
                    </Badge>
                    {(lead as any).priorityScore != null && (
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">Score:</span>
                        <span className={`font-semibold ${
                          (lead as any).priorityScore >= 70 ? "text-emerald-600" :
                          (lead as any).priorityScore >= 40 ? "text-amber-600" : "text-red-500"
                        }`}>{(lead as any).priorityScore}/100</span>
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (lead as any).priorityScore >= 70 ? "bg-emerald-500" :
                              (lead as any).priorityScore >= 40 ? "bg-amber-500" : "bg-red-400"
                            }`}
                            style={{ width: `${Math.min(100, (lead as any).priorityScore)}%` }}
                          />
                        </div>
                      </span>
                    )}
                    {lead.source && (
                      <span className="text-xs text-muted-foreground">via {lead.source}</span>
                    )}
                    {/* Label / Group */}
                    {labelEditing ? (
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={labelValue}
                          onChange={(e) => setLabelValue(e.target.value)}
                          onBlur={() => {
                            const trimmed = labelValue.trim();
                            updateLeadMutation.mutate(
                              { id: leadId, data: { label: trimmed || undefined } },
                              { onSettled: () => setLabelEditing(false) }
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setLabelEditing(false);
                          }}
                          placeholder="Type label..."
                          className="h-6 w-32 text-xs px-2"
                          autoFocus
                          list="label-suggestions"
                        />
                        <datalist id="label-suggestions">
                          {existingLabels.map((l) => (
                            <option key={l} value={l} />
                          ))}
                        </datalist>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setLabelValue((lead as any).label ?? ""); setLabelEditing(true); }}
                        className="flex items-center gap-1 text-xs hover:text-primary transition-colors cursor-pointer"
                        title="Click to set label"
                      >
                        <Tag className="h-3 w-3" />
                        {(lead as any).label ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{(lead as any).label}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Add label</span>
                        )}
                      </button>
                    )}
                    {/* Owner / Assigned To */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs hover:text-primary transition-colors cursor-pointer"
                          title="Click to assign owner"
                        >
                          <UserCircle className="h-3 w-3" />
                          {assignedUser ? (
                            <span className="font-medium">{assignedUser.name || assignedUser.email}</span>
                          ) : (
                            <span className="text-muted-foreground">Assign owner</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2" align="start">
                        {users.map((u) => (
                          <Button
                            key={u.id}
                            variant={lead.assignedTo === u.id ? "secondary" : "ghost"}
                            size="sm"
                            className="w-full justify-start gap-2 text-sm"
                            onClick={() => updateLeadMutation.mutate({ id: leadId, data: { assignedTo: u.id } })}
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                                {getInitials(u.name || u.email || "?")}
                              </AvatarFallback>
                            </Avatar>
                            {u.name || u.email}
                          </Button>
                        ))}
                        {lead.assignedTo && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-sm text-muted-foreground mt-1"
                            onClick={() => updateLeadMutation.mutate({ id: leadId, data: { assignedTo: null as any } })}
                          >
                            Unassign
                          </Button>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                    {lead.website && (
                      <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                        <Globe className="h-3.5 w-3.5" />
                        {lead.website}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        <Mail className="h-3.5 w-3.5" />
                        {lead.email}
                      </a>
                    )}
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {lead.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={handleEnrich} disabled={enriching} className="gap-1.5">
                  {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Enrich
                </Button>
                <Button variant="outline" size="sm" onClick={() => setLocation(`/leads/${leadId}/edit`)} className="gap-1.5">
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Dialog open={logOpen} onOpenChange={setLogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Log Interaction
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Interaction — {lead.companyName}</DialogTitle>
                    </DialogHeader>
                    <ContactMomentForm leadId={leadId} onSuccess={() => setLogOpen(false)} />
                  </DialogContent>
                </Dialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setMergeOpen(true)} className="gap-2">
                      <Merge className="h-4 w-4" />
                      Merge into another Lead
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4" />
                          Delete Lead
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {lead.companyName}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this lead and all related data including contact moments, documents, and links. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteLeadMutation.mutate({ id: leadId })}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {deleteLeadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Merge Dialog */}
                <Dialog open={mergeOpen} onOpenChange={(o) => { setMergeOpen(o); if (!o) { setMergeSearch(""); setMergeTargetId(null); } }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Merge Lead</DialogTitle>
                      <DialogDescription>
                        Merge <strong>{lead.companyName}</strong> into another lead. All contact moments, documents, persons, and links will be moved to the target lead. This lead will be deleted.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search for target lead..."
                          value={mergeSearch}
                          onChange={(e) => { setMergeSearch(e.target.value); setMergeTargetId(null); }}
                          className="pl-9"
                        />
                      </div>
                      {mergeSearch.length >= 2 && (
                        <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                          {(mergeSearchResults?.items ?? [])
                            .filter((l) => l.id !== leadId)
                            .map((l) => (
                              <div
                                key={l.id}
                                className={`px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${mergeTargetId === l.id ? "bg-primary/10" : ""}`}
                                onClick={() => setMergeTargetId(l.id)}
                              >
                                <div className="text-sm font-medium">{l.companyName}</div>
                                {l.contactPerson && <div className="text-xs text-muted-foreground">{l.contactPerson}</div>}
                              </div>
                            ))}
                          {(mergeSearchResults?.items ?? []).filter((l) => l.id !== leadId).length === 0 && (
                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">No leads found</div>
                          )}
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
                      <Button
                        onClick={() => mergeTargetId && mergeLeadMutation.mutate({ keepId: mergeTargetId, removeId: leadId })}
                        disabled={!mergeTargetId || mergeLeadMutation.isPending}
                      >
                        {mergeLeadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Merge className="h-4 w-4 mr-2" />}
                        Merge
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Stage Visualization */}
        {(() => {
          const PIPELINE_STAGES: Array<{ key: string; label: string }> = [
            { key: "new", label: "New" },
            { key: "contacted", label: "Contacted" },
            { key: "qualified", label: "Qualified" },
            { key: "proposal", label: "Proposal" },
            { key: "negotiation", label: "Negotiation" },
            { key: "won", label: "Won" },
          ];
          const currentStatus = lead.status as string;
          const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === currentStatus);
          const isOffRamp = currentStatus === "lost" || currentStatus === "on_hold";

          return (
            <Card className="border shadow-sm">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-0">
                  {PIPELINE_STAGES.map((stage, idx) => {
                    const isPast = !isOffRamp && currentIdx >= 0 && idx < currentIdx;
                    const isCurrent = !isOffRamp && idx === currentIdx;
                    const isFuture = isOffRamp || currentIdx < 0 || idx > currentIdx;
                    const isClickable = !isCurrent;

                    return (
                      <div key={stage.key} className="flex items-center flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (isClickable) {
                              updateLeadMutation.mutate(
                                { id: leadId, data: { status: stage.key as any } },
                              );
                            }
                          }}
                          disabled={!isClickable || updateLeadMutation.isPending}
                          className={`
                            relative flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all w-full min-w-0
                            ${isCurrent
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : isPast
                                ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                            }
                            ${!isClickable ? "cursor-default" : ""}
                          `}
                          title={isCurrent ? `Current stage: ${stage.label}` : `Move to ${stage.label}`}
                        >
                          {isPast ? (
                            <Check className="h-3 w-3 shrink-0" />
                          ) : isCurrent ? (
                            <div className="h-2 w-2 rounded-full bg-primary-foreground shrink-0 animate-pulse" />
                          ) : null}
                          <span className="truncate">{stage.label}</span>
                        </button>
                        {idx < PIPELINE_STAGES.length - 1 && (
                          <ChevronRight className={`h-3.5 w-3.5 shrink-0 mx-0.5 ${
                            isPast && !isOffRamp ? "text-primary/50" : "text-muted-foreground/30"
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Off-ramp indicators for Lost / On Hold */}
                {isOffRamp && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                    {currentStatus === "lost" ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        <span className="font-medium text-red-600 dark:text-red-400">Lost</span>
                        <span className="text-muted-foreground">—</span>
                        <button
                          type="button"
                          onClick={() => updateLeadMutation.mutate({ id: leadId, data: { status: "new" } })}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          Reopen as New
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs">
                        <PauseCircle className="h-3.5 w-3.5 text-gray-500" />
                        <span className="font-medium text-gray-600 dark:text-gray-400">On Hold</span>
                        <span className="text-muted-foreground">—</span>
                        <button
                          type="button"
                          onClick={() => updateLeadMutation.mutate({ id: leadId, data: { status: "new" } })}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          Reopen as New
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="border-b w-full justify-start rounded-none bg-transparent h-auto p-0 gap-0">
            {[
              "overview",
              "timeline",
              "persons",
              ...(isEventPromotor ? ["events"] : []),
              "competitors",
              "documents",
              "enrichment",
            ].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent capitalize px-4 py-2.5 text-sm"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Info */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Name", value: lead.contactPerson },
                    { label: "Title", value: lead.contactTitle },
                    { label: "Email", value: lead.email },
                    { label: "Phone", value: lead.phone },
                    { label: "Industry", value: lead.industry },
                    { label: "Location", value: lead.location },
                    { label: "Country", value: lead.country },
                  ].map(({ label, value }) => value ? (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
                    </div>
                  ) : null)}
                </CardContent>
              </Card>

              {/* CRM Info */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">CRM Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Status", value: STATUS_LABELS[lead.status as keyof typeof STATUS_LABELS] },
                    { label: "Priority", value: lead.priority },
                    { label: "Source", value: lead.source },
                    { label: "Last Contact", value: formatDate(lead.lastContactedAt) },
                    { label: "Next Follow-up", value: formatDate(lead.nextFollowUpAt) },
                    { label: "Created", value: formatDate(lead.createdAt) },
                  ].map(({ label, value }) => value ? (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium capitalize">{value}</span>
                    </div>
                  ) : null)}
                </CardContent>
              </Card>

              {/* Pain Points */}
              {lead.painPoints && (
                <Card className="border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pain Points</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert"><Markdown>{mdBreaks(lead.painPoints)}</Markdown></div>
                  </CardContent>
                </Card>
              )}

              {/* Opportunities */}
              {lead.futureOpportunities && (
                <Card className="border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Opportunities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert"><Markdown>{mdBreaks(lead.futureOpportunities)}</Markdown></div>
                  </CardContent>
                </Card>
              )}

              {/* Revenue Model */}
              {lead.revenueModel && (
                <Card className="border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Revenue Model</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert"><Markdown>{mdBreaks(lead.revenueModel)}</Markdown></div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {lead.notes && (
                <Card className="border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert"><Markdown>{mdBreaks(lead.notes)}</Markdown></div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Lead Type Attributes */}
            <LeadAttributeEditor
              leadType={(lead as any).leadType ?? 'default'}
              attributes={((lead as any).leadAttributes ?? {}) as Record<string, unknown>}
              onSave={async (newType, newAttrs) => {
                await updateLeadMutation.mutateAsync({
                  id: leadId,
                  data: { leadType: newType as any, leadAttributes: newAttrs },
                });
              }}
            />

            <WebLinksCard entityType="lead" entityId={leadId} />
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-4">
            <Card className="border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold">Contact History</CardTitle>
                <Dialog open={logOpen} onOpenChange={setLogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Log
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Interaction</DialogTitle>
                    </DialogHeader>
                    <ContactMomentForm leadId={leadId} onSuccess={() => setLogOpen(false)} />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {(moments ?? []).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No interactions logged yet</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4 pl-10">
                      {(moments ?? []).map((moment) => (
                        <div key={moment.id} className="relative">
                          <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                            <span className="text-[8px]">{CONTACT_TYPE_ICONS[moment.type as keyof typeof CONTACT_TYPE_ICONS]}</span>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3 border">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium capitalize">{moment.type}</span>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <span className={`text-xs capitalize ${OUTCOME_COLORS[moment.outcome as keyof typeof OUTCOME_COLORS] ?? ""}`}>
                                    {moment.outcome?.replace("_", " ")}
                                  </span>
                                  {moment.direction && (
                                    <>
                                      <span className="text-xs text-muted-foreground">·</span>
                                      <span className="text-xs text-muted-foreground capitalize">{moment.direction}</span>
                                    </>
                                  )}
                                  {(moment as any).personName && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-xs font-medium">
                                      <Users className="h-3 w-3" />
                                      {(moment as any).personName}
                                    </span>
                                  )}
                                </div>
                                {moment.subject && (
                                  <div className="text-sm font-medium mt-0.5">{moment.subject}</div>
                                )}
                                {moment.type === "email" && (moment.emailRaw || moment.notes) ? (
                                  <EmailBody html={moment.emailRaw} text={moment.notes} />
                                ) : moment.notes ? (
                                  <RichNotes notes={moment.notes} className="text-sm text-muted-foreground mt-1 leading-relaxed" />
                                ) : null}
                                {moment.followUpAt && (
                                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                                    <Checkbox
                                      checked={!!moment.followUpDone}
                                      onCheckedChange={(checked) => {
                                        toggleFollowUpMutation.mutate({
                                          id: moment.id,
                                          data: { followUpDone: !!checked },
                                        });
                                      }}
                                      className="h-3.5 w-3.5"
                                    />
                                    <span className={`text-xs ${
                                      moment.followUpDone
                                        ? "text-muted-foreground line-through"
                                        : new Date(moment.followUpAt) < new Date()
                                          ? "text-red-600 font-medium"
                                          : "text-amber-600"
                                    }`}>
                                      Follow-up {moment.followUpDone ? "done" : `due ${formatDate(moment.followUpAt)}`}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                <EditableMomentDate moment={moment} leadId={leadId} />
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteMomentMutation.mutate({ id: moment.id })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Persons Tab */}
          <TabsContent value="persons" className="mt-4 space-y-4">
            <Card className="border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Linked People
                </CardTitle>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLinkPersonOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5" /> Link Person
                </Button>
              </CardHeader>
              <CardContent>
                {(linkedPersons ?? []).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No people linked yet</p>
                    <p className="text-xs mt-1">Link contacts, partners, or decision makers to this lead</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(linkedPersons ?? []).map((row: any) => (
                      <div key={row.link.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                            {(row.person.name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{row.person.name}</span>
                              <Badge variant="outline" className="text-xs capitalize">{row.link.relationship?.replace(/_/g, " ")}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              {row.person.title && <span className="text-xs text-muted-foreground">{row.person.title}</span>}
                              {row.person.company && <span className="text-xs text-muted-foreground">· {row.person.company}</span>}
                              {row.person.email && (
                                <a href={`mailto:${row.person.email}`} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                  <Mail className="h-3 w-3" />{row.person.email}
                                </a>
                              )}
                              {row.person.linkedInUrl && (
                                <a href={row.person.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                  <Linkedin className="h-3 w-3" />LinkedIn
                                </a>
                              )}
                            </div>
                            {row.link.notes && <p className="text-xs text-muted-foreground mt-1 italic">{row.link.notes}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs"
                            onClick={() => setLocation(`/persons/${row.person.id}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> View
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => unlinkPersonMutation.mutate({ personId: row.person.id, leadId })}
                          >
                            <UnlinkIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Link Person Dialog */}
            <Dialog open={linkPersonOpen} onOpenChange={setLinkPersonOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" /> Link a Person
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Search people</Label>
                    <Input
                      placeholder="Type a name..."
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Relationship</Label>
                    <Select value={linkRelationship} onValueChange={setLinkRelationship}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contact_at">Contact at company</SelectItem>
                        <SelectItem value="decision_maker">Decision Maker</SelectItem>
                        <SelectItem value="champion">Champion / Advocate</SelectItem>
                        <SelectItem value="introduced_by">Introduced by</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {(allPersons?.persons ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No people found</p>
                    ) : (
                      (allPersons?.persons ?? []).map((p: any) => (
                        <button
                          key={p.id}
                          className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                            linkingPersonId === p.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50 border-transparent"
                          }`}
                          onClick={() => setLinkingPersonId(linkingPersonId === p.id ? null : p.id)}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {(p.name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{[p.title, p.company].filter(Boolean).join(" · ")}</div>
                          </div>
                          {linkingPersonId === p.id && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setLinkPersonOpen(false); setLinkingPersonId(null); }}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!linkingPersonId || linkPersonMutation.isPending}
                      onClick={() => {
                        if (linkingPersonId) {
                          linkPersonMutation.mutate({ personId: linkingPersonId, leadId, relationship: linkRelationship as any });
                        }
                      }}
                    >
                      {linkPersonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Link Person
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Events Tab (Event Promotor only) */}
          {isEventPromotor && (
          <TabsContent value="events" className="mt-4 space-y-4">
            <Card className="border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" /> Events
                  {(promotorEventsList ?? []).length > 0 && (
                    <Badge variant="secondary" className="text-xs">{(promotorEventsList ?? []).length}</Badge>
                  )}
                </CardTitle>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { resetEventForm(); setAddEventOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" /> Add Event
                </Button>
              </CardHeader>
              <CardContent>
                {(promotorEventsList ?? []).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarRange className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No events added yet</p>
                    <p className="text-xs mt-1">Add individual events managed by this promotor</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(promotorEventsList ?? []).map((evt: any) => {
                      const attrs = (evt.eventAttributes ?? {}) as Record<string, unknown>;
                      return (
                        <div key={evt.id} className="p-3 bg-muted/30 rounded-lg border">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{evt.eventName}</span>
                                {!!attrs.eventCategory && (
                                  <Badge variant="outline" className="text-xs">{String(attrs.eventCategory)}</Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                                {!!attrs.visitorCount && (
                                  <span><Users className="inline h-3 w-3 mr-0.5" />{String(attrs.visitorCount)} visitors</span>
                                )}
                                {!!attrs.eventDurationDays && (
                                  <span><Calendar className="inline h-3 w-3 mr-0.5" />{String(attrs.eventDurationDays)} days</span>
                                )}
                                {!!attrs.typicalDates && (
                                  <span>{String(attrs.typicalDates)}</span>
                                )}
                                {!!attrs.region && (
                                  <span><MapPin className="inline h-3 w-3 mr-0.5" />{String(attrs.region)}</span>
                                )}
                                {!!attrs.hotelNeedScore && (
                                  <span>Hotel Need: <span className="text-foreground">{String(attrs.hotelNeedScore)}</span></span>
                                )}
                                {!!attrs.revenueEngineFit && (
                                  <span>Fit: <span className="text-foreground">{String(attrs.revenueEngineFit)}</span></span>
                                )}
                              </div>
                              {evt.notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">{evt.notes}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs"
                                onClick={() => {
                                  setEditingEvent(evt);
                                  setEventName(evt.eventName);
                                  setEventAttributes((evt.eventAttributes ?? {}) as Record<string, unknown>);
                                  setEventNotes(evt.notes ?? "");
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => deleteEventMutation.mutate({ id: evt.id })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add / Edit Event Dialog */}
            <Dialog open={addEventOpen || !!editingEvent} onOpenChange={(open) => { if (!open) { setAddEventOpen(false); setEditingEvent(null); resetEventForm(); } }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4" /> {editingEvent ? "Edit Event" : "Add Event"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="space-y-1.5">
                    <Label>Event Name *</Label>
                    <Input
                      placeholder="e.g. Royal Welsh Show"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                    />
                  </div>

                  {getPromotorEventFields().map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label>{field.label}{field.unit ? ` (${field.unit})` : ""}</Label>
                      {field.type === "select" ? (
                        <Select
                          value={String(eventAttributes[field.key] ?? "")}
                          onValueChange={(v) => setEventAttributes((prev) => ({ ...prev, [field.key]: v }))}
                        >
                          <SelectTrigger className="text-sm"><SelectValue placeholder={field.placeholder || `Select ${field.label}`} /></SelectTrigger>
                          <SelectContent>
                            {(field.options ?? []).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.type === "textarea" ? (
                        <Textarea
                          placeholder={field.placeholder}
                          value={String(eventAttributes[field.key] ?? "")}
                          onChange={(e) => setEventAttributes((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className="text-sm min-h-[50px]"
                        />
                      ) : (
                        <Input
                          type={field.type === "number" ? "number" : "text"}
                          placeholder={field.placeholder}
                          value={String(eventAttributes[field.key] ?? "")}
                          onChange={(e) => setEventAttributes((prev) => ({
                            ...prev,
                            [field.key]: field.type === "number" ? (e.target.value ? Number(e.target.value) : "") : e.target.value,
                          }))}
                          className="text-sm"
                        />
                      )}
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Additional notes about this event..."
                      value={eventNotes}
                      onChange={(e) => setEventNotes(e.target.value)}
                      className="text-sm min-h-[50px]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setAddEventOpen(false); setEditingEvent(null); resetEventForm(); }}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!eventName.trim() || createEventMutation.isPending || updateEventMutation.isPending}
                      onClick={() => {
                        const cleanAttrs = Object.fromEntries(
                          Object.entries(eventAttributes).filter(([, v]) => v !== "" && v !== undefined)
                        );
                        if (editingEvent) {
                          updateEventMutation.mutate({
                            id: editingEvent.id,
                            data: { eventName, eventAttributes: cleanAttrs, notes: eventNotes || undefined },
                          });
                        } else {
                          createEventMutation.mutate({
                            leadId,
                            eventName,
                            eventAttributes: cleanAttrs,
                            notes: eventNotes || undefined,
                          });
                        }
                      }}
                    >
                      {(createEventMutation.isPending || updateEventMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {editingEvent ? "Save Changes" : "Add Event"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
          )}

          {/* Competitors Tab */}
          <TabsContent value="competitors" className="mt-4 space-y-4">
            <Card className="border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Swords className="h-4 w-4" /> Competitors
                </CardTitle>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLinkCompetitorOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Link Competitor
                </Button>
              </CardHeader>
              <CardContent>
                {(linkedCompetitors ?? []).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Swords className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No competitors linked yet</p>
                    <p className="text-xs mt-1">Track which competitors this lead is using or evaluating</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(linkedCompetitors ?? []).map((row: any) => {
                      const threatCfg: Record<string, { label: string; color: string; bg: string }> = {
                        low: { label: "Low", color: "text-green-700", bg: "bg-green-100" },
                        medium: { label: "Medium", color: "text-yellow-700", bg: "bg-yellow-100" },
                        high: { label: "High", color: "text-red-700", bg: "bg-red-100" },
                      };
                      const cfg = threatCfg[row.competitor.threatLevel] ?? threatCfg.medium;
                      const contractEnding = row.link.contractEndDate && new Date(row.link.contractEndDate) <= new Date(Date.now() + 90 * 86400000);
                      return (
                        <div key={row.link.id} className={`p-3 bg-muted/30 rounded-lg border ${contractEnding ? "border-amber-300" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <button
                                  className="text-sm font-medium hover:text-primary hover:underline cursor-pointer"
                                  onClick={() => setLocation(`/competitors/${row.competitor.id}`)}
                                >
                                  {row.competitor.name}
                                </button>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                                {row.link.satisfaction && (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {row.link.satisfaction.replace(/_/g, " ")}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                                {row.link.competitorProduct && (
                                  <span>Product: <span className="text-foreground">{row.link.competitorProduct}</span></span>
                                )}
                                {row.link.contractStartDate && (
                                  <span>Start: <span className="text-foreground">{formatDate(row.link.contractStartDate)}</span></span>
                                )}
                                {row.link.contractEndDate && (
                                  <span className={contractEnding ? "text-amber-600 font-medium" : ""}>
                                    End: <span className={contractEnding ? "" : "text-foreground"}>{formatDate(row.link.contractEndDate)}</span>
                                    {contractEnding && " (ending soon)"}
                                  </span>
                                )}
                                {row.link.contractValue != null && (
                                  <span>Value: <span className="text-foreground">{row.link.contractCurrency ?? "USD"} {row.link.contractValue}</span></span>
                                )}
                              </div>
                              {(row.link.likes || row.link.dislikes) && (
                                <div className="flex flex-wrap gap-4 mt-1.5 text-xs">
                                  {row.link.likes && (
                                    <span className="text-green-600">Likes: {row.link.likes}</span>
                                  )}
                                  {row.link.dislikes && (
                                    <span className="text-red-600">Dislikes: {row.link.dislikes}</span>
                                  )}
                                </div>
                              )}
                              {row.link.notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">{row.link.notes}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs"
                                onClick={() => setLocation(`/competitors/${row.competitor.id}`)}
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> View
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => unlinkCompetitorMutation.mutate({ competitorId: row.competitor.id, leadId })}
                              >
                                <UnlinkIcon className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Link Competitor Dialog */}
            <Dialog open={linkCompetitorOpen} onOpenChange={setLinkCompetitorOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Swords className="h-4 w-4" /> Link a Competitor
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="space-y-1.5">
                    <Label>Search competitors</Label>
                    <Input
                      placeholder="Type a name..."
                      value={competitorSearch}
                      onChange={(e) => setCompetitorSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {(allCompetitors?.competitors ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No competitors found</p>
                    ) : (
                      (allCompetitors?.competitors ?? []).map((c: any) => (
                        <button
                          key={c.id}
                          className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                            linkingCompetitorId === c.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50 border-transparent"
                          }`}
                          onClick={() => setLinkingCompetitorId(linkingCompetitorId === c.id ? null : c.id)}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {(c.name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{c.name}</div>
                            {c.products && <div className="text-xs text-muted-foreground truncate">{c.products}</div>}
                          </div>
                          {linkingCompetitorId === c.id && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Product / Service used</Label>
                    <Input value={compProduct} onChange={(e) => setCompProduct(e.target.value)} placeholder="e.g. Their CRM module" className="text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Contract Start</Label>
                      <Input type="date" value={compContractStart} onChange={(e) => setCompContractStart(e.target.value)} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Contract End</Label>
                      <Input type="date" value={compContractEnd} onChange={(e) => setCompContractEnd(e.target.value)} className="text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Satisfaction</Label>
                    <Select value={compSatisfaction} onValueChange={setCompSatisfaction}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="happy">Happy</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="unhappy">Unhappy</SelectItem>
                        <SelectItem value="looking_to_switch">Looking to switch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>What they like</Label>
                    <Textarea value={compLikes} onChange={(e) => setCompLikes(e.target.value)} placeholder="What does the lead like about this competitor?" className="text-sm min-h-[50px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>What they dislike</Label>
                    <Textarea value={compDislikes} onChange={(e) => setCompDislikes(e.target.value)} placeholder="Pain points, frustrations..." className="text-sm min-h-[50px]" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setLinkCompetitorOpen(false); setLinkingCompetitorId(null); }}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!linkingCompetitorId || linkCompetitorMutation.isPending}
                      onClick={() => {
                        if (linkingCompetitorId) {
                          linkCompetitorMutation.mutate({
                            competitorId: linkingCompetitorId,
                            leadId,
                            competitorProduct: compProduct || undefined,
                            contractStartDate: compContractStart || undefined,
                            contractEndDate: compContractEnd || undefined,
                            satisfaction: compSatisfaction || undefined,
                            likes: compLikes || undefined,
                            dislikes: compDislikes || undefined,
                          });
                        }
                      }}
                    >
                      {linkCompetitorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Link Competitor
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4 space-y-4">
            {/* Upload Card */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Upload Document</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as any)}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proposal">📄 Proposal</SelectItem>
                      <SelectItem value="contract">📝 Contract</SelectItem>
                      <SelectItem value="presentation">📊 Presentation</SelectItem>
                      <SelectItem value="report">📋 Report</SelectItem>
                      <SelectItem value="other">📁 Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.html,.htm,.xlsx,.xls,.docx,.doc,.txt,.md,.pptx,.ppt"
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="outline"
                    className="gap-2 flex-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Choose File (PDF, HTML, Excel, Word)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Uploaded documents are automatically parsed and indexed for AI search.
                </p>
              </CardContent>
            </Card>

            {/* Documents List */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Attached Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {(documents ?? []).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No documents attached</p>
                    <p className="text-xs mt-1">Upload proposals, contracts, presentations, solution architectures...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(documents ?? []).map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-3 min-w-0">
                          {getDocIcon(doc.mimeType, doc.fileName)}
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{doc.fileName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground capitalize">{doc.category}</span>
                              {doc.chunkCount > 0 && (
                                <span className="text-xs text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> AI indexed ({doc.chunkCount} chunks)
                                </span>
                              )}
                              {doc.shareCount > 0 && (
                                <span className="text-xs text-blue-500 flex items-center gap-1">
                                  <Share2 className="h-3 w-3" /> {doc.shareCount} share{doc.shareCount !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs"
                            onClick={() => {
                              setShareDialogDoc(doc);
                              setShareTitle(doc.fileName);
                              setSharedUrl(null);
                              setShareNotes("");
                              setShareRecordMoment(true);
                            }}
                          >
                            <Share2 className="h-3.5 w-3.5" /> Share
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteDocMutation.mutate({ id: doc.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Share Links */}
            {(shares ?? []).length > 0 && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Active Share Links</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(shares ?? []).filter((s: any) => s.isActive).map((share: any) => (
                      <div key={share.id} className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{share.title ?? share.fileName}</div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {share.viewCount ?? 0} views
                            </span>
                            <span className="text-xs text-muted-foreground">{share.fileName}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs"
                            onClick={() => {
                              const url = `${window.location.origin}/share/${share.token}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Link copied!");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs"
                            asChild
                          >
                            <a href={`/share/${share.token}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" /> Preview
                            </a>
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deactivateShareMutation.mutate({ token: share.token })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Share Dialog */}
            <Dialog open={!!shareDialogDoc} onOpenChange={(o) => { if (!o) { setShareDialogDoc(null); setSharedUrl(null); } }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" /> Share Presentation
                  </DialogTitle>
                </DialogHeader>
                {sharedUrl ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200/50">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">Share link created!</p>
                      <div className="flex gap-2">
                        <Input value={sharedUrl} readOnly className="text-xs" />
                        <Button size="sm" onClick={() => { navigator.clipboard.writeText(sharedUrl); toast.success("Copied!"); }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <a href={sharedUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview</a>
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => { setShareDialogDoc(null); setSharedUrl(null); }}>Done</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Title (shown to client)</Label>
                      <Input value={shareTitle} onChange={(e) => setShareTitle(e.target.value)} placeholder={shareDialogDoc?.fileName} />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="recordMoment"
                        checked={shareRecordMoment}
                        onChange={(e) => setShareRecordMoment(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="recordMoment" className="cursor-pointer">Record as contact moment</Label>
                    </div>
                    {shareRecordMoment && (
                      <div className="space-y-1.5">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          value={shareNotes}
                          onChange={(e) => setShareNotes(e.target.value)}
                          placeholder="e.g. Sent proposal to John after demo call..."
                          rows={2}
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setShareDialogDoc(null)}>Cancel</Button>
                      <Button className="flex-1 gap-2" onClick={handleShare} disabled={sharing}>
                        {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                        Generate Link
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Enrichment Tab */}
          <TabsContent value="enrichment" className="mt-4">
            <Card className="border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold">AI Enrichment</CardTitle>
                <Button size="sm" variant="outline" onClick={handleEnrich} disabled={enriching} className="gap-1.5">
                  {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {enrichment ? "Re-enrich" : "Enrich with AI"}
                </Button>
              </CardHeader>
              <CardContent>
                {!enrichment ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No AI enrichment yet</p>
                    <p className="text-xs mt-1">Click "Enrich with AI" to research this company online and generate a sales intelligence report</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Header meta */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      {lead.enrichedAt && (
                        <p className="text-xs text-muted-foreground">Last enriched: {formatDate(lead.enrichedAt)}</p>
                      )}
                      {(enrichment as any).webDataFound === true && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">🌐 Web data found</Badge>
                      )}
                    </div>

                    {/* Scores row */}
                    <div className="grid grid-cols-3 gap-3">
                      {enrichment.urgencyScore !== undefined && (
                        <div className="rounded-lg border p-3 text-center">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Urgency</div>
                          <div className="text-2xl font-bold text-orange-600">{String(enrichment.urgencyScore)}<span className="text-sm text-muted-foreground">/10</span></div>
                        </div>
                      )}
                      {enrichment.fitScore !== undefined && (
                        <div className="rounded-lg border p-3 text-center">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Fit Score</div>
                          <div className="text-2xl font-bold text-green-600">{String(enrichment.fitScore)}<span className="text-sm text-muted-foreground">/10</span></div>
                        </div>
                      )}
                      {(enrichment as any).estimatedDealSize != null && (
                        <div className="rounded-lg border p-3 text-center">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Est. Deal Size</div>
                          <div className="text-sm font-bold">{String((enrichment as any).estimatedDealSize)}</div>
                        </div>
                      )}
                    </div>

                    {/* Overview */}
                    {(enrichment as any).overview != null && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Overview</div>
                        <p className="text-sm leading-relaxed">{String((enrichment as any).overview)}</p>
                      </div>
                    )}

                    {/* Recent News */}
                    {(enrichment as any).recentNews != null && String((enrichment as any).recentNews) !== "No recent news found." && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📰 Recent News</div>
                        <p className="text-sm leading-relaxed">{String((enrichment as any).recentNews)}</p>
                      </div>
                    )}

                    {/* Key People */}
                    {(enrichment as any).keyPeople != null && String((enrichment as any).keyPeople) !== "Not found in web research." && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">👥 Key People</div>
                        <p className="text-sm leading-relaxed">{String((enrichment as any).keyPeople)}</p>
                      </div>
                    )}

                    {/* Talking Points */}
                    {Array.isArray((enrichment as any).talkingPoints) && ((enrichment as any).talkingPoints as string[]).length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">💬 Talking Points for First Call</div>
                        <ul className="space-y-1">
                          {((enrichment as any).talkingPoints as string[]).map((tp: string, i: number) => (
                            <li key={i} className="flex gap-2 text-sm">
                              <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                              <span>{tp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Pain Points + Opportunities */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(enrichment as any).painPoints != null && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pain Points</div>
                          <p className="text-sm leading-relaxed">{String((enrichment as any).painPoints)}</p>
                        </div>
                      )}
                      {(enrichment as any).opportunities != null && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opportunities</div>
                          <p className="text-sm leading-relaxed">{String((enrichment as any).opportunities)}</p>
                        </div>
                      )}
                    </div>

                    {/* Competitive Landscape */}
                    {(enrichment as any).competitiveLandscape != null && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Competitive Landscape</div>
                        <p className="text-sm leading-relaxed">{String((enrichment as any).competitiveLandscape)}</p>
                      </div>
                    )}

                    {/* Recommended Approach (legacy + new) */}
                    {(enrichment as any).recommendedApproach != null && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommended Approach</div>
                        <p className="text-sm leading-relaxed">{String((enrichment as any).recommendedApproach)}</p>
                      </div>
                    )}

                    {/* Next Best Action */}
                    {(enrichment as any).nextBestAction != null && (
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
                        <div className="text-xs font-semibold text-primary uppercase tracking-wide">⚡ Next Best Action</div>
                        <p className="text-sm font-medium">{String((enrichment as any).nextBestAction)}</p>
                      </div>
                    )}

                    {/* Sources */}
                    {Array.isArray((enrichment as any).sources) && ((enrichment as any).sources as Array<{type: string; url: string; title: string}>).length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sources</div>
                        <div className="space-y-1">
                          {((enrichment as any).sources as Array<{type: string; url: string; title: string}>).map((src, i: number) => (
                            <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-blue-600 hover:underline truncate">
                              <span className="shrink-0">{src.type === "website" ? "🌐" : src.type === "wikipedia" ? "📖" : "📰"}</span>
                              <span className="truncate">{src.title || src.url}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Legacy: buying signals (old enrichments) */}
                    {Array.isArray(enrichment.buyingSignals) && (enrichment.buyingSignals as string[]).length > 0 && !(enrichment as any).talkingPoints && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buying Signals</div>
                        <div className="flex flex-wrap gap-2">
                          {(enrichment.buyingSignals as string[]).map((s, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(enrichment.keyDecisionFactors) && (enrichment.keyDecisionFactors as string[]).length > 0 && !(enrichment as any).talkingPoints && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Decision Factors</div>
                        <div className="flex flex-wrap gap-2">
                          {(enrichment.keyDecisionFactors as string[]).map((f, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
