import Replicate from "https://esm.sh/replicate@0.34.1";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory job store (simple MVP approach)
const jobs = new Map<string, {
  status: "queued" | "running" | "succeeded" | "failed";
  videoUrl?: string;
  error?: string;
}>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, line, mood = "neutral", mode = "seedance" } = await req.json();

    if (!imageBase64?.startsWith("data:image/") || !line) {
      return new Response(
        JSON.stringify({ error: "Invalid input: imageBase64 and line required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN not configured");
    }

    // Generate job ID
    const jobId = crypto.randomUUID();
    jobs.set(jobId, { status: "queued" });

    // Fire-and-forget async processing
    processVideoGeneration(jobId, { imageBase64, line, mood, mode, token: REPLICATE_API_TOKEN });

    return new Response(
      JSON.stringify({ jobId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in reaction-video:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function processVideoGeneration(
  jobId: string,
  params: { imageBase64: string; line: string; mood: string; mode: string; token: string }
) {
  try {
    jobs.set(jobId, { status: "running" });
    console.log(`Starting video generation for job ${jobId}`);

    const replicate = new Replicate({ auth: params.token });

    // Use Seedance for image-to-video
    const palette = params.mood === "upbeat" ? "teal/cyan" : 
                    params.mood === "sleepy" ? "indigo/navy" : "lilac/gray";
    
    const prompt = `Vertical 5s reaction clip. Animated ${palette} gradient. Kinetic captions: "${sanitize(params.line)}". Rounded bold font with outline. Subtle sparkles. Wholesome vibe.`;

    console.log(`Calling Seedance with prompt: ${prompt}`);

    const output = await replicate.run(
      "bytedance/seedance-1-pro-fast:latest",
      {
        input: {
          mode: "i2v",
          prompt,
          image: params.imageBase64,
          duration: 5,
          resolution: "720p",
          aspect_ratio: "9:16",
          seed: 42
        }
      }
    );

    // Extract video URL from output
    const videoUrl = Array.isArray(output) ? output[0] : (output as any)?.output?.[0];
    
    if (!videoUrl) {
      throw new Error("Seedance did not return a video URL");
    }

    console.log(`Video generated successfully for job ${jobId}: ${videoUrl}`);
    jobs.set(jobId, { status: "succeeded", videoUrl: String(videoUrl) });

  } catch (error) {
    console.error(`Video generation failed for job ${jobId}:`, error);
    jobs.set(jobId, { 
      status: "failed", 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

function sanitize(s: string): string {
  return s.replace(/[\r\n]+/g, " ").slice(0, 120);
}

// Export jobs map for job-status function to access
export { jobs };
