import { MCQResponse } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const PROMPT_TEMPLATE = `
You are an expert exam paper setter and subject specialist.
Your task is to generate exactly 10 high-quality Multiple Choice Questions (MCQs) based ONLY on the provided content.

Requirements:
1. Generate exactly 10 MCQs.
2. Each question must have 4 options (A, B, C, D).
3. Provide a detailed explanation for the correct answer.
4. Provide a short explanation for why each incorrect option is wrong.
5. If the content is insufficient to generate 10 questions, generate as many as possible (up to 10).
6. Do not include any introductory or concluding text, only the JSON.
`;

export async function generateMCQs(text: string): Promise<MCQResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        text: `${PROMPT_TEMPLATE}\n\nCONTENT:\n${text}`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mcqs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.OBJECT,
                  properties: {
                    A: { type: Type.STRING },
                    B: { type: Type.STRING },
                    C: { type: Type.STRING },
                    D: { type: Type.STRING },
                  },
                  required: ["A", "B", "C", "D"]
                },
                correct_answer: { 
                  type: Type.STRING,
                  description: "Must be one of: A, B, C, D"
                },
                explanation_correct: { type: Type.STRING },
                explanation_incorrect: {
                  type: Type.OBJECT,
                  properties: {
                    A: { type: Type.STRING },
                    B: { type: Type.STRING },
                    C: { type: Type.STRING },
                    D: { type: Type.STRING },
                  },
                  required: ["A", "B", "C", "D"]
                }
              },
              required: ["question", "options", "correct_answer", "explanation_correct", "explanation_incorrect"]
            }
          }
        },
        required: ["mcqs"]
      }
    }
  });

  try {
    const textResponse = response.text || "{}";
    const result = JSON.parse(textResponse.trim());
    
    if (!result.mcqs || !Array.isArray(result.mcqs) || result.mcqs.length === 0) {
      throw new Error("The AI was unable to generate questions from this content. Try a longer or more detailed document.");
    }

    return result as MCQResponse;
  } catch (error: any) {
    console.error("Gemini generation error:", error);
    if (error.message.includes("Unexpected token")) {
      throw new Error("The AI returned an invalid format. Please try again.");
    }
    throw error;
  }
}

export async function extractTextFromImage(base64Image: string, mimeType: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Image.split(",")[1],
              mimeType: mimeType
            }
          },
          {
            text: "Extract all text from this image accurately. Maintain the structure where possible."
          }
        ]
      }
    ]
  });

  return response.text || "";
}
