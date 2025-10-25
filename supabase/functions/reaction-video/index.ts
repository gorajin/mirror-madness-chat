import Replicate from "https://esm.sh/replicate@0.34.1";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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
    try {
      await supabaseAdmin.from('reaction_jobs').insert({ id: jobId, status: 'queued' });
    } catch (e) {
      console.error('Failed to insert reaction_jobs queued row:', e);
    }

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
    try {
      await supabaseAdmin.from('reaction_jobs').update({ status: 'running' }).eq('id', jobId);
    } catch (e) {
      console.error('Failed to mark job running:', e);
    }
    console.log(`Starting video generation for job ${jobId}`);

    const replicate = new Replicate({ auth: params.token });

    // Use a simpler text-to-video model that works reliably
    const palette = params.mood === "upbeat" ? "bright colorful" : 
                    params.mood === "sleepy" ? "calm blue" : "neutral purple";
    
    const prompt = `A short 5-second vertical video with animated text: "${sanitize(params.line)}". ${palette} gradient background, kinetic typography, bold rounded font with white outline, subtle sparkles, wholesome aesthetic.`;

    console.log(`Calling text-to-video with prompt: ${prompt}`);

    const output = await replicate.run(
      "anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c6a83eea0d493e81006a9122c5dc1f4e76edda",
      {
        input: {
          prompt: prompt,
          width: 576,
          height: 1024,
          num_frames: 24,
          fps: 8
        }
      }
    );

    console.log(`Replicate output:`, output);

    // Extract video URL from output - handle different possible formats
    let videoUrl: string | null = null;
    
    if (typeof output === 'string') {
      videoUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      videoUrl = output[0];
    } else if (output && typeof output === 'object') {
      videoUrl = (output as any).output || (output as any).url || (output as any).video_url;
    }
    
    if (!videoUrl || typeof videoUrl !== 'string') {
      console.error('Unexpected output format:', output);
      throw new Error(`Video generation failed - no valid URL returned. Output: ${JSON.stringify(output)}`);
    }

    console.log(`Video generated successfully for job ${jobId}: ${videoUrl}`);
    jobs.set(jobId, { status: "succeeded", videoUrl: String(videoUrl) });
    try {
      await supabaseAdmin.from('reaction_jobs')
        .update({ status: 'succeeded', video_url: String(videoUrl) })
        .eq('id', jobId);
    } catch (e) {
      console.error('Failed to mark job succeeded:', e);
    }

  } catch (error) {
    console.error(`Video generation failed for job ${jobId}:`, error);
    const errMsg = error instanceof Error ? error.message : String(error);
    jobs.set(jobId, { 
      status: "failed", 
      error: errMsg 
    });
    try {
      await supabaseAdmin.from('reaction_jobs')
        .update({ status: 'failed', error: errMsg })
        .eq('id', jobId);
    } catch (e2) {
      console.error('Failed to mark job failed:', e2);
    }
  }
}

function sanitize(s: string): string {
  return s.replace(/[\r\n]+/g, " ").slice(0, 120);
}

// Export jobs map for job-status function to access
export { jobs };
