import DashboardLayout from "@/components/DashboardLayout";
import RichNotes from "@/components/RichNotes";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Search, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  CONTACT_TYPE_ICONS, OUTCOME_COLORS, ALL_CONTACT_TYPES, formatDate, formatRelativeTime
} from "@/lib/crm";

export default function Activity() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading } = trpc.contactMoments.listAll.useQuery({
    search: search || undefined,
    type: typeFilter === "all" ? undefined : typeFilter,
    limit: 50,
  });

  const moments = data ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Activity Feed</h1>
          <p className="text-sm text-muted-foreground">All contact interactions across leads</p>
        </div>

        {/* Filters */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company or notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ALL_CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {moments.length} interactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : moments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity found</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-3 pl-10">
                  {moments.map((item) => (
                    <div key={item.moment.id} className="relative">
                      <div className="absolute -left-6 top-2 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                        <span className="text-[8px]">
                          {CONTACT_TYPE_ICONS[item.moment.type as keyof typeof CONTACT_TYPE_ICONS] ?? "📌"}
                        </span>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 border hover:border-primary/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                className="text-sm font-semibold hover:underline"
                                onClick={() => setLocation(item.lead?.companyName ? `/leads/${item.lead?.id}` : `/persons/${item.person?.id}`)}
                              >
                                {item.lead?.companyName || item.person?.name || "Unknown"}
                              </button>
                              <Badge variant="outline" className="text-xs capitalize">{item.moment.type}</Badge>
                              {item.moment.outcome && (
                                <span className={`text-xs capitalize ${OUTCOME_COLORS[item.moment.outcome as keyof typeof OUTCOME_COLORS] ?? ""}`}>
                                  {item.moment.outcome.replace("_", " ")}
                                </span>
                              )}
                              {item.moment.direction && (
                                <span className="text-xs text-muted-foreground capitalize">{item.moment.direction}</span>
                              )}
                            </div>
                            {item.moment.subject && (
                              <div className="text-sm font-medium mt-0.5">{item.moment.subject}</div>
                            )}
                            {item.moment.notes && (
                              <RichNotes notes={item.moment.notes} className="text-sm text-muted-foreground mt-1" lineClamp={2} />
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{formatRelativeTime(item.moment.occurredAt)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setLocation(item.lead?.companyName ? `/leads/${item.lead?.id}` : `/persons/${item.person?.id}`)}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
