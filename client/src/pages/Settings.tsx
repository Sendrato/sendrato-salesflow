import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
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
} from "lucide-react";

const PROVIDERS = [
  {
    value: "forge",
    label: "Manus Forge (Default)",
    description: "Built-in Manus AI gateway — no key needed on Manus hosting",
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
  const [showKey, setShowKey] = useState(false);
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
      });
      setApiKey("");
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
      toast.success("API key cleared — will use Manus Forge fallback");
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
              By default, SalesFlow uses the built-in Manus Forge API — no key needed on Manus hosting.
              For self-hosting on DigitalOcean or other platforms, configure your own API key here.
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
                    : "Using Manus Forge API (default)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {config?.hasApiKey
                    ? `Chat model: ${config.chatModel} · Enrichment model: ${config.enrichModel}`
                    : "Automatically uses the best available models via Manus Forge"}
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
              When running outside Manus, configure your own LLM API key above.
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
