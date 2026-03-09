import { useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Swords, Globe, Pencil, Save, X,
  Link2, Unlink, FileText, Upload, Download, Trash2,
  Building2, CalendarClock, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRelativeTime } from "@/lib/crm";

const THREAT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: "Low",    color: "text-green-700",  bg: "bg-green-100" },
  medium: { label: "Medium", color: "text-yellow-700", bg: "bg-yellow-100" },
  high:   { label: "High",   color: "text-red-700",    bg: "bg-red-100" },
};

export default function CompetitorDetailPage() {
  const params = useParams<{ id: string }>();
  const competitorId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});

  const { data: competitor, isLoading, refetch } = trpc.competitors.get.useQuery({ id: competitorId });
  const { data: leadLinks, refetch: refetchLinks } = trpc.competitors.getLeadLinks.useQuery({ competitorId });
  const { data: documents, refetch: refetchDocs } = trpc.competitors.listDocuments.useQuery({ competitorId });

  const updateMutation = trpc.competitors.update.useMutation({
    onSuccess: () => { refetch(); setEditing(false); toast.success("Saved"); },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMutation = trpc.competitors.delete.useMutation({
    onSuccess: () => { toast.success("Competitor deleted"); navigate("/competitors"); },
    onError: () => toast.error("Failed to delete"),
  });

  const unlinkMutation = trpc.competitors.unlinkFromLead.useMutation({
    onSuccess: () => { refetchLinks(); toast.success("Unlinked"); },
    onError: () => toast.error("Failed to unlink"),
  });

  // Document upload
  const [uploadCategory, setUploadCategory] = useState("other");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("competitorId", String(competitorId));
    formData.append("category", uploadCategory);
    try {
      const res = await fetch("/api/upload-competitor-document", { method: "POST", body: formData });
      if (res.ok) {
        refetchDocs();
        toast.success(`"${file.name}" uploaded`);
      } else {
        toast.error("Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [competitorId, uploadCategory, refetchDocs]);

  const deleteDocMutation = trpc.competitors.deleteDocument.useMutation({
    onSuccess: () => { refetchDocs(); toast.success("Document deleted"); },
    onError: () => toast.error("Failed to delete document"),
  });

  function startEdit() {
    if (!competitor) return;
    setEditData({
      name: competitor.name ?? "",
      website: competitor.website ?? "",
      description: competitor.description ?? "",
      products: competitor.products ?? "",
      regions: competitor.regions ?? "",
      pricing: competitor.pricing ?? "",
      businessModel: competitor.businessModel ?? "",
      threatLevel: competitor.threatLevel ?? "medium",
      strengths: competitor.strengths ?? "",
      weaknesses: competitor.weaknesses ?? "",
      notes: competitor.notes ?? "",
    });
    setEditing(true);
  }

  function saveEdit() {
    updateMutation.mutate({
      id: competitorId,
      data: {
        name: editData.name || undefined,
        website: editData.website || undefined,
        description: editData.description || undefined,
        products: editData.products || undefined,
        regions: editData.regions || undefined,
        pricing: editData.pricing || undefined,
        businessModel: editData.businessModel || undefined,
        threatLevel: (editData.threatLevel as any) || undefined,
        strengths: editData.strengths || undefined,
        weaknesses: editData.weaknesses || undefined,
        notes: editData.notes || undefined,
      },
    });
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!competitor) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-muted-foreground">Competitor not found</div>
      </DashboardLayout>
    );
  }

  const threatCfg = THREAT_CONFIG[competitor.threatLevel] ?? THREAT_CONFIG.medium;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/competitors")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Swords className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{competitor.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${threatCfg.bg} ${threatCfg.color}`}>
                  {threatCfg.label} Threat
                </span>
                {competitor.website && (
                  <a
                    href={competitor.website.startsWith("http") ? competitor.website : `https://${competitor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Globe className="h-3 w-3" />
                    {competitor.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Delete this competitor?")) deleteMutation.mutate({ id: competitorId });
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="leads">
              Linked Leads {leadLinks?.length ? `(${leadLinks.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents {documents?.length ? `(${documents.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Company Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Field label="Description" field="description" editing={editing} editData={editData} setEditData={setEditData} value={competitor.description} multiline />
                  <Field label="Website" field="website" editing={editing} editData={editData} setEditData={setEditData} value={competitor.website} />
                  <Field label="Business Model" field="businessModel" editing={editing} editData={editData} setEditData={setEditData} value={competitor.businessModel} multiline />
                  {editing && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Threat Level</Label>
                      <Select value={editData.threatLevel} onValueChange={(v) => setEditData({ ...editData, threatLevel: v })}>
                        <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(THREAT_CONFIG).map(([val, cfg]) => (
                            <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Competitive Intelligence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Field label="Strengths" field="strengths" editing={editing} editData={editData} setEditData={setEditData} value={competitor.strengths} multiline />
                  <Field label="Weaknesses" field="weaknesses" editing={editing} editData={editData} setEditData={setEditData} value={competitor.weaknesses} multiline />
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Products / Services</CardTitle>
                </CardHeader>
                <CardContent>
                  <Field field="products" editing={editing} editData={editData} setEditData={setEditData} value={competitor.products} multiline />
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Regions / Markets</CardTitle>
                </CardHeader>
                <CardContent>
                  <Field field="regions" editing={editing} editData={editData} setEditData={setEditData} value={competitor.regions} />
                </CardContent>
              </Card>
            </div>

            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <Field field="pricing" editing={editing} editData={editData} setEditData={setEditData} value={competitor.pricing} multiline />
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Field field="notes" editing={editing} editData={editData} setEditData={setEditData} value={competitor.notes} multiline />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Linked Leads Tab */}
          <TabsContent value="leads" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <LinkLeadDialog competitorId={competitorId} onSuccess={refetchLinks} />
            </div>

            {!leadLinks?.length ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No leads linked yet. Link leads to track which ones use this competitor.
              </div>
            ) : (
              <div className="grid gap-3">
                {leadLinks.map(({ link, lead }) => {
                  const contractEnding = link.contractEndDate && new Date(link.contractEndDate) < new Date(Date.now() + 90 * 86400000);
                  return (
                    <Card key={link.id} className={`border shadow-sm ${contractEnding ? "border-amber-300" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <button
                                className="font-medium text-sm text-primary hover:underline"
                                onClick={() => navigate(`/leads/${lead.id}`)}
                              >
                                {lead.companyName}
                              </button>
                              <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                              {contractEnding && (
                                <Badge variant="destructive" className="text-xs">Contract ending soon</Badge>
                              )}
                            </div>
                            {lead.industry && <div className="text-xs text-muted-foreground">{lead.industry}</div>}
                            {link.competitorProduct && (
                              <div className="text-xs"><span className="text-muted-foreground">Using:</span> {link.competitorProduct}</div>
                            )}
                            <div className="flex gap-4 mt-2 text-xs">
                              {link.contractStartDate && (
                                <span className="text-muted-foreground">
                                  <CalendarClock className="h-3 w-3 inline mr-1" />
                                  {formatDate(link.contractStartDate)} — {link.contractEndDate ? formatDate(link.contractEndDate) : "ongoing"}
                                </span>
                              )}
                              {link.satisfaction && (
                                <span className="text-muted-foreground capitalize">Satisfaction: {link.satisfaction}</span>
                              )}
                            </div>
                            {link.likes && (
                              <div className="text-xs mt-1 flex items-start gap-1">
                                <ThumbsUp className="h-3 w-3 text-green-600 mt-0.5 shrink-0" />
                                <span className="whitespace-pre-wrap">{link.likes}</span>
                              </div>
                            )}
                            {link.dislikes && (
                              <div className="text-xs mt-1 flex items-start gap-1">
                                <ThumbsDown className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                                <span className="whitespace-pre-wrap">{link.dislikes}</span>
                              </div>
                            )}
                            {link.notes && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{link.notes}</div>}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => unlinkMutation.mutate({ competitorId, leadId: lead.id })}
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4 space-y-4">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Upload Document</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 items-center">
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger className="w-[180px] text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="presentation">Presentation</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.html,.htm,.xlsx,.xls,.docx,.doc,.txt,.md,.pptx,.ppt"
                    onChange={handleFileUpload}
                  />
                  <Button variant="outline" className="gap-2 flex-1" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Choose File
                  </Button>
                </div>
              </CardContent>
            </Card>

            {!documents?.length ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No documents yet
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <Card key={doc.id} className="border shadow-sm">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{doc.fileName}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="capitalize">{doc.category}</span>
                            {doc.chunkCount > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">AI Indexed</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => deleteDocMutation.mutate({ id: doc.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ─── Reusable field component ────────────────────────────────────────────────

function Field({
  label,
  field,
  editing,
  editData,
  setEditData,
  value,
  multiline,
}: {
  label?: string;
  field: string;
  editing: boolean;
  editData: Record<string, string>;
  setEditData: (d: Record<string, string>) => void;
  value?: string | null;
  multiline?: boolean;
}) {
  if (editing) {
    return (
      <div className="space-y-1">
        {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
        {multiline ? (
          <Textarea
            value={editData[field] ?? ""}
            onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
            className="text-sm min-h-[60px]"
          />
        ) : (
          <Input
            value={editData[field] ?? ""}
            onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
            className="text-sm h-8"
          />
        )}
      </div>
    );
  }
  return (
    <div>
      {label && <div className="text-xs text-muted-foreground">{label}</div>}
      <div className="text-sm whitespace-pre-wrap">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

// ─── Link Lead Dialog ────────────────────────────────────────────────────────

function LinkLeadDialog({ competitorId, onSuccess }: { competitorId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [product, setProduct] = useState("");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [likes, setLikes] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [satisfaction, setSatisfaction] = useState("");
  const [intelSource, setIntelSource] = useState("");
  const [notes, setNotes] = useState("");

  const { data: leadsData } = trpc.leads.list.useQuery(
    { search: search || undefined, limit: 10 },
    { enabled: open }
  );

  const linkMutation = trpc.competitors.linkToLead.useMutation({
    onSuccess: () => {
      toast.success("Lead linked");
      setOpen(false);
      resetForm();
      onSuccess();
    },
    onError: () => toast.error("Failed to link lead"),
  });

  function resetForm() {
    setSearch(""); setSelectedLeadId(null); setProduct("");
    setContractStart(""); setContractEnd(""); setLikes("");
    setDislikes(""); setSatisfaction(""); setIntelSource(""); setNotes("");
  }

  const selectedLead = leadsData?.items?.find((l: any) => l.id === selectedLeadId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Link2 className="h-4 w-4" /> Link Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Lead to Competitor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Search Lead</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name..."
              className="text-sm"
            />
            {leadsData?.items && leadsData.items.length > 0 && !selectedLeadId && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {leadsData.items.map((lead: any) => (
                  <button
                    key={lead.id}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50"
                    onClick={() => { setSelectedLeadId(lead.id); setSearch(lead.companyName); }}
                  >
                    {lead.companyName}
                  </button>
                ))}
              </div>
            )}
            {selectedLead && (
              <div className="text-xs text-green-600">Selected: {selectedLead.companyName}</div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Competitor Product Used</Label>
            <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Which product/service?" className="text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Contract Start</Label>
              <Input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Contract End</Label>
              <Input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} className="text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Satisfaction</Label>
            <Select value={satisfaction} onValueChange={setSatisfaction}>
              <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="happy">Happy</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="unhappy">Unhappy</SelectItem>
                <SelectItem value="looking_to_switch">Looking to switch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">What do they like?</Label>
            <Textarea value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="What the lead likes about this competitor" className="text-sm min-h-[50px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">What do they dislike?</Label>
            <Textarea value={dislikes} onChange={(e) => setDislikes(e.target.value)} placeholder="Pain points with the competitor" className="text-sm min-h-[50px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Intelligence Source</Label>
            <Input value={intelSource} onChange={(e) => setIntelSource(e.target.value)} placeholder="e.g. told us in demo, public info" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[50px]" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!selectedLeadId || linkMutation.isPending}
              onClick={() => linkMutation.mutate({
                competitorId,
                leadId: selectedLeadId!,
                competitorProduct: product || undefined,
                contractStartDate: contractStart || undefined,
                contractEndDate: contractEnd || undefined,
                likes: likes || undefined,
                dislikes: dislikes || undefined,
                satisfaction: satisfaction || undefined,
                intelSource: intelSource || undefined,
                notes: notes || undefined,
              })}
            >
              {linkMutation.isPending ? "Linking..." : "Link Lead"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
