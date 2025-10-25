import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Replicate from 'https://esm.sh/replicate@0.34.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, voice = 'English_PlayfulGirl' } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    if (!REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN not configured');
    }

    console.log(`Generating speech for text: "${text}" with voice: ${voice}`);

    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

    // Generate speech using Minimax Speech-02-HD
    const output = await replicate.run(
      "minimax/speech-02-hd",
      {
        input: {
          text: text,
          voice_id: voice,
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

    console.log('Minimax TTS output:', output);

    // Output is a URL string
    const audioUrl = typeof output === 'string' ? output : null;
    
    if (!audioUrl) {
      console.error('Unexpected output format:', output);
      throw new Error('Failed to generate speech - no valid URL returned');
    }

    // Fetch the audio file and convert to base64
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to fetch generated audio');
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );

    console.log('Speech generated successfully');

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error in text-to-speech function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
