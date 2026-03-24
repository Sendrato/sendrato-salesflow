import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  BookOpen,
  Upload,
  Search,
  Trash2,
  ExternalLink,
  Download,
  Share2,
  Copy,
  Eye,
  Link,
  Loader2,
  Lock,
  Globe,
  Users,
  Building2,
} from "lucide-react";
import { Link as RouterLink } from "wouter";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/crm";
import { UserAccessPicker } from "@/components/UserAccessPicker";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "proposal", label: "Proposal" },
  { value: "contract", label: "Contract" },
  { value: "presentation", label: "Presentation" },
  { value: "report", label: "Report" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  proposal: "bg-blue-100 text-blue-700",
  contract: "bg-amber-100 text-amber-700",
  presentation: "bg-purple-100 text-purple-700",
  report: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-700",
};

const ACCEPTED_TYPES =
  ".pdf,.html,.htm,.xlsx,.xls,.docx,.doc,.txt,.md,.pptx,.ppt";

function getDocIcon(mimeType?: string | null, fileName?: string) {
  const m = (mimeType ?? "").toLowerCase();
  const n = (fileName ?? "").toLowerCase();
  if (m === "text/html" || n.endsWith(".html") || n.endsWith(".htm"))
    return <FileCode className="h-5 w-5 text-orange-400 shrink-0" />;
  if (m === "application/pdf" || n.endsWith(".pdf"))
    return <FileText className="h-5 w-5 text-red-400 shrink-0" />;
  if (
    n.endsWith(".xlsx") ||
    n.endsWith(".xls") ||
    m.includes("spreadsheet") ||
    m.includes("excel")
  )
    return <FileSpreadsheet className="h-5 w-5 text-green-400 shrink-0" />;
  if (
    n.endsWith(".docx") ||
    n.endsWith(".doc") ||
    m.includes("word") ||
    n.endsWith(".pptx") ||
    n.endsWith(".ppt") ||
    m.includes("presentation")
  )
    return <BookOpen className="h-5 w-5 text-blue-400 shrink-0" />;
  return <FileText className="h-5 w-5 text-muted-foreground shrink-0" />;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("team");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadCategory, setLeadCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("other");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadAccessType, setUploadAccessType] = useState<
    "all" | "restricted"
  >("all");
  const [uploadAccessUserIds, setUploadAccessUserIds] = useState<number[]>([]);

  // Edit access dialog state
  const [editAccessDoc, setEditAccessDoc] = useState<any>(null);
  const [editAccessType, setEditAccessType] = useState<"all" | "restricted">(
    "all"
  );
  const [editAccessUserIds, setEditAccessUserIds] = useState<number[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  // Share dialog state
  const [viewDetailsShareId, setViewDetailsShareId] = useState<number | null>(null);
  const [shareDialogDoc, setShareDialogDoc] = useState<any>(null);
  const [shareTitle, setShareTitle] = useState("");
  const [sharing, setSharing] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);

  const { data: documents = [], isLoading } = trpc.crmDocuments.list.useQuery({
    search: search || undefined,
    category: category !== "all" ? category : undefined,
  });

  const { data: leadDocuments = [], isLoading: leadDocsLoading } =
    trpc.documents.listAll.useQuery({
      search: leadSearch || undefined,
      category: leadCategory !== "all" ? leadCategory : undefined,
    });

  const { data: shares, refetch: refetchShares } =
    trpc.crmDocuments.listShares.useQuery();
  const { data: shareViews } = trpc.documents.listShareViews.useQuery(
    { presentationId: viewDetailsShareId! },
    { enabled: viewDetailsShareId !== null }
  );

  const editDocType = editAccessDoc?._docType ?? "crm";
  const accessQuery = trpc.documents.getAccess.useQuery(
    { documentType: editDocType as any, documentId: editAccessDoc?.id ?? 0 },
    { enabled: !!editAccessDoc }
  );

  const setAccessMutation = trpc.documents.setAccess.useMutation({
    onSuccess: () => {
      utils.crmDocuments.list.invalidate();
      utils.documents.listAll.invalidate();
      setEditAccessDoc(null);
      toast.success("Access updated");
    },
    onError: () => toast.error("Failed to update access"),
  });

  const deleteLeadDocMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.listAll.invalidate();
      toast.success("Document deleted");
    },
    onError: () => toast.error("Failed to delete document"),
  });

  const deleteMutation = trpc.crmDocuments.delete.useMutation({
    onSuccess: () => {
      utils.crmDocuments.list.invalidate();
      refetchShares();
      toast.success("Document deleted");
    },
    onError: () => toast.error("Failed to delete document"),
  });

  const deactivateShareMutation = trpc.crmDocuments.deactivateShare.useMutation(
    {
      onSuccess: () => {
        refetchShares();
        toast.success("Share link deactivated");
      },
    }
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      if (user?.id) {
        formData.append("userId", String(user.id));
      }
      if (uploadAccessType === "restricted") {
        formData.append("accessType", "restricted");
        formData.append("accessUserIds", JSON.stringify(uploadAccessUserIds));
      }
      try {
        const res = await fetch("/api/upload-crm-document", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          utils.crmDocuments.list.invalidate();
          toast.success(`"${file.name}" uploaded`);
          setDescription("");
          setUploadAccessType("all");
          setUploadAccessUserIds([]);
        } else {
          toast.error("Upload failed");
        }
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [
      uploadCategory,
      description,
      user,
      utils,
      uploadAccessType,
      uploadAccessUserIds,
    ]
  );

  const handleShare = async () => {
    if (!shareDialogDoc) return;
    setSharing(true);
    try {
      const res = await fetch("/api/share-crm-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: shareDialogDoc.id,
          title: shareTitle || shareDialogDoc.fileName,
          userId: user?.id,
        }),
      });
      if (res.ok) {
        const { shareUrl } = await res.json();
        setSharedUrl(shareUrl);
        refetchShares();
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

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage team documents and view documents attached to leads.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="team">Team Library</TabsTrigger>
            <TabsTrigger value="lead">Lead Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="mt-4 space-y-6">
            {/* Upload Section */}
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Upload Document
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Category
                  </label>
                  <Select
                    value={uploadCategory}
                    onValueChange={setUploadCategory}
                  >
                    <SelectTrigger className="w-[160px] h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter(c => c.value !== "all").map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <UserAccessPicker
                  accessType={uploadAccessType}
                  selectedUserIds={uploadAccessUserIds}
                  onAccessTypeChange={setUploadAccessType}
                  onSelectedUsersChange={setUploadAccessUserIds}
                />
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground">
                    Description (optional)
                  </label>
                  <Input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief description..."
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Uploading..." : "Choose File"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Document List */}
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Loading...
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center border rounded-lg">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-medium">
                  No documents yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload presentations, price sheets, templates, and other team
                  resources.
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Document
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                        Category
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                        Description
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                        Access
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                        Uploaded By
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                        Date
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc: any) => {
                      const catColor =
                        CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.other;
                      const fileUrl = doc.fileUrl?.startsWith("http")
                        ? doc.fileUrl
                        : doc.fileUrl;
                      return (
                        <tr
                          key={doc.id}
                          className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {getDocIcon(doc.mimeType, doc.fileName)}
                              <div className="min-w-0">
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-foreground hover:text-primary hover:underline truncate block"
                                >
                                  {doc.fileName}
                                </a>
                                {doc.fileSize ? (
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(doc.fileSize)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${catColor}`}
                            >
                              {doc.category
                                ? doc.category.charAt(0).toUpperCase() +
                                  doc.category.slice(1)
                                : "Other"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-muted-foreground text-xs line-clamp-2 max-w-[200px]">
                              {doc.description || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <button
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                              title="Edit access"
                              onClick={() => {
                                setEditAccessDoc({ ...doc, _docType: "crm" });
                                setEditAccessType(doc.accessType ?? "all");
                                setEditAccessUserIds([]);
                              }}
                            >
                              {doc.accessType === "restricted" ? (
                                <>
                                  <Lock className="h-3 w-3 text-amber-500" />
                                  <span className="text-amber-700">
                                    Restricted
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Globe className="h-3 w-3 text-green-500" />
                                  <span className="text-green-700">
                                    All users
                                  </span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {doc.uploaderName || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(doc.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Share"
                                onClick={() => {
                                  setShareDialogDoc(doc);
                                  setShareTitle(doc.fileName);
                                  setSharedUrl(null);
                                }}
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Open in new tab"
                                asChild
                              >
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Download"
                                asChild
                              >
                                <a href={fileUrl} download={doc.fileName}>
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                title="Delete"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Delete this document? This cannot be undone."
                                    )
                                  ) {
                                    deleteMutation.mutate({ id: doc.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Active Share Links */}
            {(shares ?? []).length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 border-b">
                  <h3 className="text-sm font-semibold">Active Share Links</h3>
                </div>
                <div className="divide-y">
                  {(shares ?? []).map((share: any) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {share.title ?? share.fileName}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <button
                            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer underline-offset-2 hover:underline"
                            onClick={() => setViewDetailsShareId(share.id)}
                          >
                            <Eye className="h-3 w-3" /> {share.viewCount ?? 0}{" "}
                            views
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {share.fileName}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 gap-1 text-xs"
                          onClick={() => {
                            const url = `${window.location.origin}/share/${share.token}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Link copied!");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 gap-1 text-xs"
                          asChild
                        >
                          <a
                            href={`/share/${share.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Preview
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            deactivateShareMutation.mutate({
                              token: share.token,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="lead" className="mt-4 space-y-6">
            {/* Lead Documents Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  placeholder="Search by document or lead name..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={leadCategory} onValueChange={setLeadCategory}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lead Documents Table */}
            {leadDocsLoading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Loading...
              </div>
            ) : leadDocuments.length === 0 ? (
              <div className="py-12 text-center border rounded-lg">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-medium">
                  No lead documents found
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Documents uploaded to individual leads will appear here.
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Document
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Lead
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                        Category
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                        Access
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                        Uploaded By
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                        Date
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadDocuments.map((doc: any) => {
                      const catColor =
                        CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.other;
                      return (
                        <tr
                          key={doc.id}
                          className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {getDocIcon(doc.mimeType, doc.fileName)}
                              <div className="min-w-0">
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-foreground hover:text-primary hover:underline truncate block"
                                >
                                  {doc.fileName}
                                </a>
                                {doc.fileSize ? (
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(doc.fileSize)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <RouterLink
                              href={`/leads/${doc.leadId}`}
                              className="text-sm text-primary hover:underline flex items-center gap-1.5"
                            >
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[160px]">
                                {doc.companyName}
                              </span>
                            </RouterLink>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${catColor}`}
                            >
                              {doc.category
                                ? doc.category.charAt(0).toUpperCase() +
                                  doc.category.slice(1)
                                : "Other"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <button
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                              title="Edit access"
                              onClick={() => {
                                setEditAccessDoc({ ...doc, _docType: "lead" });
                                setEditAccessType(doc.accessType ?? "all");
                                setEditAccessUserIds([]);
                              }}
                            >
                              {doc.accessType === "restricted" ? (
                                <>
                                  <Lock className="h-3 w-3 text-amber-500" />
                                  <span className="text-amber-700">
                                    Restricted
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Globe className="h-3 w-3 text-green-500" />
                                  <span className="text-green-700">
                                    All users
                                  </span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {doc.uploaderName || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(doc.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Open in new tab"
                                asChild
                              >
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Download"
                                asChild
                              >
                                <a href={doc.fileUrl} download={doc.fileName}>
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                title="Delete"
                                onClick={() =>
                                  deleteLeadDocMutation.mutate({ id: doc.id })
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Share Dialog */}
      <Dialog
        open={!!shareDialogDoc}
        onOpenChange={o => {
          if (!o) {
            setShareDialogDoc(null);
            setSharedUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Share Document
            </DialogTitle>
          </DialogHeader>
          {sharedUrl ? (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200/50">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                  Share link created!
                </p>
                <div className="flex gap-2">
                  <Input value={sharedUrl} readOnly className="text-xs" />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(sharedUrl);
                      toast.success("Copied!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <a href={sharedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview
                  </a>
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setShareDialogDoc(null);
                    setSharedUrl(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Link name (shown to viewer)</Label>
                <Input
                  value={shareTitle}
                  onChange={e => setShareTitle(e.target.value)}
                  placeholder={shareDialogDoc?.fileName}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShareDialogDoc(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleShare}
                  disabled={sharing}
                >
                  {sharing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link className="h-4 w-4" />
                  )}
                  Generate Link
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Access Dialog */}
      <Dialog
        open={!!editAccessDoc}
        onOpenChange={o => {
          if (!o) setEditAccessDoc(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Document Access
            </DialogTitle>
          </DialogHeader>
          <EditAccessDialogContent
            doc={editAccessDoc}
            accessQuery={accessQuery}
            editAccessType={editAccessType}
            setEditAccessType={setEditAccessType}
            editAccessUserIds={editAccessUserIds}
            setEditAccessUserIds={setEditAccessUserIds}
            savingAccess={savingAccess}
            onSave={() => {
              setSavingAccess(true);
              setAccessMutation.mutate(
                {
                  documentType: editAccessDoc._docType ?? "crm",
                  documentId: editAccessDoc.id,
                  accessType: editAccessType,
                  userIds: editAccessUserIds,
                },
                { onSettled: () => setSavingAccess(false) }
              );
            }}
            onCancel={() => setEditAccessDoc(null)}
          />
        </DialogContent>
      </Dialog>
      {/* View Details Dialog */}
      <Dialog
        open={viewDetailsShareId !== null}
        onOpenChange={o => {
          if (!o) setViewDetailsShareId(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>View Details</DialogTitle>
            <DialogDescription>
              Individual views for this shared link
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1 -mx-6 px-6">
            {!shareViews || shareViews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No views recorded yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Location</th>
                    <th className="pb-2 font-medium">IP</th>
                    <th className="pb-2 font-medium">Browser</th>
                    <th className="pb-2 font-medium">Referrer</th>
                  </tr>
                </thead>
                <tbody>
                  {shareViews.map((v: any) => {
                    const cc = v.country?.toUpperCase();
                    const flag = cc
                      ? String.fromCodePoint(
                          ...cc
                            .split("")
                            .map(
                              (c: string) => 0x1f1e6 + c.charCodeAt(0) - 65
                            )
                        )
                      : "";
                    const location = [flag, v.city, cc]
                      .filter(Boolean)
                      .join(" ");
                    const browser = v.userAgent
                      ? v.userAgent.length > 40
                        ? v.userAgent.slice(0, 40) + "..."
                        : v.userAgent
                      : "—";
                    return (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {new Date(v.viewedAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3">{location || "—"}</td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {v.ipAddress ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-xs max-w-[180px] truncate">
                          {browser}
                        </td>
                        <td className="py-2 text-xs max-w-[120px] truncate">
                          {v.referrer ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function EditAccessDialogContent({
  doc,
  accessQuery,
  editAccessType,
  setEditAccessType,
  editAccessUserIds,
  setEditAccessUserIds,
  savingAccess,
  onSave,
  onCancel,
}: {
  doc: any;
  accessQuery: any;
  editAccessType: "all" | "restricted";
  setEditAccessType: (t: "all" | "restricted") => void;
  editAccessUserIds: number[];
  setEditAccessUserIds: (ids: number[]) => void;
  savingAccess: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  // Sync access data when query loads
  const data = accessQuery.data;
  useEffect(() => {
    if (data) {
      setEditAccessType(data.accessType);
      setEditAccessUserIds(data.userIds);
    }
  }, [data, setEditAccessType, setEditAccessUserIds]);

  if (!doc) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground truncate">{doc.fileName}</p>
      <UserAccessPicker
        accessType={editAccessType}
        selectedUserIds={editAccessUserIds}
        onAccessTypeChange={setEditAccessType}
        onSelectedUsersChange={setEditAccessUserIds}
      />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={onSave} disabled={savingAccess}>
          {savingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
