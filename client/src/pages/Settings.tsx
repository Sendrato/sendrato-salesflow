import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Key,
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Info,
  Zap,
  Globe,
  UserPlus,
  Users,
  Lock,
  Copy,
  Mail,
  RotateCcw,
  MailWarning,
  Search,
  Link2,
  X,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/crm";

const PROVIDERS = [
  {
    value: "forge",
    label: "Forge (Default)",
    description: "Built-in AI gateway — uses BUILT_IN_FORGE_API_URL from server env",
    models: ["gemini-2.5-flash", "claude-sonnet-4-5", "gpt-4o", "gpt-4o-mini"],
    requiresKey: false,
  },
  {
    value: "openai",
    label: "OpenAI",
    description: "GPT-4o, GPT-4o-mini, and other OpenAI models",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    requiresKey: true,
    keyHint: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    description: "Claude Sonnet, Haiku, and Opus models",
    models: ["claude-sonnet-4-5", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    requiresKey: true,
    keyHint: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    value: "google",
    label: "Google Gemini",
    description: "Gemini 2.5 Flash, Pro, and other Google models",
    models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
    requiresKey: true,
    keyHint: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    value: "custom",
    label: "Custom / Self-hosted",
    description: "Any OpenAI-compatible endpoint (Ollama, Groq, Together, etc.)",
    models: [],
    requiresKey: false,
    needsBaseUrl: true,
  },
];

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const changePasswordMutation = trpc.auth.changePassword.useMutation();

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <CardTitle>Change Password</CardTitle>
        </div>
        <CardDescription>Update your account password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 characters"
            />
          </div>
          <Button type="submit" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UserManagementCard() {
  const { user } = useAuth();
  const { data: userList, isLoading } = trpc.auth.listUsers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const utils = trpc.useUtils();
  const reinviteMutation = trpc.auth.reinviteUser.useMutation({
    onSuccess: () => {
      utils.auth.listUsers.invalidate();
    },
  });
  const [reinviteResult, setReinviteResult] = useState<{ email: string | null; tempPassword: string } | null>(null);

  if (user?.role !== "admin") return null;

  async function handleReinvite(userId: number) {
    setReinviteResult(null);
    try {
      const result = await reinviteMutation.mutateAsync({ userId });
      setReinviteResult(result);
      toast.success("New temporary password generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to re-invite user");
    }
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Users</CardTitle>
        </div>
        <CardDescription>Overview of all users in the system.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(userList ?? []).map((u) => {
                const isActive = u.lastSignedIn && new Date(u.lastSignedIn) > thirtyDaysAgo;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "outline"} className="text-xs capitalize">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${isActive ? "border-green-300 text-green-700 dark:text-green-400" : "border-gray-300 text-gray-500"}`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(u.lastSignedIn)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleReinvite(u.id)}
                        disabled={reinviteMutation.isPending}
                      >
                        {reinviteMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Re-invite
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {reinviteResult && (
          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p>New temporary password for <strong>{reinviteResult.email}</strong>:</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                  {reinviteResult.tempPassword}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    navigator.clipboard.writeText(reinviteResult.tempPassword);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this password with the user. They should change it after login.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function InviteUserCard() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const inviteMutation = trpc.auth.inviteUser.useMutation();

  if (user?.role !== "admin") return null;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setTempPassword(null);
    try {
      const result = await inviteMutation.mutateAsync({ email, name: name || undefined });
      setTempPassword(result.tempPassword);
      setEmail("");
      setName("");
      toast.success("User invited successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite user");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <CardTitle>Invite User</CardTitle>
        </div>
        <CardDescription>Create a new user account. Share the temporary password with them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleInvite} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="inviteEmail">Email</Label>
            <Input
              id="inviteEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteName">Name (optional)</Label>
            <Input
              id="inviteName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <Button type="submit" disabled={inviteMutation.isPending}>
            {inviteMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Invite User
          </Button>
        </form>

        {tempPassword && (
          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p>User created. Share this temporary password:</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                  {tempPassword}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The user should change this password after first login.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ImapSettingsCard() {
  const { data: imapConfig, isLoading, refetch } = trpc.settings.getImapConfig.useQuery();
  const updateMutation = trpc.settings.updateImapConfig.useMutation();
  const testMutation = trpc.settings.testImapConnection.useMutation();
  const syncMutation = trpc.settings.syncImapNow.useMutation();

  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("993");
  const [secure, setSecure] = useState(true);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [pollInterval, setPollInterval] = useState("5");
  const [folder, setFolder] = useState("INBOX");
  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    folders?: string[];
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const [imapInitialised, setImapInitialised] = useState(false);
  if (imapConfig && !imapInitialised) {
    setEnabled(imapConfig.enabled);
    setHost(imapConfig.host);
    setPort(String(imapConfig.port));
    setSecure(imapConfig.secure);
    setUser(imapConfig.user);
    setPollInterval(String(imapConfig.pollInterval));
    setFolder(imapConfig.folder);
    setImapInitialised(true);
  }

  function markImapChanged() {
    setHasChanges(true);
    setTestResult(null);
  }

  async function handleSaveImap() {
    try {
      await updateMutation.mutateAsync({
        enabled,
        host,
        port: parseInt(port) || 993,
        secure,
        user,
        ...(password.length > 0 ? { password } : {}),
        pollInterval: parseInt(pollInterval) || 5,
        folder,
      });
      setPassword("");
      setHasChanges(false);
      await refetch();
      toast.success("IMAP settings saved — polling restarted");
    } catch (err) {
      toast.error("Failed to save IMAP settings");
    }
  }

  async function handleTestImap() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync({
        host,
        port: parseInt(port) || 993,
        secure,
        user,
        ...(password.length > 0 ? { password } : {}),
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Connection failed",
      });
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Email Integration (IMAP)</CardTitle>
        </div>
        <CardDescription>
          Connect to a mailbox to automatically ingest emails and match them with
          leads and contacts. Supports direct emails and forwarded messages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
          <div>
            <p className="text-sm font-medium">Enable IMAP Polling</p>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? `Polling every ${pollInterval} min for ${user || "..."}`
                : "Polling is disabled"}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              markImapChanged();
            }}
          />
        </div>

        <Separator />

        {/* Server settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="imapHost">IMAP Server</Label>
            <Input
              id="imapHost"
              value={host}
              onChange={(e) => {
                setHost(e.target.value);
                markImapChanged();
              }}
              placeholder="imap.example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imapPort">Port</Label>
            <Input
              id="imapPort"
              type="number"
              value={port}
              onChange={(e) => {
                setPort(e.target.value);
                markImapChanged();
              }}
              placeholder="993"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="imapSecure"
            checked={secure}
            onCheckedChange={(v) => {
              setSecure(v);
              markImapChanged();
            }}
          />
          <Label htmlFor="imapSecure">Use TLS/SSL</Label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="imapUser">Email Address</Label>
            <Input
              id="imapUser"
              value={user}
              onChange={(e) => {
                setUser(e.target.value);
                markImapChanged();
              }}
              placeholder="crm@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imapPassword">Password</Label>
            <div className="relative">
              <Input
                id="imapPassword"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  markImapChanged();
                }}
                placeholder={
                  imapConfig?.hasPassword
                    ? "••••••••• (set — enter to replace)"
                    : "Enter password"
                }
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="imapFolder">Folders</Label>
            <Input
              id="imapFolder"
              value={folder}
              onChange={(e) => {
                setFolder(e.target.value);
                markImapChanged();
              }}
              placeholder="INBOX"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated for multiple folders, e.g. <code className="bg-muted px-1 rounded">INBOX, Sent</code>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="imapInterval">Poll Interval (minutes)</Label>
            <Input
              id="imapInterval"
              type="number"
              min="1"
              value={pollInterval}
              onChange={(e) => {
                setPollInterval(e.target.value);
                markImapChanged();
              }}
              placeholder="5"
            />
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {testResult.success
                ? `Connected successfully! Available folders: ${testResult.folders?.join(", ")}`
                : `Connection failed: ${testResult.error}`}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            onClick={handleSaveImap}
            disabled={updateMutation.isPending || !hasChanges}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save Settings
          </Button>
          <Button
            variant="outline"
            onClick={handleTestImap}
            disabled={isTesting || !host || !user}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const result = await syncMutation.mutateAsync();
                if (result.success) {
                  toast.success(
                    result.processed
                      ? `Synced ${result.processed} new email${result.processed === 1 ? "" : "s"}`
                      : "Sync complete — no new emails"
                  );
                } else {
                  toast.error(`Sync failed: ${result.error}`);
                }
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Sync failed");
              }
            }}
            disabled={syncMutation.isPending || !imapConfig?.hasPassword}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Sync Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UnmatchedEmailsCard() {
  const { user } = useAuth();
  const { data, isLoading } = trpc.analytics.unmatchedEmails.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const utils = trpc.useUtils();

  const matchMutation = trpc.analytics.matchEmail.useMutation({
    onSuccess: () => {
      utils.analytics.unmatchedEmails.invalidate();
      toast.success("Email matched successfully");
      setMatchDialogOpen(false);
      setMatchingEmail(null);
    },
  });

  const dismissMutation = trpc.analytics.dismissEmail.useMutation({
    onSuccess: () => {
      utils.analytics.unmatchedEmails.invalidate();
      toast.success("Email dismissed");
    },
  });

  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchingEmail, setMatchingEmail] = useState<{
    id: number;
    parsedFrom: string | null;
    parsedSubject: string | null;
  } | null>(null);
  const [matchTab, setMatchTab] = useState<"lead" | "person">("lead");
  const [matchSearch, setMatchSearch] = useState("");

  const { data: leadResults } = trpc.leads.list.useQuery(
    { search: matchSearch, limit: 10 },
    { enabled: matchDialogOpen && matchTab === "lead" && matchSearch.length > 1 }
  );
  const { data: personResults } = trpc.persons.list.useQuery(
    { search: matchSearch, limit: 10 },
    { enabled: matchDialogOpen && matchTab === "person" && matchSearch.length > 1 }
  );

  if (user?.role !== "admin") return null;
  if (!data || data.count === 0) return null;

  function openMatchDialog(email: typeof matchingEmail) {
    setMatchingEmail(email);
    setMatchSearch("");
    setMatchTab("lead");
    setMatchDialogOpen(true);
  }

  return (
    <>
      <Card className="border border-orange-200 dark:border-orange-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MailWarning className="h-5 w-5 text-orange-500" />
            <CardTitle>Unmatched Emails ({data.count})</CardTitle>
          </div>
          <CardDescription>
            Incoming emails that could not be matched to a Lead or Person. Match them manually or dismiss.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">
                    {email.parsedFrom || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                    {email.parsedSubject || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {email.source || "webhook"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeTime(email.createdAt)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() =>
                        openMatchDialog({
                          id: email.id,
                          parsedFrom: email.parsedFrom,
                          parsedSubject: email.parsedSubject,
                        })
                      }
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Match
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-muted-foreground"
                      onClick={() => dismissMutation.mutate({ ingestId: email.id })}
                      disabled={dismissMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                      Dismiss
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Match Email</DialogTitle>
          </DialogHeader>
          {matchingEmail && (
            <div className="space-y-1 text-sm text-muted-foreground border-b pb-3">
              <p>
                <span className="font-medium text-foreground">From:</span>{" "}
                {matchingEmail.parsedFrom || "Unknown"}
              </p>
              <p>
                <span className="font-medium text-foreground">Subject:</span>{" "}
                {matchingEmail.parsedSubject || "No subject"}
              </p>
            </div>
          )}
          <Tabs value={matchTab} onValueChange={(v) => { setMatchTab(v as "lead" | "person"); setMatchSearch(""); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="lead">Match to Lead</TabsTrigger>
              <TabsTrigger value="person">Match to Person</TabsTrigger>
            </TabsList>
            <TabsContent value="lead" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-60 overflow-y-auto divide-y rounded-md border">
                {(leadResults?.items ?? []).length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {matchSearch.length > 1 ? "No leads found" : "Type to search leads"}
                  </div>
                ) : (
                  (leadResults?.items ?? []).map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 cursor-pointer"
                      onClick={() =>
                        matchMutation.mutate({
                          ingestId: matchingEmail!.id,
                          leadId: lead.id,
                        })
                      }
                    >
                      <div>
                        <div className="text-sm font-medium">{lead.companyName}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.email || lead.contactPerson || "—"}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {lead.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="person" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search persons..."
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-60 overflow-y-auto divide-y rounded-md border">
                {(personResults?.persons ?? []).length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {matchSearch.length > 1 ? "No persons found" : "Type to search persons"}
                  </div>
                ) : (
                  (personResults?.persons ?? []).map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 cursor-pointer"
                      onClick={() =>
                        matchMutation.mutate({
                          ingestId: matchingEmail!.id,
                          personId: person.id,
                        })
                      }
                    >
                      <div>
                        <div className="text-sm font-medium">{person.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {person.email || person.company || "—"}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {person.personType}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
          {matchMutation.isPending && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Matching...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SettingsPage() {
  const { data: config, isLoading, refetch } = trpc.settings.getLLMConfig.useQuery();
  const updateMutation = trpc.settings.updateLLMConfig.useMutation();
  const clearKeyMutation = trpc.settings.clearApiKey.useMutation();
  const testMutation = trpc.settings.testConnection.useMutation();

  const [provider, setProvider] = useState<string>("");
  const [chatModel, setChatModel] = useState<string>("");
  const [enrichModel, setEnrichModel] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [embeddingApiKey, setEmbeddingApiKey] = useState<string>("");
  const [showKey, setShowKey] = useState(false);
  const [showEmbeddingKey, setShowEmbeddingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    response?: string;
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialise form from loaded config
  const [initialised, setInitialised] = useState(false);
  if (config && !initialised) {
    setProvider(config.provider);
    setChatModel(config.chatModel);
    setEnrichModel(config.enrichModel);
    setBaseUrl(config.baseUrl);
    setInitialised(true);
  }

  const selectedProvider = PROVIDERS.find((p) => p.value === (provider || config?.provider || "forge"));

  function markChanged() {
    setHasUnsavedChanges(true);
    setTestResult(null);
  }

  async function handleSave() {
    try {
      await updateMutation.mutateAsync({
        provider,
        chatModel,
        enrichModel,
        ...(apiKey.length > 0 ? { apiKey } : {}),
        baseUrl,
        ...(embeddingApiKey.length > 0 ? { embeddingApiKey } : {}),
      });
      setApiKey("");
      setEmbeddingApiKey("");
      setHasUnsavedChanges(false);
      await refetch();
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error("Failed to save settings");
    }
  }

  async function handleClearKey() {
    try {
      await clearKeyMutation.mutateAsync();
      await refetch();
      toast.success("API key cleared — will use built-in Forge fallback");
    } catch {
      toast.error("Failed to clear API key");
    }
  }

  async function handleTestConnection() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync({
        provider: provider || config?.provider || "forge",
        model: chatModel || config?.chatModel || "gemini-2.5-flash",
        ...(apiKey.length > 0 ? { apiKey } : {}),
        ...(baseUrl.length > 0 ? { baseUrl } : {}),
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "Connection failed" });
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground text-sm">Configure AI providers and application preferences</p>
          </div>
        </div>

        {/* LLM Provider Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle>AI Provider Configuration</CardTitle>
            </div>
            <CardDescription>
              Choose which LLM provider powers the AI chat, lead enrichment, and LinkedIn import features.
              Choose which LLM provider powers the AI chat, lead enrichment, and LinkedIn import features.
              Configure your own API key here, or use the built-in Forge API if configured on the server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current status */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className="flex-shrink-0">
                {config?.hasApiKey ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Zap className="h-5 w-5 text-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {config?.hasApiKey
                    ? `Using custom ${config.provider} API key`
                    : "Using built-in Forge API (default)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {config?.hasApiKey
                    ? `Chat model: ${config.chatModel} · Enrichment model: ${config.enrichModel}`
                    : "Automatically uses the configured Forge API models"}
                </p>
              </div>
              {config?.hasApiKey && (
                <Badge variant="secondary" className="flex-shrink-0">Custom Key</Badge>
              )}
            </div>

            <Separator />

            {/* Provider selector */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={provider || config?.provider || "forge"}
                onValueChange={(v) => {
                  setProvider(v);
                  const p = PROVIDERS.find((x) => x.value === v);
                  if (p?.models.length) {
                    setChatModel(p.models[0]);
                    setEnrichModel(p.models[0]);
                  }
                  markChanged();
                }}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProvider && (
                <p className="text-xs text-muted-foreground">{selectedProvider.description}</p>
              )}
            </div>

            {/* Model selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chatModel">Chat Model</Label>
                {selectedProvider?.models.length ? (
                  <Select
                    value={chatModel || config?.chatModel}
                    onValueChange={(v) => { setChatModel(v); markChanged(); }}
                  >
                    <SelectTrigger id="chatModel">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider.models.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="chatModel"
                    value={chatModel || config?.chatModel || ""}
                    onChange={(e) => { setChatModel(e.target.value); markChanged(); }}
                    placeholder="e.g. llama3.2, mixtral-8x7b"
                  />
                )}
                <p className="text-xs text-muted-foreground">Used for AI chat conversations</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enrichModel">Enrichment Model</Label>
                {selectedProvider?.models.length ? (
                  <Select
                    value={enrichModel || config?.enrichModel}
                    onValueChange={(v) => { setEnrichModel(v); markChanged(); }}
                  >
                    <SelectTrigger id="enrichModel">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider.models.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="enrichModel"
                    value={enrichModel || config?.enrichModel || ""}
                    onChange={(e) => { setEnrichModel(e.target.value); markChanged(); }}
                    placeholder="e.g. llama3.2, mixtral-8x7b"
                  />
                )}
                <p className="text-xs text-muted-foreground">Used for lead enrichment & LinkedIn import</p>
              </div>
            </div>

            {/* API Key input */}
            {selectedProvider?.value !== "forge" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="apiKey" className="flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5" />
                    API Key
                  </Label>
                  {config?.hasApiKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive hover:text-destructive"
                      onClick={handleClearKey}
                      disabled={clearKeyMutation.isPending}
                    >
                      {clearKeyMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      Clear key
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); markChanged(); }}
                    placeholder={
                      config?.hasApiKey
                        ? "••••••••••••••••••••••• (key set — enter new key to replace)"
                        : selectedProvider?.keyHint ?? "Enter your API key"
                    }
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {selectedProvider?.docsUrl && (
                  <p className="text-xs text-muted-foreground">
                    Get your API key at{" "}
                    <a
                      href={selectedProvider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {selectedProvider.docsUrl}
                    </a>
                  </p>
                )}
              </div>
            )}

            {/* Base URL (for custom providers) */}
            {(selectedProvider?.value === "custom" || selectedProvider?.needsBaseUrl) && (
              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Base URL
                </Label>
                <Input
                  id="baseUrl"
                  value={baseUrl || config?.baseUrl || ""}
                  onChange={(e) => { setBaseUrl(e.target.value); markChanged(); }}
                  placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Must be an OpenAI-compatible endpoint. For Ollama: <code className="bg-muted px-1 rounded">http://localhost:11434/v1</code>
                </p>
              </div>
            )}

            {/* Embedding API Key (Mistral) */}
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="embeddingApiKey" className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
                Embedding API Key (Mistral)
              </Label>
              <div className="relative">
                <Input
                  id="embeddingApiKey"
                  type={showEmbeddingKey ? "text" : "password"}
                  value={embeddingApiKey}
                  onChange={(e) => { setEmbeddingApiKey(e.target.value); markChanged(); }}
                  placeholder={
                    config?.hasEmbeddingKey
                      ? "••••••••••••••••••••••• (key set — enter new key to replace)"
                      : "Enter your Mistral API key"
                  }
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowEmbeddingKey(!showEmbeddingKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showEmbeddingKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Used for document and lead embeddings (semantic search). Get a key at{" "}
                <a
                  href="https://console.mistral.ai/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  console.mistral.ai
                </a>
              </p>
            </div>

            {/* Test connection result */}
            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {testResult.success
                    ? `Connection successful! Model responded: "${testResult.response}"`
                    : `Connection failed: ${testResult.error}`}
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending || !hasUnsavedChanges}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Settings
              </Button>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* IMAP Email Integration */}
        <ImapSettingsCard />

        {/* Unmatched Emails (admin only) */}
        <UnmatchedEmailsCard />

        {/* Change Password */}
        <ChangePasswordCard />

        {/* User Management (admin only) */}
        <UserManagementCard />

        {/* Invite User (admin only) */}
        <InviteUserCard />

        {/* Self-hosting guide */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">Self-Hosting Guide</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              SalesFlow CRM is designed to be self-hosted on any Node.js-compatible platform.
              Configure your preferred LLM provider above for AI-powered features.
            </p>
            <div className="space-y-3">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-medium">1. Database</p>
                <p className="text-muted-foreground text-xs">
                  Set <code className="bg-muted px-1 rounded">DATABASE_URL</code> to a MySQL or TiDB connection string.
                  Run <code className="bg-muted px-1 rounded">pnpm db:push</code> to apply the schema.
                </p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-medium">2. LLM API Key</p>
                <p className="text-muted-foreground text-xs">
                  Configure your preferred provider above (OpenAI, Anthropic, Google, or any OpenAI-compatible endpoint).
                  The key is stored obfuscated in the database and used for all AI features.
                </p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-medium">3. File Storage</p>
                <p className="text-muted-foreground text-xs">
                  Set <code className="bg-muted px-1 rounded">S3_BUCKET</code>, <code className="bg-muted px-1 rounded">S3_ACCESS_KEY</code>,
                  and <code className="bg-muted px-1 rounded">S3_SECRET_KEY</code> for document storage.
                  Compatible with AWS S3, DigitalOcean Spaces, or MinIO.
                </p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-medium">4. Start the server</p>
                <p className="text-muted-foreground text-xs">
                  Run <code className="bg-muted px-1 rounded">pnpm build && pnpm start</code>.
                  The app listens on <code className="bg-muted px-1 rounded">PORT</code> (default: 3000).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
