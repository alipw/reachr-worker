import { OpenAPIRoute } from "chanfana";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// --- Schemas --- 

// Input schema (same as generatePotentialClients)
const RequestBodySchema = z.object({
  businessDescription: z.string().openapi({
    description: "The business description to validate.",
    example: "We build custom websites for local restaurants.",
  }),
});

// Output schema for successful validation (200 OK)
const SuccessResponseSchema = z.object({
    status: z.string().openapi({ example: "ok" })
}).openapi('ValidationSuccess');

// Output schema for suggestions (400 Bad Request)
const SuggestionResponseSchema = z.object({
    suggestion: z.string().openapi({ example: "Consider highlighting your unique design process or speed of delivery." })
}).openapi('ValidationSuggestion');

// --- OpenAPI Route --- 

export class ValidateBusinessDescription extends OpenAPIRoute {
  schema = {
    tags: ["AI", "Validation"],
    summary: "Validate a business description for marketing readiness using AI",
    request: {
      body: {
        content: {
          "application/json": {
            schema: RequestBodySchema,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Business description is deemed sufficient for marketing.",
        content: {
          "application/json": {
            schema: SuccessResponseSchema,
          },
        },
      },
      "400": {
        description: "Business description needs improvement; suggestion provided.",
        content: {
          "application/json": {
            schema: SuggestionResponseSchema,
          },
        },
      },
      "500": {
        description: "Internal Server Error (API key issue, AI model error, etc.)",
        content: {
            "application/json": {
                schema: z.object({ error: z.string() })
            }
        }
      },
    },
  };

  async handle(c) {
    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();
    const { businessDescription } = data.body;
    
    // Access API Key 
    const geminiApiKey = c.env?.GOOGLE_AI_API_KEY;

    if (!geminiApiKey) {
       c.status(500);
       return c.json({ error: "API key for Google AI not configured." });
    }

    // --- Call Gemini API --- 
    try {
      const ai = new GoogleGenAI({apiKey: geminiApiKey});
      const modelName = "gemini-2.0-flash"; // Or use the model you prefer

      // The specific system prompt for validation
      const systemPrompt = "You are a business advisor, you will be given a description of a business. your task is to decide & analyze whether the description is good enough for marketing strategy to be employed. this primarily involves unique selling point. if the description is good enough, you will give a response of \"OK\". if not, then you will give a suggestion on what to add from that description. do not be too critical, if you see anything unique and marketable, then it is good enough. the user will give their business description. do not make the suggestion too long. just give one suggestion. if not ok, do not say anything like \"NOT OK\", just say the suggestion.";

      const fullPrompt = `System Instruction: ${systemPrompt}\n\nBusiness Description: ${businessDescription}`;
      
      const userMessagePart = {
        role: "user",
        parts: [{ text: fullPrompt }] 
      }

      // Using the same generateContent structure
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [userMessagePart],
      });

      const responseText = response.text.trim(); // Trim whitespace

      // --- Process Response --- 
      if (responseText === "OK") {
        // Return 200 OK status
        return { status: "ok" }; 
      } else {
        // Return 400 Bad Request with the suggestion
        c.status(400);
        return { suggestion: responseText }; 
      }

    } catch (error) {
      console.error("Error calling Gemini API for validation:", error);
       c.status(500);
      return c.json({ error: "Failed to validate business description using AI model." });
    }
  }
} 