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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Swords, Search, Plus, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/crm";

const THREAT_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  low: { label: "Low", color: "text-green-700", bg: "bg-green-100" },
  medium: { label: "Medium", color: "text-yellow-700", bg: "bg-yellow-100" },
  high: { label: "High", color: "text-red-700", bg: "bg-red-100" },
};

function ThreatBadge({ level }: { level: string }) {
  const cfg = THREAT_CONFIG[level] ?? THREAT_CONFIG.medium;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

function AddCompetitorDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [threatLevel, setThreatLevel] = useState("medium");
  const [products, setProducts] = useState("");
  const [regions, setRegions] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = trpc.competitors.create.useMutation({
    onSuccess: () => {
      toast.success(`${name} added as competitor`);
      setOpen(false);
      setName("");
      setWebsite("");
      setThreatLevel("medium");
      setProducts("");
      setRegions("");
      setDescription("");
      onSuccess();
    },
    onError: () => toast.error("Failed to add competitor"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Competitor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Add Competitor
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Company Name *</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Acme Corp"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Threat Level</Label>
              <Select value={threatLevel} onValueChange={setThreatLevel}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(THREAT_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Website</Label>
            <Input
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://competitor.com"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Products / Services</Label>
            <Textarea
              value={products}
              onChange={e => setProducts(e.target.value)}
              placeholder="What do they offer?"
              className="text-sm min-h-[60px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Regions / Markets</Label>
            <Input
              value={regions}
              onChange={e => setRegions(e.target.value)}
              placeholder="e.g. Europe, North America"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief overview"
              className="text-sm min-h-[60px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name: name.trim(),
                  website: website || undefined,
                  threatLevel: threatLevel as any,
                  products: products || undefined,
                  regions: regions || undefined,
                  description: description || undefined,
                })
              }
            >
              {createMutation.isPending ? "Adding..." : "Add Competitor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CompetitorsPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [threatLevel, setThreatLevel] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading, refetch } = trpc.competitors.list.useQuery({
    search: debouncedSearch || undefined,
    threatLevel: threatLevel !== "all" ? threatLevel : undefined,
    limit: 100,
  });

  const { data: stats } = trpc.competitors.stats.useQuery();

  const items = data?.competitors ?? [];
  const total = data?.total ?? 0;

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout((window as any)._competitorSearchTimer);
    (window as any)._competitorSearchTimer = setTimeout(
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
              <Swords className="h-6 w-6 text-primary" />
              Competitors
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track competitor products, pricing, and which leads use their
              services
            </p>
          </div>
          <AddCompetitorDialog onSuccess={refetch} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(THREAT_CONFIG).map(([level, cfg]) => {
            const count = Number(
              stats?.threatCounts?.find((t: any) => t.threatLevel === level)
                ?.count ?? 0
            );
            return (
              <Card key={level} className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className={`text-xs font-medium ${cfg.color}`}>
                    {cfg.label} Threat
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {stats?.upcomingContractEnds ? (
            <Card className="border shadow-sm border-amber-200">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-amber-700">
                  {stats.upcomingContractEnds}
                </div>
                <div className="text-xs font-medium text-amber-600">
                  Contracts Ending (90d)
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search competitors..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={threatLevel} onValueChange={setThreatLevel}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {Object.entries(THREAT_CONFIG).map(([val, cfg]) => (
                <SelectItem key={val} value={val}>
                  {cfg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <Swords className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No competitors yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add competitors to track their products, pricing, and market
                  presence
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold">
                      Name
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Threat
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Products
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Regions
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Website
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Updated
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(c => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/competitors/${c.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">{c.name}</div>
                      </TableCell>
                      <TableCell>
                        <ThreatBadge level={c.threatLevel} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
                          {c.products ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {c.regions ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {c.website ? (
                          <a
                            href={
                              c.website.startsWith("http")
                                ? c.website
                                : `https://${c.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Globe className="h-3 w-3" />
                            {c.website
                              .replace(/^https?:\/\//, "")
                              .replace(/\/$/, "")}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(c.updatedAt)}
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
            Showing {items.length} of {total} competitors
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
