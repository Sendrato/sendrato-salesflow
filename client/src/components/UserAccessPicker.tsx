import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, ChevronDown } from "lucide-react";
import { getInitials } from "@/lib/crm";

interface UserAccessPickerProps {
  accessType: "all" | "restricted";
  selectedUserIds: number[];
  onAccessTypeChange: (type: "all" | "restricted") => void;
  onSelectedUsersChange: (ids: number[]) => void;
  compact?: boolean;
}

export function UserAccessPicker({
  accessType,
  selectedUserIds,
  onAccessTypeChange,
  onSelectedUsersChange,
  compact = false,
}: UserAccessPickerProps) {
  const { data: userList } = trpc.auth.listUsers.useQuery();
  const users = userList ?? [];
  const [open, setOpen] = useState(false);

  const toggleUser = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      onSelectedUsersChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onSelectedUsersChange([...selectedUserIds, userId]);
    }
  };

  const selectedUsers = users.filter((u) => selectedUserIds.includes(u.id));

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
      <div className="space-y-1">
        {!compact && (
          <label className="text-xs text-muted-foreground">Access</label>
        )}
        <Select
          value={accessType}
          onValueChange={(v) => onAccessTypeChange(v as "all" | "restricted")}
        >
          <SelectTrigger
            className={compact ? "w-[140px] h-8 text-xs" : "w-[160px] h-9 text-sm"}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="restricted">Specific users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {accessType === "restricted" && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 ${compact ? "h-8 text-xs" : "h-9 text-sm"}`}
            >
              <Users className="h-3.5 w-3.5" />
              {selectedUserIds.length === 0
                ? "Select users"
                : `${selectedUserIds.length} user${selectedUserIds.length !== 1 ? "s" : ""}`}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="max-h-[240px] overflow-y-auto p-2 space-y-0.5">
              {users.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2 text-center">
                  No users found
                </p>
              ) : (
                users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(u.id)}
                      onCheckedChange={() => toggleUser(u.id)}
                    />
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                        {getInitials(u.name || u.email || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">
                      {u.name || u.email}
                    </span>
                  </label>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {accessType === "restricted" && selectedUsers.length > 0 && !compact && (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs text-primary"
            >
              {u.name || u.email}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
