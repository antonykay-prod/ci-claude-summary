require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Create public directory for audio files
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// Serve static files from public directory
app.use("/audio", express.static(publicDir));

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

app.post("/api/summary", async (req, res) => {
    try {
        const payload = req.body;

        // Clean benchmarks to remove empty/undefined ones
        let cleanedBenchmarks = {};
        if (payload.benchmarks) {
            for (const [key, value] of Object.entries(payload.benchmarks)) {
                if (value !== undefined && value !== null && value !== "") {
                    cleanedBenchmarks[key] = value;
                }
            }
            payload.benchmarks = cleanedBenchmarks;
        }

        // 1. Generate Text Summary
        const textPrompt = `You are an AI assistant that generates a daily summary report for a dental/medical practice based on call analytics data. 
Generate a clear, concise summary in the following exact format with these specific sections: Overview, Conversions, Follow Ups, Revenue Opportunities, and Coaching Signal.

Use the following JSON data to generate the summary:
${JSON.stringify(payload, null, 2)}

Instructions for each section:
- Overview: Summarize total calls, the largest share by call type, missed calls, and unactioned voicemails.
- Conversions: Detail the scheduling conversion rates. If benchmarks are provided, compare performance.
- Follow Ups: Discuss unrecovered missed calls and unactioned voicemails.
- Revenue Opportunities: Summarize open revenue opportunities.
- Coaching Signal: State the team average call score and compare it against benchmarks.

Ensure the tone is professional, direct, and actionable. Only output the requested sections.`;

        // 2. Generate Podcast Script for Audio
        const audioPrompt = `You are a professional practice consultant. Create a highly engaging, conversational, and communicative audio script (like a short podcast episode) summarizing the daily performance for a dental/medical practice.

Use this data: ${JSON.stringify(payload, null, 2)}

Instructions:
- Tone: Energetic, encouraging, yet firm on performance gaps. Use phrases like "Hey team," "Let's dive into the numbers," and "Here's what we need to focus on today."
- Structure: Start with a quick hook, go through the big wins, highlight the missed opportunities, and end with a "one big thing" to action today.
- Keep it under 2 minutes when spoken (approx 250-300 words).
- DO NOT use the same structure as a written report. Make it sound natural for audio.
- Only output the spoken script text. No stage directions like [Music starts].`;

        // Parallel generation using Anthropic
        const [textResponse, audioScriptResponse] = await Promise.all([
            anthropic.messages.create({
                model: "claude-opus-4-7",
                max_tokens: 2000,
                thinking: { type: "adaptive" },
                messages: [{ role: "user", content: textPrompt }]
            }),
            anthropic.messages.create({
                model: "claude-opus-4-7",
                max_tokens: 2000,
                thinking: { type: "adaptive" },
                messages: [{ role: "user", content: audioPrompt }]
            })
        ]);

        let summaryText = textResponse.content.filter(b => b.type === "text").map(b => b.text).join("");
        let podcastScript = audioScriptResponse.content.filter(b => b.type === "text").map(b => b.text).join("");

        // 3. Generate Audio using ElevenLabs
        const voiceId = "21m00Tcm4TbcDqjt88lp"; // Rachel (Professional Female Voice)
        const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        
        const audioResponse = await axios({
            method: "post",
            url: elevenLabsUrl,
            data: {
                text: podcastScript,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            },
            headers: {
                "Accept": "audio/mpeg",
                "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
                "Content-Type": "application/json"
            },
            responseType: "stream"
        });

        const fileName = `summary-${Date.now()}.mp3`;
        const filePath = path.join(publicDir, fileName);
        const writer = fs.createWriteStream(filePath);

        audioResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        const protocol = req.protocol;
        const host = req.get("host");
        const audioUrl = `${protocol}://${host}/audio/${fileName}`;

        res.json({
            status: true,
            message: "Summary and Audio generated successfully",
            summary: summaryText,
            audio_url: audioUrl
        });

    } catch (error) {
        console.error("Error generating summary or audio:", error);
        res.status(500).json({
            status: false,
            message: "Failed to generate summary or audio",
            error: error.response?.data ? "ElevenLabs Error" : error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
