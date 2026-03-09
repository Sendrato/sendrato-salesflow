import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ExternalLink, Globe, Pencil, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";

type EntityType = "lead" | "person" | "competitor";

interface WebLinksCardProps {
  entityType: EntityType;
  entityId: number;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  website: { label: "Website", color: "bg-blue-100 text-blue-700" },
  article: { label: "Article", color: "bg-purple-100 text-purple-700" },
  news: { label: "News", color: "bg-amber-100 text-amber-700" },
  social: { label: "Social", color: "bg-pink-100 text-pink-700" },
  documentation: { label: "Docs", color: "bg-green-100 text-green-700" },
  review: { label: "Review", color: "bg-orange-100 text-orange-700" },
  video: { label: "Video", color: "bg-red-100 text-red-700" },
  other: { label: "Other", color: "bg-gray-100 text-gray-700" },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG);

export default function WebLinksCard({ entityType, entityId }: WebLinksCardProps) {
  const leadQuery = trpc.webLinks.listByLead.useQuery(
    { leadId: entityId },
    { enabled: entityType === "lead" }
  );
  const personQuery = trpc.webLinks.listByPerson.useQuery(
    { personId: entityId },
    { enabled: entityType === "person" }
  );
  const competitorQuery = trpc.webLinks.listByCompetitor.useQuery(
    { competitorId: entityId },
    { enabled: entityType === "competitor" }
  );

  const activeQuery =
    entityType === "lead"
      ? leadQuery
      : entityType === "person"
        ? personQuery
        : competitorQuery;

  const links = activeQuery.data ?? [];

  const createMutation = trpc.webLinks.create.useMutation({
    onSuccess: () => {
      activeQuery.refetch();
      toast.success("Link added");
    },
    onError: () => toast.error("Failed to add link"),
  });

  const updateMutation = trpc.webLinks.update.useMutation({
    onSuccess: () => {
      activeQuery.refetch();
      toast.success("Link updated");
    },
    onError: () => toast.error("Failed to update link"),
  });

  const deleteMutation = trpc.webLinks.delete.useMutation({
    onSuccess: () => {
      activeQuery.refetch();
      toast.success("Link removed");
    },
    onError: () => toast.error("Failed to remove link"),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");

  function resetForm() {
    setUrl("");
    setTitle("");
    setDescription("");
    setCategory("other");
  }

  function openEdit(link: any) {
    setUrl(link.url);
    setTitle(link.title ?? "");
    setDescription(link.description ?? "");
    setCategory(link.category);
    setEditingLink(link);
    setAddOpen(true);
  }

  function handleSave() {
    if (editingLink) {
      updateMutation.mutate({
        id: editingLink.id,
        data: {
          url,
          title: title || undefined,
          description: description || undefined,
          category: category as any,
        },
      });
    } else {
      const fk =
        entityType === "lead"
          ? { leadId: entityId }
          : entityType === "person"
            ? { personId: entityId }
            : { competitorId: entityId };
      createMutation.mutate({
        url,
        title: title || undefined,
        description: description || undefined,
        category: category as any,
        ...fk,
      });
    }
    setAddOpen(false);
    setEditingLink(null);
    resetForm();
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Web Links
        </CardTitle>
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) {
              setEditingLink(null);
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Link
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingLink ? "Edit Link" : "Add Web Link"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-sm">URL *</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Link title"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="text-sm min-h-[60px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_CONFIG[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddOpen(false);
                    setEditingLink(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={
                    !url.trim() ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                  onClick={handleSave}
                >
                  {editingLink ? "Save" : "Add Link"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="py-6 text-center">
            <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No web links yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add relevant URLs, articles, or resources
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link: any) => {
              const catCfg =
                CATEGORY_CONFIG[link.category] ?? CATEGORY_CONFIG.other;
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <a
                          href={
                            link.url.startsWith("http")
                              ? link.url
                              : `https://${link.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline truncate flex items-center gap-1"
                        >
                          {link.title ||
                            link.url
                              .replace(/^https?:\/\//, "")
                              .replace(/\/$/, "")
                              .slice(0, 60)}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${catCfg.color}`}
                        >
                          {catCfg.label}
                        </span>
                      </div>
                      {link.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {link.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openEdit(link)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        deleteMutation.mutate({ id: link.id })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
