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

    // Use Bytedance Seedance for image-to-video generation
    const palette = params.mood === "upbeat" ? "bright colorful" : 
                    params.mood === "sleepy" ? "calm dreamy" : "warm neutral";
    
    const prompt = `Animate this image with kinetic text overlay: "${sanitize(params.line)}". ${palette} gradient effects, smooth camera movement, bold typography with outline, subtle sparkles, wholesome aesthetic.`;

    console.log(`Calling Bytedance Seedance with prompt: ${prompt}`);

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          image: params.imageBase64,
          prompt: prompt,
          duration: 5,
          resolution: "720p",
          aspect_ratio: "9:16",
          fps: 24,
          camera_fixed: false
        }
      }
    );

    console.log(`Seedance output:`, output);

    // Seedance returns a string URL directly
    const videoUrl = typeof output === 'string' ? output : null;
    
    if (!videoUrl || typeof videoUrl !== 'string') {
      console.error('Unexpected output format:', output);
      throw new Error(`Seedance video generation failed - no valid URL returned. Output: ${JSON.stringify(output)}`);
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
