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
    console.log(`Starting talking avatar generation for job ${jobId}`);

    const replicate = new Replicate({ auth: params.token });

    // Step 1: Generate audio with minimax TTS
    console.log('Step 1: Generating audio with minimax TTS...');
    const audioOutput = await replicate.run(
      "minimax/speech-02-hd",
      {
        input: {
          text: sanitize(params.line),
          voice_id: 'English_PlayfulGirl', // Fun voice for gaslighting
          speed: 1.0,
          volume: 1.0,
          pitch: 0,
          sample_rate: 32000,
          bitrate: 128000,
          channel: "mono",
          english_normalization: true
        }
      }
    );

    const audioUrl = typeof audioOutput === 'string' ? audioOutput : null;
    if (!audioUrl) {
      throw new Error('Failed to generate audio');
    }
    console.log(`Audio generated: ${audioUrl}`);

    // Step 2: Create talking avatar with omnihuman using the audio and image
    console.log('Step 2: Creating talking avatar with omnihuman...');
    console.log('Image data length:', params.imageBase64.length);
    console.log('Audio URL:', audioUrl);
    
    const videoOutput = await replicate.run(
      "bytedance/omni-human",
      {
        input: {
          image: params.imageBase64,
          audio: audioUrl
        }
      }
    );

    console.log(`Omni-human output type:`, typeof videoOutput);
    console.log(`Omni-human output:`, JSON.stringify(videoOutput).substring(0, 200));

    // Extract video URL from output
    const videoUrl = typeof videoOutput === 'string' ? videoOutput : null;
    
    if (!videoUrl || typeof videoUrl !== 'string') {
      console.error('Unexpected output format:', videoOutput);
      throw new Error(`Talking avatar generation failed - no valid URL returned. Output: ${JSON.stringify(videoOutput)}`);
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
