/**
 * LeadAttributeEditor
 *
 * Renders a dynamic form section for lead-type-specific attributes.
 * The fields shown depend entirely on the selected leadType — no hardcoding needed.
 * Supports view mode (read-only display) and edit mode (interactive inputs).
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  Calendar,
  CalendarDays,
  MapPin,
  Hotel,
  TrendingUp,
  TrendingDown,
  Building2,
  Building,
  Tag,
  Ticket,
  Music,
  Award,
  Mic,
  Star,
  Server,
  BarChart,
  DollarSign,
  Code,
  Plug,
  Store,
  ShoppingCart,
  CreditCard,
  Info,
  Pencil,
  Check,
  X,
  BedDouble,
  Tent,
} from "lucide-react";
import {
  LEAD_TYPE_SCHEMAS,
  getLeadTypeSchema,
  getLeadTypeOptions,
  type AttributeField,
} from "../../../shared/leadAttributeSchemas";

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users, Calendar, CalendarDays, MapPin, Hotel, TrendingUp, TrendingDown,
  Building2, Building, Tag, Ticket, Music, Award, Mic, Star, Server,
  BarChart, DollarSign, Code, Plug, Store, ShoppingCart, CreditCard,
  BedDouble, Tent,
};

interface LeadAttributeEditorProps {
  leadType: string;
  attributes: Record<string, unknown>;
  onLeadTypeChange?: (newType: string) => void;
  onAttributesChange?: (newAttributes: Record<string, unknown>) => void;
  readOnly?: boolean;
  compact?: boolean; // for list view
}

function FieldIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className ?? "h-4 w-4 text-muted-foreground"} />;
}

function AttributeValue({
  field,
  value,
}: {
  field: AttributeField;
  value: unknown;
}) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground text-sm italic">—</span>;
  }

  const displayValue = String(value);

  // Format large numbers
  if (field.type === "number" && field.unit === "visitors") {
    const num = Number(value);
    if (!isNaN(num)) {
      return (
        <span className="font-semibold text-sm">
          {num >= 1_000_000
            ? `${(num / 1_000_000).toFixed(1)}M`
            : num >= 1_000
            ? `${(num / 1_000).toFixed(0)}K`
            : num.toLocaleString()}{" "}
          <span className="text-muted-foreground font-normal">{field.unit}</span>
        </span>
      );
    }
  }

  if (field.type === "number" && field.unit) {
    return (
      <span className="font-semibold text-sm">
        {Number(value).toLocaleString()}{" "}
        <span className="text-muted-foreground font-normal">{field.unit}</span>
      </span>
    );
  }

  // Score badges
  if (field.key === "hotelNeedScore" || field.key === "revenueEngineFit") {
    const colorMap: Record<string, string> = {
      HIGH: "bg-red-100 text-red-800",
      "VERY HIGH": "bg-red-200 text-red-900",
      EXCELLENT: "bg-green-100 text-green-800",
      GOOD: "bg-blue-100 text-blue-800",
      MODERATE: "bg-yellow-100 text-yellow-800",
      LOW: "bg-slate-100 text-slate-600",
      POOR: "bg-slate-100 text-slate-600",
    };
    const color = colorMap[displayValue] ?? "bg-slate-100 text-slate-700";
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
        {displayValue}
      </span>
    );
  }

  return <span className="text-sm font-medium">{displayValue}</span>;
}

function AttributeInput({
  field,
  value,
  onChange,
}: {
  field: AttributeField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const strVal = value !== undefined && value !== null ? String(value) : "";

  if (field.type === "select" && field.options) {
    return (
      <Select value={strVal} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "textarea") {
    return (
      <Textarea
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="text-sm min-h-[60px]"
      />
    );
  }

  return (
    <div className="relative">
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={strVal}
        onChange={(e) =>
          onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
        }
        placeholder={field.placeholder}
        className="h-8 text-sm pr-12"
      />
      {field.unit && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {field.unit}
        </span>
      )}
    </div>
  );
}

export function LeadAttributeEditor({
  leadType,
  attributes,
  onLeadTypeChange,
  onAttributesChange,
  readOnly = false,
  compact = false,
}: LeadAttributeEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localAttrs, setLocalAttrs] = useState<Record<string, unknown>>(attributes ?? {});
  const [localType, setLocalType] = useState(leadType);

  const schema = getLeadTypeSchema(localType);
  const typeOptions = getLeadTypeOptions();

  const hasAttributes = schema.fields.length > 0;
  const populatedFields = schema.fields.filter(
    (f) => attributes?.[f.key] !== undefined && attributes?.[f.key] !== null && attributes?.[f.key] !== ""
  );

  function handleSave() {
    onLeadTypeChange?.(localType);
    onAttributesChange?.(localAttrs);
    setIsEditing(false);
  }

  function handleCancel() {
    setLocalAttrs(attributes ?? {});
    setLocalType(leadType);
    setIsEditing(false);
  }

  function handleAttrChange(key: string, val: unknown) {
    setLocalAttrs((prev) => ({ ...prev, [key]: val }));
  }

  // Compact mode: just show key stats as inline badges (for lead list/card)
  if (compact && hasAttributes && populatedFields.length > 0) {
    const keyFields = populatedFields.slice(0, 4);
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {keyFields.map((field) => (
          <div
            key={field.key}
            className="flex items-center gap-1 text-xs bg-muted rounded px-1.5 py-0.5"
          >
            <FieldIcon name={field.icon} className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{field.label}:</span>
            <AttributeValue field={field} value={attributes?.[field.key]} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">
              {schema.label} Attributes
            </CardTitle>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${schema.color}`}
            >
              {schema.label}
            </span>
          </div>
          {!readOnly && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {isEditing && (
            <div className="flex gap-1">
              <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleCancel}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          )}
        </div>
        {isEditing && (
          <CardDescription className="text-xs">
            Change lead type to show different attribute fields
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Lead type selector (edit mode only) */}
        {isEditing && (
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Lead Type</Label>
            <Select value={localType} onValueChange={setLocalType}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {opt.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!hasAttributes && !isEditing && (
          <p className="text-xs text-muted-foreground">
            No type-specific attributes for this lead type.{" "}
            {!readOnly && (
              <button
                className="underline hover:text-foreground"
                onClick={() => setIsEditing(true)}
              >
                Change lead type
              </button>
            )}
          </p>
        )}

        {hasAttributes && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(isEditing ? getLeadTypeSchema(localType).fields : schema.fields).map((field) => (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <FieldIcon name={field.icon} className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  {field.description && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-[200px]">
                        {field.description}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {isEditing ? (
                  <AttributeInput
                    field={field}
                    value={localAttrs[field.key]}
                    onChange={(val) => handleAttrChange(field.key, val)}
                  />
                ) : (
                  <AttributeValue field={field} value={attributes?.[field.key]} />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * LeadTypeBadge — small inline badge showing the lead type.
 * Use in lead list rows, cards, etc.
 */
export function LeadTypeBadge({ leadType }: { leadType: string }) {
  const schema = getLeadTypeSchema(leadType);
  if (leadType === "default") return null;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${schema.color}`}
    >
      {schema.label}
    </span>
  );
}
