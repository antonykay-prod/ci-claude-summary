require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

const samples = [
    {
        id: "yesterday",
        fileName: "sample-yesterday.mp3",
        text: `Hey team, good morning! I hope everyone's ready for a great day. I wanted to take a few minutes to walk you through how yesterday went, and share some thoughts on where we're heading.
First, let's celebrate some wins. We handled 52 calls yesterday — that's a solid volume, and existing patient and recare conversions held steady, which tells me the team is building real rapport with our patients. That consistency matters, and I want you to know it's noticed.
Now, a few areas where I think we can grow together. New patient scheduling came in at 34%, and our target is 40%. I noticed the 2 to 5 PM window is where we're seeing the most opportunity — it might be worth us exploring how we're approaching those afternoon calls as a team.
On the follow-up side, we still have 2 missed new patient calls unrecovered, and 3 voicemails waiting on a return — one of which had a caller who sounded a little frustrated. I would advise we make those a priority this morning, just to show those patients we genuinely care about getting them in.
We also have 2 hot revenue opportunities that I'd love to see us reach out to today — together they're part of $6,190 in potential for the practice.
For coaching, our average call score was 71, and I think with a little focus we can get comfortably past that 75 target. It could be really helpful to think about offering an immediate slot early in the call, and always confirming next steps before we hang up — those two habits alone can move the needle significantly.
You're all doing meaningful work. Let's make today a great one.`
    },
    {
        id: "7days",
        fileName: "sample-7days.mp3",
        text: `Hey team! Happy weekly reflection. I wanted to share a quick update on how our last 7 days went, and discuss some great ways we can elevate our practice together.
Over the past week, we handled a solid 348 calls. A big shoutout to everyone for keeping our existing patient and recare conversions steady at 78% and 62% respectively. That dedication to our loyal patients is what keeps our schedule healthy.
Looking at our growth opportunities: new patient scheduling averaged 36% this week, just shy of our 40% benchmark. Similar to our daily trend, those afternoon hours continue to be our primary bottleneck. Let's think about how we can bring more energy and focus to those late-day calls.
In terms of follow-ups, we missed 38 calls over the week and 8 remain unrecovered. Let's make it a team challenge to reach out to those 5 new patients and 3 existing patients who didn't get through. Also, we have 3 unactioned voicemails pending return. Let's clear those out first thing today.
On a very exciting note, we generated 28 open revenue opportunities over the week, representing a massive 34,850 dollars in potential revenue. Six of these are flagged as hot! Same-day outreach on these could really boost our bookings.
Lastly, our weekly coaching score averaged 73, which is incredibly close to our 75 target. To get us over the line, I'd suggest focusing on two things: making sure we present treatment options proactively on recare calls, and sealing every conversation with a clear, confirmed next step.
Thank you all for your hard work this week. Let's keep supporting each other and make the upcoming week even better!`
    },
    {
        id: "30days",
        fileName: "sample-30days.mp3",
        text: `Hey team, welcome to our monthly performance recap. Taking a high-level look at the last 30 days is incredibly powerful for seeing the big picture of how our practice is growing and where we can refine our approach.
Over the last month, we handled an outstanding 1,480 calls. That is a massive volume, and I want to congratulate you on keeping our existing patient conversion rate at an incredible 81%, and recare conversion steady at 65%. You are consistently delivering an exceptional experience for our returning patients.
For areas where we can grow: our new patient scheduling conversion averaged 35% against our 40% target. The data shows consistent drops during lunch hours from 12 to 1 PM and late afternoons from 4 to 5 PM. It might be helpful to review our scheduling coverage during these peak times to ensure we never miss a beat.
Regarding follow-ups, we missed 142 calls this month, and 28 of those were not recovered—mostly new patients. Reclaiming these missed calls is one of the fastest ways to grow our patient base. We also have 5 unactioned voicemails pending return. Let's ensure these are addressed promptly to maintain our reputation for stellar service.
Financially, the team generated 112 open revenue opportunities this month, totaling an impressive 138,400 dollars in potential revenue. With 22 hot leads in that mix, a coordinated outreach campaign could yield amazing results.
Our average call score for the month was 72. To push past our 75 benchmark, let's focus on proactively offering immediate open slots, asking if other family members need booking, and double-checking insurance benefits to remove friction.
You've all put in an amazing effort this month. Thank you for your passion and dedication to our patients. Let's carry this momentum forward!`
    }
];

async function generateSampleAudio(sample) {
    const filePath = path.join(publicDir, sample.fileName);
    if (fs.existsSync(filePath)) {
        console.log(`Audio file already exists for ${sample.id}: ${sample.fileName}`);
        return;
    }

    console.log(`Generating audio for ${sample.id}...`);
    const voiceId = "XrExE9yKIg1WjnnlVkGX"; // Matilda
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    try {
        const audioResponse = await axios({
            method: "post",
            url: elevenLabsUrl,
            data: {
                text: sample.text,
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

        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        console.log(`Audio successfully generated and saved as public/${sample.fileName}`);
    } catch (error) {
        console.error(`Error generating audio for ${sample.id}:`, error.response?.data || error.message);
    }
}

async function main() {
    for (const sample of samples) {
        await generateSampleAudio(sample);
    }
    console.log("All audio generation checks completed!");
}

main();
