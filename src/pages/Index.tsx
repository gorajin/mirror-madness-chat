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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCapture = async (imageData: string) => {
    setIsProcessing(true);
    setMessage(null);
    setReactionUrl(null);
    setAudioUrl(null);
    setIsVideoPending(false);

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

        // Generate audio for the message
        generateAudio(data.message);

        // Start video generation in background
        startVideoGeneration(imageData, data.message, data.mood);
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

  const generateAudio = async (text: string) => {
    try {
      console.log("Generating audio for message:", text);
      
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice: 'nova' } // nova is a clear, friendly voice
      });

      if (error) throw error;

      if (data?.audioContent) {
        // Convert base64 to audio URL
        const audioBlob = new Blob(
          [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
          { type: 'audio/mpeg' }
        );
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        console.log("Audio generated successfully");
      }
    } catch (error) {
      console.error("Error generating audio:", error);
      toast({
        title: "Audio generation failed",
        description: "Could not generate speech for the message",
        variant: "destructive",
      });
    }
  };

  const startVideoGeneration = async (imageData: string, line: string, mood: string) => {
    setIsVideoPending(true);

    try {
      // Start video generation job
      const { data: jobData, error: jobError } = await supabase.functions.invoke("reaction-video", {
        body: {
          imageBase64: imageData,
          line,
          mood,
          mode: "seedance"
        },
      });

      if (jobError || !jobData?.jobId) {
        console.error("Error starting video generation:", jobError);
        setIsVideoPending(false);
        return;
      }

      // Poll for job completion (max 30 attempts = 60 seconds)
      const jobId = jobData.jobId;
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: statusData, error: statusError } = await supabase.functions.invoke("job-status", {
          body: { jobId },
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
          setIsVideoPending(false);
          toast({
            title: "Video generation failed",
            description: "Could not generate reaction clip",
            variant: "destructive",
          });
          break;
        }
      }

      // Timeout after 60s
      if (isVideoPending) {
        setIsVideoPending(false);
      }
    } catch (error) {
      console.error("Error in video generation:", error);
      setIsVideoPending(false);
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <MessageBubble message={message} mood={mood} />
              
              {/* Video Generation Status */}
              {isVideoPending && (
                <div className="text-center p-6 rounded-2xl bg-card/50 border border-primary/20">
                  <p className="text-sm text-muted-foreground">🎬 Generating your reaction clip…</p>
                  <div className="flex justify-center gap-2 mt-3">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse delay-75" />
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse delay-150" />
                  </div>
                </div>
              )}

              {/* Reaction Video */}
              {reactionUrl && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <video 
                    src={reactionUrl} 
                    playsInline 
                    loop 
                    controls 
                    className="w-full max-h-[560px] rounded-2xl bg-black/80 border-2 border-primary/30"
                  />
                  {/* Audio player - plays alongside video */}
                  {audioUrl && (
                    <audio
                      src={audioUrl}
                      autoPlay
                      className="hidden"
                    />
                  )}
                </div>
              )}
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
