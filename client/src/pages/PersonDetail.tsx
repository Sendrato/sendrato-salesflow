import { useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Linkedin, Mail, Phone, Building2, Edit2, Save, X,
  MessageSquare, Plus, Link2, ExternalLink, Clock, Tag, User,
  Calendar, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRelativeTime, CONTACT_TYPE_ICONS, OUTCOME_COLORS } from "@/lib/crm";
import EmailBody from "@/components/EmailBody";
import WebLinksCard from "@/components/WebLinksCard";

function EditableMomentDate({ moment, onUpdated }: { moment: { id: number; occurredAt: string | Date }; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const submitting = useRef(false);
  const updateMutation = trpc.contactMoments.update.useMutation({
    onSuccess: () => {
      submitting.current = false;
      onUpdated();
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
      {formatDate(moment.occurredAt)}
    </button>
  );
}

const PERSON_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  prospect:   { label: "Prospect",   color: "text-slate-700",  bg: "bg-slate-100" },
  contact:    { label: "Contact",    color: "text-blue-700",   bg: "bg-blue-100" },
  partner:    { label: "Partner",    color: "text-green-700",  bg: "bg-green-100" },
  reseller:   { label: "Reseller",   color: "text-purple-700", bg: "bg-purple-100" },
  influencer: { label: "Influencer", color: "text-orange-700", bg: "bg-orange-100" },
  investor:   { label: "Investor",   color: "text-yellow-700", bg: "bg-yellow-100" },
  other:      { label: "Other",      color: "text-gray-700",   bg: "bg-gray-100" },
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  contact_at: "Contact at",
  introduced_by: "Introduced us to",
  decision_maker: "Decision maker at",
  champion: "Champion at",
  partner: "Partner at",
  other: "Related to",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function LogMomentDialog({ personId, onSuccess }: { personId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("linkedin");
  const [direction, setDirection] = useState("outbound");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("neutral");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [followUpAt, setFollowUpAt] = useState("");

  const logMutation = trpc.persons.logContactMoment.useMutation({
    onSuccess: () => {
      toast.success("Contact moment logged");
      setOpen(false);
      setSubject(""); setNotes(""); setFollowUpAt("");
      onSuccess();
    },
    onError: () => toast.error("Failed to log contact moment"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Log Interaction
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Contact Moment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["email","phone","meeting","linkedin","slack","demo","proposal","other"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subject / Topic</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What was discussed?" className="text-sm h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Key takeaways, next steps..." className="text-sm min-h-[80px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="no_response">No Response</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date & Time</Label>
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="text-sm h-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="personScheduleFollowUp"
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
              <Label htmlFor="personScheduleFollowUp" className="cursor-pointer text-xs font-normal">Schedule follow-up</Label>
            </div>
            {followUpAt && (
              <Input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} className="text-sm h-8" />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={logMutation.isPending} onClick={() =>
              logMutation.mutate({ personId, type: type as any, direction: direction as any, subject: subject || undefined, notes: notes || undefined, outcome: outcome as any, occurredAt, followUpAt: followUpAt || undefined })
            }>
              {logMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkLeadDialog({ personId, onSuccess }: { personId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [relationship, setRelationship] = useState("contact_at");

  const { data: leadsData } = trpc.leads.list.useQuery({ search: leadSearch || undefined, limit: 20 });
  const leads = leadsData?.items ?? [];

  const linkMutation = trpc.persons.linkToLead.useMutation({
    onSuccess: () => { toast.success("Linked to lead"); setOpen(false); onSuccess(); },
    onError: () => toast.error("Failed to link"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          Link to Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Person to a Lead / Company</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Relationship</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(RELATIONSHIP_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Search Lead / Company</Label>
            <Input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Type company name..." className="text-sm h-8" />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {leads.map((lead) => (
              <button
                key={lead.id}
                className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm flex items-center justify-between"
                onClick={() => linkMutation.mutate({ personId, leadId: lead.id, relationship: relationship as any })}
              >
                <span className="font-medium">{lead.companyName}</span>
                <span className="text-xs text-muted-foreground">{lead.industry ?? lead.location}</span>
              </button>
            ))}
            {leads.length === 0 && leadSearch && (
              <p className="text-xs text-muted-foreground text-center py-4">No leads found</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const personId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});

  const { data: person, isLoading, refetch } = trpc.persons.get.useQuery({ id: personId });
  const { data: moments, refetch: refetchMoments } = trpc.persons.getContactMoments.useQuery({ personId });
  const { data: leadLinks, refetch: refetchLinks } = trpc.persons.getLeadLinks.useQuery({ personId });

  const updateMutation = trpc.persons.update.useMutation({
    onSuccess: () => { refetch(); setEditing(false); toast.success("Saved"); },
    onError: () => toast.error("Failed to save"),
  });

  const utils = trpc.useUtils();
  const toggleFollowUpMutation = trpc.contactMoments.update.useMutation({
    onSuccess: () => {
      refetchMoments();
      utils.analytics.followUps.invalidate();
    },
  });

  const unlinkMutation = trpc.persons.unlinkFromLead.useMutation({
    onSuccess: () => { refetchLinks(); toast.success("Unlinked"); },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!person) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-muted-foreground">Person not found.</div>
      </DashboardLayout>
    );
  }

  const cfg = PERSON_TYPE_CONFIG[person.personType] ?? PERSON_TYPE_CONFIG.other;

  function startEdit() {
    setEditData({
      name: person!.name,
      email: person!.email ?? "",
      phone: person!.phone ?? "",
      linkedInUrl: person!.linkedInUrl ?? "",
      company: person!.company ?? "",
      title: person!.title ?? "",
      notes: person!.notes ?? "",
      personType: person!.personType,
    });
    setEditing(true);
  }

  function saveEdit() {
    updateMutation.mutate({
      id: personId,
      data: {
        name: editData.name,
        email: editData.email || undefined,
        phone: editData.phone || undefined,
        linkedInUrl: editData.linkedInUrl || undefined,
        company: editData.company || undefined,
        title: editData.title || undefined,
        notes: editData.notes || undefined,
        personType: editData.personType as any,
      },
    });
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/persons")} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            People
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">
                {getInitials(person.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              {editing ? (
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="text-xl font-bold h-8 mb-1"
                />
              ) : (
                <h1 className="text-2xl font-bold">{person.name}</h1>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                  {cfg.label}
                </span>
                {person.title && <span className="text-sm text-muted-foreground">{person.title}</span>}
                {person.company && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {person.company}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="gap-1.5">
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit} className="gap-1.5">
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="h-9">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">
              Timeline ({moments?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="leads" className="text-xs">
              Linked Leads ({leadLinks?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editing ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="h-8 text-sm" placeholder="email@example.com" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="h-8 text-sm" placeholder="+44 7700 900000" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">LinkedIn URL</Label>
                        <Input value={editData.linkedInUrl} onChange={(e) => setEditData({ ...editData, linkedInUrl: e.target.value })} className="h-8 text-sm" placeholder="https://linkedin.com/in/..." />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Company</Label>
                        <Input value={editData.company} onChange={(e) => setEditData({ ...editData, company: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Title</Label>
                        <Input value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Person Type</Label>
                        <Select value={editData.personType} onValueChange={(v) => setEditData({ ...editData, personType: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(PERSON_TYPE_CONFIG).map(([val, c]) => (
                              <SelectItem key={val} value={val}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      {person.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${person.email}`} className="text-primary hover:underline">{person.email}</a>
                        </div>
                      )}
                      {person.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${person.phone}`} className="hover:underline">{person.phone}</a>
                        </div>
                      )}
                      {person.linkedInUrl && (
                        <div className="flex items-center gap-2 text-sm">
                          <Linkedin className="h-4 w-4 text-blue-500" />
                          <a href={person.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                            LinkedIn Profile <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {!person.email && !person.phone && !person.linkedInUrl && (
                        <p className="text-xs text-muted-foreground">No contact details yet</p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {editing ? (
                    <Textarea
                      value={editData.notes}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      className="text-sm min-h-[120px]"
                      placeholder="Why is this person interesting? What have you discussed?"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {person.notes ?? "No notes yet."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-6 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Source</div>
                  <div className="font-medium capitalize">{person.source ?? "Manual"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last Interaction</div>
                  <div className="font-medium">{person.lastContactedAt ? formatDate(person.lastContactedAt) : "Never"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Interactions</div>
                  <div className="font-medium">{moments?.length ?? 0}</div>
                </div>
              </CardContent>
            </Card>

            <WebLinksCard entityType="person" entityId={personId} />
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline" className="mt-4">
            <Card className="border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold">Interaction History</CardTitle>
                <LogMomentDialog personId={personId} onSuccess={refetchMoments} />
              </CardHeader>
              <CardContent>
                {!moments || moments.length === 0 ? (
                  <div className="py-8 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No interactions logged yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Log your first LinkedIn message, call, or meeting</p>
                  </div>
                ) : (
                  <div className="relative pl-5 space-y-4">
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                    {moments.map((m) => (
                      <div key={m.id} className="relative">
                        <div className="absolute -left-3 top-1.5 h-2 w-2 rounded-full bg-primary border-2 border-background" />
                        <div className="bg-muted/30 rounded-lg p-3 border">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold capitalize">{m.type}</span>
                              <span className="text-xs text-muted-foreground capitalize">{m.direction}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${OUTCOME_COLORS[m.outcome ?? "neutral"] ?? ""}`}>
                                {m.outcome ?? "neutral"}
                              </span>
                            </div>
                            <EditableMomentDate moment={m} onUpdated={refetchMoments} />
                          </div>
                          {m.subject && <p className="text-sm font-medium">{m.subject}</p>}
                          {m.type === "email" && (m.emailRaw || m.notes) ? (
                            <EmailBody html={m.emailRaw} text={m.notes} />
                          ) : m.notes ? (
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{m.notes}</p>
                          ) : null}
                          {m.followUpAt && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                              <Checkbox
                                checked={!!m.followUpDone}
                                onCheckedChange={(checked) => {
                                  toggleFollowUpMutation.mutate({
                                    id: m.id,
                                    data: { followUpDone: !!checked },
                                  });
                                }}
                                className="h-3.5 w-3.5"
                              />
                              <span className={`text-xs ${
                                m.followUpDone
                                  ? "text-muted-foreground line-through"
                                  : new Date(m.followUpAt) < new Date()
                                    ? "text-red-600 font-medium"
                                    : "text-amber-600"
                              }`}>
                                Follow-up {m.followUpDone ? "done" : `due ${formatDate(m.followUpAt)}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Linked Leads */}
          <TabsContent value="leads" className="mt-4">
            <Card className="border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold">Linked Companies / Events</CardTitle>
                <LinkLeadDialog personId={personId} onSuccess={refetchLinks} />
              </CardHeader>
              <CardContent>
                {!leadLinks || leadLinks.length === 0 ? (
                  <div className="py-8 text-center">
                    <Link2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Not linked to any leads yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Link this person to a company or event lead</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leadLinks.map(({ link, lead }) => (
                      <div key={link.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <button
                              className="font-medium text-sm hover:text-primary transition-colors"
                              onClick={() => navigate(`/leads/${lead.id}`)}
                            >
                              {lead.companyName}
                            </button>
                            <div className="text-xs text-muted-foreground">
                              {RELATIONSHIP_LABELS[link.relationship] ?? link.relationship}
                              {lead.industry ? ` · ${lead.industry}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">{lead.status}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => unlinkMutation.mutate({ personId, leadId: lead.id })}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
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
