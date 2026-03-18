import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { ALL_STATUSES, ALL_PRIORITIES, STATUS_LABELS } from "@/lib/crm";
import { CountryCombobox } from "@/components/CountryCombobox";

type FormData = {
  companyName: string;
  website: string;
  industry: string;
  location: string;
  country: string;
  contactPerson: string;
  contactTitle: string;
  email: string;
  phone: string;
  status: string;
  priority: string;
  source: string;
  estimatedValue: string;
  notes: string;
  painPoints: string;
  futureOpportunities: string;
  revenueModel: string;
  risks: string;
  nextFollowUpAt: string;
  assignedTo: string;
};

const EMPTY_FORM: FormData = {
  companyName: "", website: "", industry: "", location: "", country: "",
  contactPerson: "", contactTitle: "", email: "", phone: "",
  status: "new", priority: "medium", source: "manual",
  estimatedValue: "", notes: "", painPoints: "", futureOpportunities: "",
  revenueModel: "", risks: "", nextFollowUpAt: "", assignedTo: "",
};

export default function LeadForm() {
  const params = useParams<{ id: string }>();
  const isEdit = !!params.id && params.id !== "new";
  const leadId = isEdit ? parseInt(params.id) : undefined;
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const { data: existing } = trpc.leads.get.useQuery({ id: leadId! }, { enabled: isEdit });
  const { data: userList } = trpc.auth.listUsers.useQuery();
  const users = userList ?? [];

  useEffect(() => {
    if (existing) {
      setForm({
        companyName: existing.companyName ?? "",
        website: existing.website ?? "",
        industry: existing.industry ?? "",
        location: existing.location ?? "",
        country: existing.country ?? "",
        contactPerson: existing.contactPerson ?? "",
        contactTitle: existing.contactTitle ?? "",
        email: existing.email ?? "",
        phone: existing.phone ?? "",
        status: existing.status ?? "new",
        priority: existing.priority ?? "medium",
        source: existing.source ?? "manual",
        estimatedValue: existing.estimatedValue ? String(existing.estimatedValue) : "",
        notes: existing.notes ?? "",
        painPoints: existing.painPoints ?? "",
        futureOpportunities: existing.futureOpportunities ?? "",
        revenueModel: existing.revenueModel ?? "",
        risks: existing.risks ?? "",
        nextFollowUpAt: existing.nextFollowUpAt ? new Date(existing.nextFollowUpAt).toISOString().slice(0, 10) : "",
        assignedTo: existing.assignedTo ? String(existing.assignedTo) : "",
      });
    }
  }, [existing]);

  const utils = trpc.useUtils();

  const createMutation = trpc.leads.create.useMutation({
    onSuccess: (lead) => {
      utils.leads.list.invalidate();
      toast.success("Lead created!");
      setLocation(`/leads/${lead?.id}`);
    },
    onError: () => toast.error("Failed to create lead"),
  });

  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.get.invalidate({ id: leadId });
      toast.success("Lead updated!");
      setLocation(`/leads/${leadId}`);
    },
    onError: () => toast.error("Failed to update lead"),
  });

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = () => {
    if (!form.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    const payload = {
      companyName: form.companyName,
      website: form.website || undefined,
      industry: form.industry || undefined,
      location: form.location || undefined,
      country: form.country || undefined,
      contactPerson: form.contactPerson || undefined,
      contactTitle: form.contactTitle || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      status: form.status as any,
      priority: form.priority as any,
      source: form.source || undefined,
      estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined,
      notes: form.notes || undefined,
      painPoints: form.painPoints || undefined,
      futureOpportunities: form.futureOpportunities || undefined,
      revenueModel: form.revenueModel || undefined,
      risks: form.risks || undefined,
      nextFollowUpAt: form.nextFollowUpAt || undefined,
      assignedTo: form.assignedTo ? parseInt(form.assignedTo) : undefined,
    };

    if (isEdit && leadId) {
      updateMutation.mutate({ id: leadId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLocation(isEdit ? `/leads/${leadId}` : "/leads")} className="gap-1 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            {isEdit ? "Back to Lead" : "Leads"}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{isEdit ? "Edit Lead" : "New Lead"}</h1>
          <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? "Save Changes" : "Create Lead"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Company Info */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Company Name *</Label>
                <Input value={form.companyName} onChange={set("companyName")} placeholder="Acme Corporation" />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={form.website} onChange={set("website")} placeholder="acme.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input value={form.industry} onChange={set("industry")} placeholder="Event Management" />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={set("location")} placeholder="Phoenix, AZ" />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <CountryCombobox value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact Person</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={form.contactPerson} onChange={set("contactPerson")} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.contactTitle} onChange={set("contactTitle")} placeholder="Executive Director" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={set("email")} placeholder="jane@acme.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" />
              </div>
            </CardContent>
          </Card>

          {/* CRM Settings */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">CRM Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Input value={form.source} onChange={set("source")} placeholder="manual, referral, event..." />
              </div>
              <div className="space-y-1.5">
                <Label>Estimated Value (USD)</Label>
                <Input type="number" value={form.estimatedValue} onChange={set("estimatedValue")} placeholder="50000" />
              </div>
              <div className="space-y-1.5">
                <Label>Next Follow-up</Label>
                <Input type="date" value={form.nextFollowUpAt} onChange={set("nextFollowUpAt")} />
              </div>
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Select value={form.assignedTo || "none"} onValueChange={(v) => setForm((f) => ({ ...f, assignedTo: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Intel */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes & Intel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={set("notes")} placeholder="General notes..." rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Pain Points</Label>
                <Textarea value={form.painPoints} onChange={set("painPoints")} placeholder="What challenges do they face?" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Opportunities</Label>
                <Textarea value={form.futureOpportunities} onChange={set("futureOpportunities")} placeholder="What could we offer?" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Revenue Model</Label>
                <Textarea value={form.revenueModel} onChange={set("revenueModel")} placeholder="How would we monetize?" rows={2} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
