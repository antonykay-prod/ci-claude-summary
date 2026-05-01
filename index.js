require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(cors());
app.use(express.json());

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

        const prompt = `You are an AI assistant that generates a daily summary report for a dental/medical practice based on call analytics data. 
Generate a clear, concise summary in the following exact format with these specific sections: Overview, Conversions, Follow Ups, Revenue Opportunities, and Coaching Signal.

Use the following JSON data to generate the summary:
${JSON.stringify(payload, null, 2)}

Instructions for each section:
- Overview: Summarize total calls, the largest share by call type, missed calls, and unactioned voicemails.
- Conversions: Detail the scheduling conversion rates. If benchmarks are provided for "First Call New Patient Conversion" or others, compare the performance against the target. Mention cancellations and rescheduling.
- Follow Ups: Discuss unrecovered missed calls and unactioned voicemails based on the data.
- Revenue Opportunities: Summarize open revenue opportunities, their potential revenue (if inferable or mentioned), and any "hot" opportunities needing immediate outreach.
- Coaching Signal: State the team average call score and compare it against the "Avg Call Score" benchmark if provided. Highlight areas of improvement.

Ensure the tone is professional, direct, and actionable. Only output the requested sections.`;

        const response = await anthropic.messages.create({
            model: "claude-opus-4-7",
            max_tokens: 16000,
            thinking: {
                type: "adaptive"
            },
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        });

        let summaryText = "";
        for (const block of response.content) {
            if (block.type === "text") {
                summaryText += block.text;
            }
        }

        res.json({
            status: true,
            message: "Summary generated successfully",
            summary: summaryText
        });

    } catch (error) {
        console.error("Error generating summary:", error);
        res.status(500).json({
            status: false,
            message: "Failed to generate summary",
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
