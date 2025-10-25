import Replicate from "https://esm.sh/replicate@0.34.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      console.error("REPLICATE_API_TOKEN is not configured");
      return new Response(
        JSON.stringify({ error: "Missing REPLICATE_API_TOKEN" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { imageBase64, intensity = 1, tone = "coach" } = body || {};

    // Validate image data
    if (!imageBase64 || !imageBase64.startsWith("data:image/jpeg;base64,")) {
      console.error("Invalid image format received");
      return new Response(
        JSON.stringify({ error: "Invalid image format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing image with tone: ${tone}, intensity: ${intensity}`);

    const replicate = new Replicate({
      auth: REPLICATE_API_TOKEN,
    });

    // Step 1: Get image caption using LLaVA with correct version hash
    console.log("Generating image caption...");
    const captionOutput = await replicate.run(
      "yorickvp/llava-13b:80537f9eead1a5bfa72d5ac6ea6414379be41d4d4f6679fd776e9535d1eb58bb",
      {
        input: {
          image: imageBase64,
          prompt: "Describe the person's visible expression, posture, and outfit briefly (max 12 words).",
          max_tokens: 100
        }
      }
    );

    const desc = (Array.isArray(captionOutput) ? captionOutput.join(" ") : String(captionOutput))
      .slice(0, 160) || "uncertain appearance";
    
    console.log(`Caption generated: ${desc}`);

    // Step 2: Map tone to style
    const toneRules: Record<string, string> = {
      compliment: "Wholesome, short hype compliment (max 12 words). Be clever, not boring.",
      roast: "Savage, witty, 12 words max. PG-13. Mock outfit, vibe, or confidence.",
      coach: "Chaotic life coach wisdom. Sound delusional but motivational."
    };
    const toneStyle = toneRules[tone] || "Chaotic life coach wisdom. Sound delusional but motivational.";

    // Step 3: Map intensity to absurdity level
    const weird = Math.max(0, Math.min(3, Number(intensity)));
    const absurdityLevels = ["none", "subtle", "noticeable", "bold"];
    const absurdity = absurdityLevels[weird];

    console.log(`Generating message with tone: ${toneStyle}, absurdity: ${absurdity}`);

    // Step 4: Generate the one-liner using Llama 3 with correct version hash
    const systemPrompt = `SYSTEM: You are Blue Mirror — a witty, self-aware AI mirror.
RULES:
- Output one short, clever line (≤ 12 words)
- PG-13 humor, never cruel
- Focus on outfit, expression, or energy
- Tone options: Sweet / Savage / Delulu Coach
STYLE: Internet-native, sarcastic but smart
TONE: ${toneStyle}

USER:
Based on this image: "${desc}"`;

    const lineOutput = await replicate.run(
      "meta/meta-llama-3-8b-instruct:5a6809ca6288247d06daf6365557e5e429063f32a21146b2a807c682652136b8",
      {
        input: {
          prompt: systemPrompt,
          temperature: 0.2,
          max_tokens: 60,
          top_p: 0.9
        }
      }
    );

    const messageRaw = Array.isArray(lineOutput) ? lineOutput.join(" ") : String(lineOutput);
    const message = messageRaw.replace(/\s+/g, " ").trim().slice(0, 160);

    // Determine mood from description
    const mood = /smile|happy|cheerful|confident/i.test(desc) ? "upbeat" :
                 /tired|sleepy|messy/i.test(desc) ? "sleepy" : "neutral";

    console.log(`Generated message: ${message}`);

    return new Response(
      JSON.stringify({ mood, message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in reflect function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", errorMessage, errorStack);
    
    // Return a friendly fallback message
    return new Response(
      JSON.stringify({ 
        mood: "neutral", 
        message: "You've got this—coffee and curiosity should help.",
        error: errorMessage // Include error for debugging
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
