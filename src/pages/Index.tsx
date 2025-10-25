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
  const [isVideoPending, setIsVideoPending] = useState(false);
  const [reactionUrl, setReactionUrl] = useState<string | null>(null);
  const {
    toast
  } = useToast();
  const handleCapture = async (imageData: string) => {
    setIsProcessing(true);
    setMessage(null);
    setReactionUrl(null);
    setIsVideoPending(false);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("reflect", {
        body: {
          imageBase64: imageData,
          intensity,
          tone
        }
      });
      if (error) {
        console.error("Error calling reflect function:", error);
        toast({
          title: "Oops!",
          description: "Something went wrong. Try again?",
          variant: "destructive"
        });
        return;
      }
      if (data) {
        setMessage(data.message);
        setMood(data.mood);

        // Start video generation in background (audio is now embedded in the video)
        startVideoGeneration(imageData, data.message, data.mood);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to process image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  const startVideoGeneration = async (imageData: string, line: string, mood: string, attemptedRetry = false) => {
    setIsVideoPending(true);
    try {
      // Start video generation job
      const {
        data: jobData,
        error: jobError
      } = await supabase.functions.invoke("reaction-video", {
        body: {
          imageBase64: imageData,
          line,
          mood,
          mode: "seedance"
        }
      });
      if (jobError || !jobData?.jobId) {
        console.error("Error starting video generation:", jobError);
        setIsVideoPending(false);
        return;
      }

      // Poll for job completion (max 60 attempts = 120 seconds, checking every 2 seconds)
      const jobId = jobData.jobId;
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const {
          data: statusData,
          error: statusError
        } = await supabase.functions.invoke("job-status", {
          body: {
            jobId
          }
        });
        if (statusError) {
          console.error("Error checking job status:", statusError);
          continue;
        }
        if (statusData?.status === "succeeded" && statusData.videoUrl) {
          setReactionUrl(statusData.videoUrl);
          setIsVideoPending(false);
          break;
        }
        if (statusData?.status === "failed") {
          console.error("Video generation failed:", statusData.error);
          // If the model queue is full, retry once automatically
          if (!attemptedRetry && typeof statusData?.error === 'string' && /queue is full/i.test(statusData.error)) {
            toast({
              title: "Model queue is full",
              description: "Retrying video generation…",
              variant: "default"
            });
            await new Promise(r => setTimeout(r, 3000));
            await startVideoGeneration(imageData, line, mood, true);
            return;
          }
          setIsVideoPending(false);
          toast({
            title: "Video generation failed",
            description: statusData?.error || "Could not generate reaction clip",
            variant: "destructive"
          });
          break;
        }
      }

      // Timeout after 120s
      if (isVideoPending) {
        setIsVideoPending(false);
      }
    } catch (error) {
      console.error("Error in video generation:", error);
      setIsVideoPending(false);
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-6xl md:text-9xl font-bold font-kid-draws bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            BLUE MIRROR
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            See crystal clear your truest self (and maybe regret it)
          </p>
        </div>

        <div className="space-y-8">
          {/* Control Panel */}
          

          {/* Webcam Capture or Video */}
          {!reactionUrl ? (
            <WebcamCapture onCapture={handleCapture} isProcessing={isProcessing} />
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <video 
                src={reactionUrl} 
                autoPlay 
                playsInline 
                loop 
                controls 
                className="w-full max-h-[560px] rounded-3xl bg-black border-4 border-primary shadow-[var(--glow-purple)]" 
              />
            </div>
          )}

          {/* Message Display */}
          {message && <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <MessageBubble message={message} mood={mood} />
              
              {/* Video Generation Status */}
              {isVideoPending && <div className="text-center p-6 rounded-2xl bg-card/50 border border-primary/20">
                  <p className="text-sm text-muted-foreground">🎬 Generating your reaction clip…</p>
                  <div className="flex justify-center gap-2 mt-3">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse delay-75" />
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse delay-150" />
                  </div>
                </div>}
            </div>}

          {/* Loading State */}
          {isProcessing && <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 border border-primary/20">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse delay-150" />
                <span className="text-sm text-muted-foreground ml-2">
                  Consulting the mirror...
                </span>
              </div>
            </div>}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>AI reflections provided for entertainment and minor humiliation only.</p>
        </footer>
      </div>
    </div>;
};
export default Index;