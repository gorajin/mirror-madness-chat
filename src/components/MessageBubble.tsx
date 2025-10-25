import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface MessageBubbleProps {
  message: string;
  mood: string;
}

export const MessageBubble = ({ message, mood }: MessageBubbleProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMoodEmoji = (mood: string) => {
    switch (mood) {
      case "upbeat":
        return "✨";
      case "sleepy":
        return "😴";
      default:
        return "🤔";
    }
  };

  return (
    <div className="relative">
      <div className="p-8 rounded-3xl bg-gradient-to-br from-card to-muted border-2 border-primary/30 shadow-[var(--glow-purple)]">
        <div className="flex items-start gap-4">
          <span className="text-4xl flex-shrink-0">{getMoodEmoji(mood)}</span>
          <div className="flex-1 space-y-4">
            <p className="text-xl md:text-2xl font-medium leading-relaxed text-foreground">
              {message}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="hover:bg-primary/10"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
