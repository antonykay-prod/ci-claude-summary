const axios = require('axios');

const url = 'https://ci-claude-summary-production.up.railway.app/api/summary';

const samplePayload = {
    total_calls: 45,
    call_types: {
        "New Patient": 20,
        "Existing Patient": 15,
        "Other": 10
    },
    missed_calls: 5,
    unactioned_voicemails: 2,
    scheduling_conversion_rate: 75,
    unrecovered_missed_calls: 3,
    open_revenue_opportunities: "$12,500",
    team_average_call_score: 82,
    benchmarks: {
        conversion_rate_benchmark: 80,
        call_score_benchmark: 85
    }
};

async function testApi() {
    console.log('Testing Railway API at:', url);
    try {
        const response = await axios.post(url, samplePayload);
        console.log('✅ Status:', response.status);
        console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

testApi();
