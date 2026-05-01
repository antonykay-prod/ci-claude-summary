require("dotenv").config();
const axios = require("axios");

async function listVoices() {
    try {
        const response = await axios.get("https://api.elevenlabs.io/v1/voices", {
            headers: {
                "xi-api-key": process.env.ELEVEN_LABS_API_KEY
            }
        });
        console.log(JSON.stringify(response.data.voices.map(v => ({ name: v.name, voice_id: v.voice_id })), null, 2));
    } catch (e) {
        console.error(e.response?.data || e.message);
    }
}

listVoices();
