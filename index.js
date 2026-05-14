require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const app = express();
app.use(cors());
app.use(express.json());

// In-memory cache for API responses
const responseCache = {};

// Create public directory for audio files
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// Serve static files from public directory
app.use("/audio", express.static(publicDir));

// Cron job to clean up audio files every hour (deletes files older than 24 hours)
cron.schedule("0 * * * *", () => {
    console.log("Running audio cleanup job...");
    const now = Date.now();
    const expiryTime = 24 * 60 * 60 * 1000; // 24 hours

    fs.readdir(publicDir, (err, files) => {
        if (err) return console.error("Could not list the directory.", err);

        files.forEach((file) => {
            if (file.endsWith(".mp3")) {
                const filePath = path.join(publicDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return console.error("Error stating file.", err);

                    if (now - stats.mtimeMs > expiryTime) {
                        fs.unlink(filePath, (err) => {
                            if (err) return console.error("Error deleting file.", err);
                            console.log(`Deleted old audio file: ${file}`);
                        });
                    }
                });
            }
        });
    });
});

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Prompt Configuration
const prompts = {
    textSummary: {
        title: "Text Summary Prompt",
        description: "Generates a daily summary report for dental/medical practices.",
        content: `You are an AI assistant that generates a daily summary report for a dental/medical practice based on call analytics data. 
Generate a clear, concise summary in the following exact format with these specific sections: Overview, Conversions, Follow Ups, Revenue Opportunities, and Coaching Signal.

Use the following JSON data to generate the summary:
{{DATA}}

Instructions for each section:
- Overview: Summarize total calls, the largest share by call type, missed calls, and unactioned voicemails.
- Conversions: Detail the scheduling conversion rates. If benchmarks are provided, compare performance.
- Follow Ups: Discuss unrecovered missed calls and unactioned voicemails.
- Revenue Opportunities: Summarize open revenue opportunities.
- Coaching Signal: State the team average call score and compare it against benchmarks.

Ensure the tone is professional, direct, and actionable. Only output the requested sections.`
    },
    audioPodcast: {
        title: "Audio Podcast Prompt",
        description: "Generates a supportive and advisory coaching script for the team.",
        content: `You are a professional practice consultant providing a daily update. Your goal is to be a polite, supportive, and advisory coach for the team.

Use this data: {{DATA}}

Instructions for Tone and Language:
- Be polite and encouraging. Use a supportive coaching tone.
- AVOID hard commands or imperative verbs like "do this," "do that," "fix this," or "must."
- ALWAYS use advisory language like "I would advise," "We might consider," "It could be helpful to," "A great area for us to look at would be," or "Perhaps we could try."
- Use phrases like "Hey team," "I noticed some great things," and "One area where we can grow together is..."

Structure:
- Warm introduction.
- Highlight the positive data points first.
- Gently advise on areas for improvement based on the gaps.
- End with a supportive and advisory "thought for the day."
- Keep it under 2 minutes when spoken (approx 250-300 words).
- DO NOT use the same structure as a written report. Make it sound natural for audio.
- ONLY output the spoken script text. No stage directions like [Music starts].`
    }
};

// API to get prompts
app.get("/api/prompts", (req, res) => {
    res.json({
        status: true,
        prompts: prompts
    });
});

// Serve frontend from public directory
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/summary", async (req, res) => {
    try {
        const payload = req.body;
        
        const location = payload.data?.location || payload.location;
        const organization = payload.data?.organization || payload.organization;
        
        let date_range = null;
        if (payload.Date_range && payload.Date_range.startDate && payload.Date_range.endDate) {
            // Convert timestamp to readable format for better dashboard viewing
            const start = new Date(parseInt(payload.Date_range.startDate)).toISOString().split('T')[0];
            const end = new Date(parseInt(payload.Date_range.endDate)).toISOString().split('T')[0];
            date_range = `${start} to ${end}`;
        } else if (payload.date_range) {
            date_range = payload.date_range;
        } else if (payload.startDate && payload.endDate) {
            date_range = `${payload.startDate}_${payload.endDate}`;
        }

        const cacheKey = organization && location && date_range 
            ? `${organization}_${location}_${date_range}` 
            : null;

        let summaryText;
        let podcastScript;
        let useCachedAudio = false;
        let cachedAudioUrl = null;

        if (cacheKey && responseCache[cacheKey]) {
            const cached = responseCache[cacheKey];
            summaryText = cached.summaryText;
            podcastScript = cached.podcastScript;
            
            if (cached.audioUrl) {
                const audioFileName = cached.audioUrl.split('/').pop();
                const audioFilePath = path.join(publicDir, audioFileName);
                if (fs.existsSync(audioFilePath)) {
                    useCachedAudio = true;
                    cachedAudioUrl = cached.audioUrl;
                }
            }
        }

        if (useCachedAudio) {
            console.log(`Full cache hit for key: ${cacheKey}`);
            return res.json({
                status: true,
                message: "Summary and Audio retrieved from cache successfully",
                summary: summaryText,
                audio_url: cachedAudioUrl
            });
        }

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

        const dataString = JSON.stringify(payload, null, 2);

        if (!summaryText || !podcastScript) {
            // 1. Generate Text Summary
            const textPrompt = prompts.textSummary.content.replace("{{DATA}}", dataString);

            // 2. Generate Polite/Coaching Podcast Script for Audio
            const audioPrompt = prompts.audioPodcast.content.replace("{{DATA}}", dataString);

            try {
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

                summaryText = textResponse.content.filter(b => b.type === "text").map(b => b.text).join("");
                podcastScript = audioScriptResponse.content.filter(b => b.type === "text").map(b => b.text).join("");
            } catch (claudeError) {
                console.error("Claude API failed, falling back to OpenAI:", claudeError.message);
                
                const openAiUrl = "https://api.openai.com/v1/chat/completions";
                const openAiKey = process.env.OPENAI_API_KEY;
                
                const getOpenAiCompletion = async (prompt) => {
                    const response = await axios.post(openAiUrl, {
                        model: "gpt-4o",
                        messages: [{ role: "user", content: prompt }],
                        max_tokens: 2000
                    }, {
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${openAiKey}`
                        }
                    });
                    return response.data.choices[0].message.content;
                };

                const [textResponse, audioScriptResponse] = await Promise.all([
                    getOpenAiCompletion(textPrompt),
                    getOpenAiCompletion(audioPrompt)
                ]);
                
                summaryText = textResponse;
                podcastScript = audioScriptResponse;
            }
        }

        // 3. Generate Audio using ElevenLabs
        const voiceId = "XrExE9yKIg1WjnnlVkGX"; // Matilda (Professional & Knowledgeable Female Voice)
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

        const host = req.get("host");
        const protocol = host.includes("localhost") ? "http" : "https";
        const audioUrl = `${protocol}://${host}/audio/${fileName}`;

        if (cacheKey) {
            responseCache[cacheKey] = {
                organization,
                location,
                date_range,
                summaryText,
                podcastScript,
                audioUrl,
                payload
            };
        }

        res.json({
            status: true,
            message: "Summary and Audio generated successfully",
            summary: summaryText,
            audio_url: audioUrl
        });

    } catch (error) {
        let errorMessage = error.message;
        if (error.response?.data) {
            errorMessage = `ElevenLabs Error: ${error.response.status}`;
        }
        console.error("Error generating summary or audio:", errorMessage);
        res.status(500).json({
            status: false,
            message: "Failed to generate summary or audio",
            error: errorMessage
        });
    }
});

// API to get all cached items
app.get("/api/cache", (req, res) => {
    const cacheList = Object.keys(responseCache).map(key => {
        return {
            key,
            organization: responseCache[key].organization,
            location: responseCache[key].location,
            date_range: responseCache[key].date_range,
            summaryText: responseCache[key].summaryText,
            audioUrl: responseCache[key].audioUrl,
            payload: responseCache[key].payload
        };
    });
    res.json({ status: true, cache: cacheList });
});

// API to delete selected cached items
app.delete("/api/cache", (req, res) => {
    const { keys } = req.body;
    if (keys && Array.isArray(keys)) {
        let deletedCount = 0;
        keys.forEach(key => {
            if (responseCache[key]) {
                delete responseCache[key];
                deletedCount++;
            }
        });
        res.json({ status: true, message: `Deleted ${deletedCount} items from cache` });
    } else {
        res.status(400).json({ status: false, message: "Invalid keys provided" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

