import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Eye } from "lucide-react";

type ShareData = {
  title: string;
  fileName: string;
  mimeType: string;
  fileUrl: string;
  viewCount: number;
  isActive: boolean;
  leadName?: string;
};

export default function SharedPresentation() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share-info/${token}`)
      .then(r => {
        if (!r.ok)
          throw new Error(
            r.status === 404
              ? "This link is no longer active or does not exist."
              : "Failed to load presentation."
          );
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Loading presentation...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">Presentation Not Found</h2>
          <p className="text-sm text-muted-foreground">
            {error ?? "This presentation link is no longer available."}
          </p>
        </div>
      </div>
    );
  }

  const isHtml =
    data.mimeType === "text/html" ||
    data.fileName.endsWith(".html") ||
    data.fileName.endsWith(".htm");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-900 border-b px-6 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="font-semibold text-sm">{data.title}</h1>
          {data.leadName && (
            <p className="text-xs text-muted-foreground">
              Shared by SalesFlow CRM
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          {data.viewCount} view{data.viewCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {isHtml ? (
          <iframe
            src={data.fileUrl}
            className="w-full h-full border-0"
            style={{ minHeight: "calc(100vh - 57px)" }}
            title={data.title}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[calc(100vh-57px)]">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                This file type is best viewed by downloading.
              </p>
              <a
                href={data.fileUrl}
                download={data.fileName}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Download {data.fileName}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
