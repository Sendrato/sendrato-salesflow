import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Lightbulb,
  Search,
  Plus,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/crm";

function AddBrainstormDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createMutation = trpc.brainstorm.create.useMutation({
    onSuccess: () => {
      toast.success("Idea created");
      setOpen(false);
      setTitle("");
      setContent("");
      onSuccess();
    },
    onError: () => toast.error("Failed to create idea"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Idea
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            New Brainstorm
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your idea?"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Description</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your idea, notes, or initial thoughts..."
              className="text-sm min-h-[120px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!title.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  title: title.trim(),
                  content: content || undefined,
                })
              }
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BrainstormPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading, refetch } = trpc.brainstorm.list.useQuery({
    search: debouncedSearch || undefined,
    limit: 100,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout((window as any)._brainstormSearchTimer);
    (window as any)._brainstormSearchTimer = setTimeout(
      () => setDebouncedSearch(val),
      300
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-primary" />
              Brainstorm
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Capture ideas and enrich them with AI-powered research
            </p>
          </div>
          <AddBrainstormDialog onSuccess={refetch} />
        </div>

        {/* Search */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ideas..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center">
                <Lightbulb className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No ideas yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first brainstorm and let AI help you explore
                  it
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold">
                      Title
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Linked Lead
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Tags
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Updated
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/brainstorm/${item.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">
                          {item.title}
                        </div>
                        {item.content && (
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-[300px] mt-0.5">
                            {item.content}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {item.leadName ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.enrichedAt ? (
                          <Badge
                            variant="outline"
                            className="text-xs border-green-300 text-green-700 gap-1"
                          >
                            <Sparkles className="h-3 w-3" />
                            Enriched
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs border-gray-300 text-gray-500"
                          >
                            Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(item.tags ?? []).slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(item.updatedAt)}
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

        {total > items.length && (
          <p className="text-xs text-muted-foreground text-center">
            Showing {items.length} of {total} ideas
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
