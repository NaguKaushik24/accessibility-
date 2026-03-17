import { GoogleGenAI } from "@google/genai";

async function test() {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("API_KEY and GEMINI_API_KEY are NOT set in the environment.");
    console.log("Available env keys:", Object.keys(process.env).filter(k => k.includes('API') || k.includes('GEMINI') || k.includes('KEY')));
    process.exit(1);
  }
  console.log("API Key is set. Length:", apiKey.length);
}

test();

