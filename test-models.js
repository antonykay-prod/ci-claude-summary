require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testModels() {
    const modelsToTest = [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-sonnet-20240620",
        "claude-3-opus-20240229",
        "claude-2.1",
        "claude-instant-1.2"
    ];

    for (const model of modelsToTest) {
        console.log(`Testing model: ${model}...`);
        try {
            const response = await anthropic.messages.create({
                model: model,
                max_tokens: 10,
                messages: [{ role: "user", content: "Hi" }]
            });
            console.log(`✅ Success with model: ${model}`);
            return model;
        } catch (error) {
            console.log(`❌ Failed with model: ${model} - ${error.message}`);
        }
    }
    console.log("None of the models succeeded.");
    return null;
}

testModels();
