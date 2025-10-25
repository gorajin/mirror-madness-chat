import { useState } from "react";
import { motion } from "framer-motion";
import { WebcamCapture } from "@/components/WebcamCapture";
import { MessageBubble } from "@/components/MessageBubble";
import { Button } from "@/components/ui/button";
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
  return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 bg-[length:200%_200%] animate-pulse">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.5
      }} className="text-center mb-12 space-y-3">
          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-violet-400 drop-shadow-[0_0_12px_rgba(59,130,246,0.55)] flex items-center justify-center gap-4">
            <Sparkles className="w-10 h-10 md:w-14 md:h-14 text-blue-400" />
            Blue Mirror
          </h1>
          <p className="text-lg md:text-xl text-blue-200/80 italic font-light">
            See crystal clear your truest self (and maybe regret it).
          </p>
        </motion.div>

        <div className="space-y-8">
          {/* Mood Mode Buttons */}
          

          {/* Webcam Capture */}
          <motion.div initial={{
          opacity: 0,
          y: 10
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.35,
          delay: 0.2
        }}>
            <WebcamCapture onCapture={handleCapture} isProcessing={isProcessing} />
          </motion.div>

          {/* Message Display */}
          {message && <motion.div initial={{
          opacity: 0,
          y: 10,
          filter: 'blur(4px)'
        }} animate={{
          opacity: 1,
          y: 0,
          filter: 'blur(0px)'
        }} exit={{
          opacity: 0,
          y: -10
        }} transition={{
          duration: 0.35,
          ease: 'easeOut'
        }} className="space-y-6">
              <MessageBubble message={message} mood={mood} />
              
              {/* Video Generation Status */}
              {isVideoPending && <motion.div initial={{
            opacity: 0
          }} animate={{
            opacity: 1
          }} className="text-center p-6 rounded-2xl bg-blue-900/35 border border-blue-500/25 backdrop-blur-md">
                  <p className="text-sm text-blue-200">🎬 Generating your reaction clip…</p>
                  <div className="flex justify-center gap-2 mt-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse delay-75" />
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse delay-150" />
                  </div>
                </motion.div>}

              {/* Talking Avatar Video */}
              {reactionUrl && <motion.div initial={{
            opacity: 0,
            scale: 0.95
          }} animate={{
            opacity: 1,
            scale: 1
          }} transition={{
            duration: 0.35
          }}>
                  <video src={reactionUrl} autoPlay playsInline loop controls className="w-full max-h-[560px] rounded-2xl bg-black/80 border-2 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.35)]" />
                </motion.div>}
            </motion.div>}

          {/* Loading State */}
          {isProcessing && <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-500/10 border border-blue-500/20">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse delay-150" />
                <span className="text-sm text-blue-200 ml-2">
                  Consulting the mirror...
                </span>
              </div>
            </motion.div>}
        </div>

        {/* Footer */}
        <motion.footer initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        delay: 0.5
      }} className="mt-16 text-center text-xs text-blue-300/60">
          <p>Remember: Blue Mirror's wisdom is 100% chaotic and 0% medical advice.</p>
        </motion.footer>
      </div>
    </div>;
};
export default Index;