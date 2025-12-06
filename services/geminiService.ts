import { GoogleGenAI, Modality } from "@google/genai";

interface TTSRequest {
  text: string;
  voiceId: string;
  speed: number;
  pitch: number;
  isSSML: boolean;
}

export async function generateSpeech({ text, voiceId, speed, pitch, isSSML }: TTSRequest): Promise<string> {
  // Assume API_KEY is set in the environment
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let prompt = text;
  if (!isSSML) {
    // Convert speed (1.0) to rate percentage (100%) and pitch (-12 to 12) to semitones string ("-2st")
    const rate = Math.round(speed * 100);
    const pitchStr = `${pitch >= 0 ? '+' : ''}${pitch}st`;
    // Wrap plain text in SSML to apply speed and pitch
    prompt = `<speak><prosody rate="${rate}%" pitch="${pitchStr}">${text}</prosody></speak>`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceId },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("No audio data received from the API.");
    }
    
    return base64Audio;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate speech from Gemini API.");
  }
}
