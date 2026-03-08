import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, ArrowRight, X } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

const CRM_FIELDS = [
  { value: "skip", label: "— Skip —" },
  { value: "companyName", label: "Company Name *" },
  { value: "website", label: "Website" },
  { value: "industry", label: "Industry" },
  { value: "location", label: "Location" },
  { value: "country", label: "Country" },
  { value: "contactPerson", label: "Contact Person" },
  { value: "contactTitle", label: "Contact Title" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "notes", label: "Notes" },
  { value: "painPoints", label: "Pain Points" },
  { value: "futureOpportunities", label: "Opportunities" },
  { value: "revenueModel", label: "Revenue Model" },
  { value: "risks", label: "Risks" },
  { value: "source", label: "Source" },
  { value: "estimatedValue", label: "Estimated Value" },
  // Event attributes (stored in leadAttributes JSON)
  { value: "attr:visitorCount", label: "Est. Visitors (Event)" },
  { value: "attr:eventDurationDays", label: "Duration Days (Event)" },
  { value: "attr:typicalDates", label: "Typical Dates (Event)" },
  { value: "attr:region", label: "Region (Event)" },
  { value: "attr:hotelNeedScore", label: "Hotel Need Score (Event)" },
  { value: "attr:revenueEngineFit", label: "Revenue Engine Fit (Event)" },
  { value: "attr:venueCapacity", label: "Venue Capacity (Event)" },
  { value: "attr:eventCategory", label: "Event Category (Event)" },
  { value: "attr:ticketPriceRange", label: "Ticket Price Range (Event)" },
  { value: "attr:organizerName", label: "Organizer (Event)" },
];

const AUTO_DETECT: Record<string, string> = {
  "company name": "companyName", "company": "companyName", "company_name": "companyName",
  "event name": "companyName",
  "website": "website", "url": "website",
  "contact": "contactPerson", "contact person": "contactPerson", "name": "contactPerson",
  "email": "email", "e-mail": "email",
  "phone": "phone", "telephone": "phone",
  "status": "status", "priority": "priority", "notes": "notes",
  "industry": "industry", "location": "location", "country": "country",
  "pain points": "painPoints", "opportunities": "futureOpportunities",
  "revenue model": "revenueModel", "risks": "risks",
  // Event attributes
  "est. visitors": "attr:visitorCount", "visitors": "attr:visitorCount",
  "estimated visitors": "attr:visitorCount",
  "duration (days)": "attr:eventDurationDays", "duration days": "attr:eventDurationDays",
  "typical dates": "attr:typicalDates",
  "region": "attr:region",
  "hotel need score": "attr:hotelNeedScore",
  "revenue engine fit": "attr:revenueEngineFit",
  "venue capacity": "attr:venueCapacity",
  "event category": "attr:eventCategory",
  "ticket price range": "attr:ticketPriceRange",
  "key contact / organiser": "attr:organizerName",
  "organiser": "attr:organizerName", "organizer": "attr:organizerName",
};

type PreviewData = {
  columns: string[];
  preview: Record<string, unknown>[];
  totalRows: number;
};

type ImportResult = {
  success: boolean;
  imported: number;
  total: number;
  skipped: number;
};

export default function Import() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/import/preview", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Preview failed");
      const data: PreviewData = await res.json();
      setPreview(data);
      // Auto-detect column mapping
      const autoMapping: Record<string, string> = {};
      for (const col of data.columns) {
        const normalized = col.toLowerCase().trim();
        autoMapping[col] = AUTO_DETECT[normalized] ?? "skip";
      }
      setMapping(autoMapping);
    } catch {
      toast.error("Failed to preview file");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Build mapping excluding "skip"
      const effectiveMapping: Record<string, string> = {};
      for (const [col, field] of Object.entries(mapping)) {
        if (field !== "skip") effectiveMapping[col.toLowerCase().trim()] = field;
      }
      formData.append("mapping", JSON.stringify(effectiveMapping));
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Import failed");
      const data: ImportResult = await res.json();
      setResult(data);
      toast.success(`Imported ${data.imported} leads successfully!`);
    } catch {
      toast.error("Import failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Import Leads</h1>
          <p className="text-sm text-muted-foreground">Upload Excel (.xlsx) or CSV files to bulk import leads</p>
        </div>

        {/* Success State */}
        {result && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <div className="font-semibold text-green-800">Import Successful!</div>
                  <div className="text-sm text-green-700 mt-0.5">
                    {result.imported} leads imported · {result.skipped} rows skipped
                  </div>
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={reset}>
                  Import Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Drop Zone */}
        {!file && (
          <Card
            className={`border-2 border-dashed transition-colors cursor-pointer ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="p-12 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="text-lg font-medium mb-1">Drop your file here</div>
              <div className="text-sm text-muted-foreground mb-4">
                Supports Excel (.xlsx) and CSV files
              </div>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Browse Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
            <span className="text-muted-foreground">Processing file...</span>
          </div>
        )}

        {/* Preview & Mapping */}
        {preview && !loading && !result && (
          <>
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">File Preview</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {file?.name} · {preview.totalRows} rows detected
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {preview.columns.map((col) => (
                          <TableHead key={col} className="min-w-[140px]">
                            <div className="space-y-1.5">
                              <div className="text-xs font-medium truncate max-w-[140px]" title={col}>{col}</div>
                              <Select
                                value={mapping[col] ?? "skip"}
                                onValueChange={(v) => setMapping((m) => ({ ...m, [col]: v }))}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CRM_FIELDS.map((f) => (
                                    <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.preview.map((row, i) => (
                        <TableRow key={i}>
                          {preview.columns.map((col) => (
                            <TableCell key={col} className="text-xs max-w-[140px]">
                              <div className="truncate" title={String(row[col] ?? "")}>
                                {String(row[col] ?? "—")}
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Mapping Summary */}
            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Ready to import</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {Object.values(mapping).filter((v) => v !== "skip").length} columns mapped ·{" "}
                      {preview.totalRows} rows to process
                    </div>
                    {!Object.values(mapping).includes("companyName") && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-yellow-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Map at least one column to "Company Name"
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={!Object.values(mapping).includes("companyName")}
                    className="gap-2"
                  >
                    Import {preview.totalRows} Leads
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Integration Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Email CC Ingestion",
              desc: "CC crm@yourdomain.com on any email to automatically log it as a contact moment.",
              endpoint: "POST /api/email-ingest",
              badge: "Webhook",
            },
            {
              title: "Slack Integration",
              desc: "Use /crm-lead, /crm-note, or /crm-search commands in Slack to interact with your CRM.",
              endpoint: "POST /api/slack-webhook",
              badge: "Slack",
            },
            {
              title: "API Import",
              desc: "Send Excel or CSV files programmatically via the REST API for automated data ingestion.",
              endpoint: "POST /api/import",
              badge: "REST API",
            },
          ].map((item) => (
            <Card key={item.title} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">{item.title}</div>
                  <Badge variant="outline" className="text-xs">{item.badge}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{item.desc}</p>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{item.endpoint}</code>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
