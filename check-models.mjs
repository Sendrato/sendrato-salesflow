import "dotenv/config";

const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

// Test embeddings with different model names
const models = [
  "text-embedding-ada-002",
  "text-embedding-3-small",
  "text-embedding-3-large",
  "gemini-embedding-004",
];

for (const model of models) {
  try {
    const res = await fetch(`${apiUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: "Hello world",
      }),
    });
    const text = await res.text();
    if (res.status === 200) {
      const data = JSON.parse(text);
      console.log(
        `✓ ${model}: works! Dimensions: ${data.data?.[0]?.embedding?.length}`
      );
    } else {
      console.log(`✗ ${model}: ${res.status} - ${text.slice(0, 100)}`);
    }
  } catch (e) {
    console.log(`✗ ${model}: Error - ${e.message}`);
  }
}
