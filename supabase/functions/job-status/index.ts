import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let jobId: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      jobId = url.searchParams.get('jobId');
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      jobId = body?.jobId ?? null;
    }

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "jobId parameter required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('reaction_jobs')
      .select('status, video_url, error')
      .eq('id', jobId)
      .maybeSingle();

    if (error) {
      console.error('job-status select error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch job status' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ status: "not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    return new Response(
      JSON.stringify({ status: data.status, videoUrl: data.video_url, error: data.error }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in job-status:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
