import DashboardLayout from "@/components/DashboardLayout";
import AIChatBox from "@/components/AIChatBox";
import { useState } from "react";

const SUGGESTED_PROMPTS = [
  "Which leads haven't been contacted in the last 30 days?",
  "Show me all high-priority leads in the proposal stage",
  "What are the main pain points across our leads?",
  "Which companies are in the event management industry?",
  "Summarize the opportunities for leads in negotiation",
  "Which leads should I follow up with this week?",
];

export default function AIChat() {
  const [chatId] = useState("crm-chat-main");

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)]">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions about your leads, pipeline, and contact history using
            natural language
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <AIChatBox
            api="/api/crm-chat"
            chatId={chatId}
            initialMessages={[]}
            placeholder="Ask about your leads, pipeline, or contacts..."
            emptyStateMessage="Ask me anything about your CRM data. I can search leads, summarize activity, identify opportunities, and more."
            suggestedPrompts={SUGGESTED_PROMPTS}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
