import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { AIChatBox } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Lightbulb,
  Sparkles,
  Pencil,
  Save,
  X,
  Trash2,
  Loader2,
  MessageSquare,
  TrendingUp,
  ShieldAlert,
  Target,
  CheckCircle2,
  ExternalLink,
  Search as SearchIcon,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/crm";
import type { UIMessage } from "ai";

export default function BrainstormDetailPage() {
  const params = useParams<{ id: string }>();
  const brainstormId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editLeadId, setEditLeadId] = useState<number | null>(null);
  const [leadSearch, setLeadSearch] = useState("");

  const {
    data: brainstorm,
    isLoading,
    refetch,
  } = trpc.brainstorm.get.useQuery({ id: brainstormId });

  const { data: leadsData } = trpc.leads.list.useQuery(
    { search: leadSearch || undefined, limit: 20 },
    { enabled: editing }
  );

  const updateMutation = trpc.brainstorm.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(false);
      toast.success("Saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMutation = trpc.brainstorm.delete.useMutation({
    onSuccess: () => {
      toast.success("Idea deleted");
      navigate("/brainstorm");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const enrichMutation = trpc.brainstorm.enrich.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Enrichment complete");
    },
    onError: (err) =>
      toast.error(err.message ?? "Enrichment failed"),
  });

  const saveChatMutation = trpc.brainstorm.saveChatMessages.useMutation();

  function startEditing() {
    if (!brainstorm) return;
    setEditTitle(brainstorm.title);
    setEditContent(brainstorm.content ?? "");
    setEditLeadId(brainstorm.leadId);
    setEditing(true);
  }

  function saveEdit() {
    updateMutation.mutate({
      id: brainstormId,
      data: {
        title: editTitle.trim(),
        content: editContent || undefined,
        leadId: editLeadId,
      },
    });
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!brainstorm) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-muted-foreground">
          Brainstorm not found
        </div>
      </DashboardLayout>
    );
  }

  const enrichment = brainstorm.enrichmentData as Record<
    string,
    unknown
  > | null;
  const chatMessages = (brainstorm.chatMessages ?? []) as UIMessage[];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/brainstorm")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Lightbulb className="h-6 w-6 text-primary" />
                {brainstorm.title}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {brainstorm.enrichedAt ? (
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
                <span className="text-xs text-muted-foreground">
                  Updated {formatRelativeTime(brainstorm.updatedAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={startEditing}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => deleteMutation.mutate({ id: brainstormId })}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="idea" className="space-y-4">
          <TabsList>
            <TabsTrigger value="idea" className="gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Idea
            </TabsTrigger>
            <TabsTrigger value="enrichment" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Enrichment
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </TabsTrigger>
          </TabsList>

          {/* Idea Tab */}
          <TabsContent value="idea" className="space-y-4">
            {editing ? (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Title</Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Description</Label>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="text-sm min-h-[200px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Link to Lead (optional)</Label>
                    <Select
                      value={editLeadId?.toString() ?? "none"}
                      onValueChange={(v) =>
                        setEditLeadId(v === "none" ? null : parseInt(v))
                      }
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="No linked lead" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Search leads..."
                            value={leadSearch}
                            onChange={(e) => setLeadSearch(e.target.value)}
                            className="text-sm h-8"
                          />
                        </div>
                        <SelectItem value="none">No linked lead</SelectItem>
                        {(leadsData?.items ?? []).map((l) => (
                          <SelectItem key={l.id} value={l.id.toString()}>
                            {l.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={saveEdit}
                      disabled={
                        !editTitle.trim() || updateMutation.isPending
                      }
                    >
                      <Save className="h-3.5 w-3.5" />
                      {updateMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 space-y-4">
                  {brainstorm.leadId && (
                    <div className="flex items-center gap-2 text-sm">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Linked to:
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-sm"
                        onClick={() =>
                          navigate(`/leads/${brainstorm.leadId}`)
                        }
                      >
                        Lead #{brainstorm.leadId}
                      </Button>
                    </div>
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {brainstorm.content || (
                      <span className="text-muted-foreground italic">
                        No description yet. Click Edit to add one.
                      </span>
                    )}
                  </div>
                  {(brainstorm.tags ?? []).length > 0 && (
                    <div className="flex gap-1 flex-wrap pt-2">
                      {(brainstorm.tags as string[]).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="pt-4">
                    <Button
                      className="gap-2"
                      onClick={() =>
                        enrichMutation.mutate({ id: brainstormId })
                      }
                      disabled={enrichMutation.isPending}
                    >
                      {enrichMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {enrichMutation.isPending
                        ? "Enriching..."
                        : brainstorm.enrichedAt
                          ? "Re-enrich with AI"
                          : "Enrich with AI"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Enrichment Tab */}
          <TabsContent value="enrichment" className="space-y-4">
            {!enrichment ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Not enriched yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click &quot;Enrich with AI&quot; on the Idea tab to
                    generate an analysis
                  </p>
                  <Button
                    className="gap-2 mt-4"
                    onClick={() =>
                      enrichMutation.mutate({ id: brainstormId })
                    }
                    disabled={enrichMutation.isPending}
                  >
                    {enrichMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {enrichMutation.isPending
                      ? "Enriching..."
                      : "Enrich with AI"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <EnrichmentCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    title="Market Research"
                    content={enrichment.marketResearch as string}
                  />
                  <EnrichmentCard
                    icon={<Target className="h-4 w-4" />}
                    title="Feasibility"
                    content={enrichment.feasibility as string}
                  />
                  <EnrichmentCard
                    icon={<SearchIcon className="h-4 w-4" />}
                    title="Related Opportunities"
                    content={
                      enrichment.relatedOpportunities as string
                    }
                  />
                  <EnrichmentCard
                    icon={<ShieldAlert className="h-4 w-4" />}
                    title="Competitive Analysis"
                    content={enrichment.competitiveAnalysis as string}
                  />
                  <EnrichmentCard
                    icon={<ShieldAlert className="h-4 w-4" />}
                    title="Risks"
                    content={enrichment.risks as string}
                  />
                  <EnrichmentCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    title="Potential Value"
                    content={enrichment.potentialValue as string}
                  />
                </div>

                {/* Action Items */}
                {Array.isArray(enrichment.actionItems) &&
                  enrichment.actionItems.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Action Items
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-2">
                          {(enrichment.actionItems as string[]).map(
                            (item, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-sm"
                              >
                                <span className="text-muted-foreground font-mono text-xs mt-0.5">
                                  {i + 1}.
                                </span>
                                {item}
                              </li>
                            )
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                {/* Sources */}
                {Array.isArray(enrichment.sources) &&
                  enrichment.sources.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          Sources
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-1.5">
                          {(
                            enrichment.sources as Array<{
                              title: string;
                              url: string;
                              type: string;
                            }>
                          ).map((source, i) => (
                            <li key={i}>
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1.5"
                              >
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5"
                                >
                                  {source.type}
                                </Badge>
                                {source.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      enrichMutation.mutate({ id: brainstormId })
                    }
                    disabled={enrichMutation.isPending}
                  >
                    {enrichMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Re-enrich
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent
            value="chat"
            className="h-[calc(100vh-280px)] flex flex-col"
          >
            <AIChatBox
              api="/api/brainstorm-chat"
              chatId={`brainstorm-${brainstormId}`}
              initialMessages={chatMessages}
              onFinish={(messages) => {
                saveChatMutation.mutate({
                  id: brainstormId,
                  chatMessages: messages,
                });
              }}
              placeholder="Ask follow-up questions about your idea..."
              emptyStateMessage="Start a conversation to refine your idea further"
              suggestedPrompts={[
                "What are the biggest risks with this idea?",
                "How could we validate this with minimal investment?",
                "Who are the potential early adopters?",
                "What's the competitive moat here?",
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function EnrichmentCard({
  icon,
  title,
  content,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
}) {
  if (!content) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {content}
        </p>
      </CardContent>
    </Card>
  );
}
