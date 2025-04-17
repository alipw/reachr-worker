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
const SuccessResponseSchema = z
  .object({
    status: z.string().openapi({ example: "ok" }),
  })
  .openapi("ValidationSuccess");

// Output schema for suggestions (400 Bad Request)
const SuggestionResponseSchema = z
  .object({
    suggestion: z.string().openapi({
      example:
        "Consider highlighting your unique design process or speed of delivery.",
    }),
  })
  .openapi("ValidationSuggestion");

// --- OpenAPI Route ---

export class GenerateMarketingStrategy extends OpenAPIRoute {
  schema = {
    tags: ["AI", "Strategy"],
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
        description:
          "Business description needs improvement; suggestion provided.",
        content: {
          "application/json": {
            schema: SuggestionResponseSchema,
          },
        },
      },
      "500": {
        description:
          "Internal Server Error (API key issue, AI model error, etc.)",
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
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
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const modelName = "gemini-2.0-flash"; // Or use the model you prefer

      // The specific system prompt for validation
      const systemPrompt = `You're an expert in marketing, and now work as a marketing consultant to help business to reach their potential client online via chat in whatsapp. 

You know it well, in order to bring customer and to make customer to use a product or service, you need to clasify the customer using customer funneling that devided by 5 segment (awareness, consideration, conversion, loyalty, and advocacy). In this situation, i need you to focus only to the top 3 (awareness, consideration, and conversion).

Utilizing Rule of 7 that teach us, in order to get people to use a product or service, you need them to see the product or service at least 7 times, before they decide to use or buy a produc or service. 

Now based on these strategy, help me to generate 7 message (awareness, interest, consideration, re-education, study case, reminder, and engagement). These message i need you to make it not really long, but not really short, interesting, and make people want to read til the end, so please don't be to formal. Please do not put any place holder to hold an actual information. i need you to focus on the data that present to you.

For the output, just show me the result, following this structure and only this structure. Do not add anything else to the result that not follow the structure:
Message 1: \`the message\`
Message 2: \`the message\`
Message 3: \`the message\`
Message 4: \`the message\`
Message 5: \`the message\`
Message 6: \`the message\`
Message 7: \`the message\``;

      const fullPrompt = `System Instruction: ${systemPrompt}\n\nBusiness Description (Make the result language is align with the next language that use to describe business description): ${businessDescription}`;

      const userMessagePart = {
        role: "user",
        parts: [{ text: fullPrompt }],
      };

      // Using the same generateContent structure
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [userMessagePart],
      });

      const responseText = response.text.trim(); // Trim whitespace

      const messages = responseText.match(/Message \d:.*?(?=Message \d:|$)/gs);

      const firstThreeMessages = messages
        .slice(0, 7)
        .map((msg) => msg.replace(/^Message \d:\s*/, "").trim());

      return { firstThreeMessages, responseText };
    } catch (error) {
      console.error("Error calling Gemini API for validation:", error);
      c.status(500);
      return c.json({
        error: "Failed to validate business description using AI model.",
      });
    }
  }
}
