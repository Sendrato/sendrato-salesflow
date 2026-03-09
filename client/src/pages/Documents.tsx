import { useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/crm";

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

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("other");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: documents = [], isLoading } = trpc.crmDocuments.list.useQuery({
    search: search || undefined,
    category: category !== "all" ? category : undefined,
  });

  const deleteMutation = trpc.crmDocuments.delete.useMutation({
    onSuccess: () => {
      utils.crmDocuments.list.invalidate();
      toast.success("Document deleted");
    },
    onError: () => toast.error("Failed to delete document"),
  });

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
      try {
        const res = await fetch("/api/upload-crm-document", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          utils.crmDocuments.list.invalidate();
          toast.success(`"${file.name}" uploaded`);
          setDescription("");
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
    [uploadCategory, description, user, utils]
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Team document library — presentations, price sheets, templates, and
            more.
          </p>
        </div>

        {/* Upload Section */}
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upload Document
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">
                Description (optional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
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
          <div className="border rounded-lg overflow-hidden">
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
                            onClick={() =>
                              deleteMutation.mutate({ id: doc.id })
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
      </div>
    </DashboardLayout>
  );
}
