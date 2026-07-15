require("dotenv").config();
const axios = require("axios");
const fs = require("fs");

const text = `Hey team, good morning! I hope everyone's ready for a great day. I wanted to take a few minutes to walk you through how yesterday went, and share some thoughts on where we're heading.
First, let's celebrate some wins. We handled 52 calls yesterday — that's a solid volume, and existing patient and recare conversions held steady, which tells me the team is building real rapport with our patients. That consistency matters, and I want you to know it's noticed.
Now, a few areas where I think we can grow together. New patient scheduling came in at 34%, and our target is 40%. I noticed the 2 to 5 PM window is where we're seeing the most opportunity — it might be worth us exploring how we're approaching those afternoon calls as a team.
On the follow-up side, we still have 2 missed new patient calls unrecovered, and 3 voicemails waiting on a return — one of which had a caller who sounded a little frustrated. I would advise we make those a priority this morning, just to show those patients we genuinely care about getting them in.
We also have 2 hot revenue opportunities that I'd love to see us reach out to today — together they're part of $6,190 in potential for the practice.
For coaching, our average call score was 71, and I think with a little focus we can get comfortably past that 75 target. It could be really helpful to think about offering an immediate slot early in the call, and always confirming next steps before we hang up — those two habits alone can move the needle significantly.
You're all doing meaningful work. Let's make today a great one.`;

async function generateSample() {
    console.log("Generating sample audio...");
    const voiceId = "XrExE9yKIg1WjnnlVkGX"; // Matilda
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    try {
        const audioResponse = await axios({
            method: "post",
            url: elevenLabsUrl,
            data: {
                text: text,
                model_id: "eleven_turbo_v2_5",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0.3,
                    use_speaker_boost: true
                }
            },
            headers: {
                "Accept": "audio/mpeg",
                "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
                "Content-Type": "application/json"
            },
            responseType: "stream"
        });

        const writer = fs.createWriteStream("sample.mp3");
        audioResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        console.log("Audio successfully generated and saved as sample.mp3");
    } catch (error) {
        console.error("Error generating audio:", error.response?.data || error.message);
    }
}

generateSample();
