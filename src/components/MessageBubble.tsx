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
      <div className="p-8 rounded-2xl bg-blue-900/35 border border-blue-500/25 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.35)] transition-all duration-300">
        <div className="flex items-start gap-4">
          <span className="text-4xl flex-shrink-0">{getMoodEmoji(mood)}</span>
          <div className="flex-1 space-y-4">
            <p className="text-xl md:text-2xl font-medium leading-relaxed text-blue-100 text-center">
              {message}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="hover:bg-blue-500/10 text-blue-200"
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
