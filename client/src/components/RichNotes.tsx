import React from "react";
import { MapPin, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;
const VIDEO_CALL_REGEX =
  /https?:\/\/([\w-]+\.)?(zoom\.us|teams\.microsoft\.com|meet\.google\.com)\//;

// Detect lines that look like physical addresses
const ADDRESS_REGEX =
  /\d+\s+[\w\s]+\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|square|sq|straat|weg|laan|gracht|kade|plein|singel)\b/i;
const POSTAL_CODE_REGEX = /\b\d{4,5}\s*[A-Z]{0,2}\b/;

function isAddressLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return ADDRESS_REGEX.test(trimmed) || POSTAL_CODE_REGEX.test(trimmed);
}

function linkifyLine(line: string): React.ReactNode[] {
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_REGEX.source, "g");
  let match;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push(line.slice(lastIndex, match.index));
    }
    const url = match[0];
    const isVideo = VIDEO_CALL_REGEX.test(url);
    segments.push(
      <a
        key={`url-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-0.5 break-all"
      >
        {isVideo && <Video className="h-3 w-3 inline shrink-0" />}
        {url}
      </a>,
    );
    lastIndex = match.index + url.length;
  }

  if (lastIndex < line.length) {
    segments.push(line.slice(lastIndex));
  }

  return segments.length > 0 ? segments : [line];
}

interface RichNotesProps {
  notes: string;
  className?: string;
  lineClamp?: number;
}

export default function RichNotes({ notes, className, lineClamp }: RichNotesProps) {
  const lines = notes.split("\n");

  // Collect consecutive address-like lines into groups
  const elements: React.ReactNode[] = [];

  let addressBlock: string[] = [];

  const flushAddress = () => {
    if (addressBlock.length === 0) return;
    const full = addressBlock.join(", ");
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
    elements.push(
      <span
        key={`addr-${elements.length}`}
        className="inline-flex items-start gap-1 my-0.5"
      >
        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {full}
        </a>
      </span>,
    );
    addressBlock = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // When using lineClamp, skip address block rendering to keep layout simple
    if (!lineClamp && isAddressLine(line)) {
      addressBlock.push(line.trim());
    } else {
      flushAddress();
      if (i > 0 && addressBlock.length === 0) {
        elements.push("\n");
      }
      elements.push(
        <React.Fragment key={`line-${i}`}>
          {linkifyLine(line)}
        </React.Fragment>,
      );
    }
  }
  flushAddress();

  const clampClass = lineClamp ? `line-clamp-${lineClamp}` : "";

  return (
    <div className={cn("whitespace-pre-wrap", clampClass, className)}>
      {elements}
    </div>
  );
}
