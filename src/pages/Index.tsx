import { useState } from "react";
import { WebcamCapture } from "@/components/WebcamCapture";
import { MessageBubble } from "@/components/MessageBubble";
import { ControlPanel } from "@/components/ControlPanel";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

const Index = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [mood, setMood] = useState<string>("neutral");
  const [isProcessing, setIsProcessing] = useState(false);
  const [intensity, setIntensity] = useState(1);
  const [tone, setTone] = useState<"compliment" | "roast" | "coach">("coach");
  const { toast } = useToast();

  const handleCapture = async (imageData: string) => {
    setIsProcessing(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("reflect", {
        body: {
          imageBase64: imageData,
          intensity,
          tone,
        },
      });

      if (error) {
        console.error("Error calling reflect function:", error);
        toast({
          title: "Oops!",
          description: "Something went wrong. Try again?",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setMessage(data.message);
        setMood(data.mood);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to process image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-primary" />
            MirrorGPT
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            The Lovingly Unhelpful Smart Mirror
          </p>
        </div>

        <div className="space-y-8">
          {/* Control Panel */}
          <ControlPanel
            intensity={intensity}
            tone={tone}
            onIntensityChange={setIntensity}
            onToneChange={setTone}
          />

          {/* Webcam Capture */}
          <WebcamCapture onCapture={handleCapture} isProcessing={isProcessing} />

          {/* Message Display */}
          {message && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <MessageBubble message={message} mood={mood} />
            </div>
          )}

          {/* Loading State */}
          {isProcessing && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 border border-primary/20">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse delay-150" />
                <span className="text-sm text-muted-foreground ml-2">
                  Consulting the mirror...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>Remember: MirrorGPT's wisdom is 100% chaotic and 0% medical advice</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
