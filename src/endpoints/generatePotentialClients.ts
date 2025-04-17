import { OpenAPIRoute } from "chanfana";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Define the input schema using zod
const RequestBodySchema = z.object({
  businessDescription: z.string().openapi({
    description: "A description of the user's business.",
    example: "We are a software development agency specializing in building web applications for startups.",
  }),
});

// Define the NEW output schema based on Google Places API response with field mask
// const PlaceSchema = z.object({
//     displayName: z.object({ text: z.string(), languageCode: z.string() }).optional(),
//     formattedAddress: z.string().optional(),
//     priceLevel: z.string().optional(), // e.g., "PRICE_LEVEL_MODERATE"
//     phoneNumber: z.string().optional(),
// }).openapi('Place');

// const ResponseSchema = z.object({
//   places: z.array(PlaceSchema).optional(), // Places API returns an array of places
// }).openapi('PlacesResponse');

export class GeneratePotentialClients extends OpenAPIRoute {
  schema = {
    tags: ["AI", "Places"], // Added Places tag
    summary: "Generate client keywords & find Google Places results for the first keyword", // Updated summary
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
        description: "Returns Google Places API search results for the first potential client keyword generated by AI", // Updated description
        content: {
          "application/json": {
            schema: z.any(), // Use the NEW response schema
          },
        },
      },
      "500": {
        description: "Internal Server Error (API key issues, AI error, Places API error, etc.)", // Updated description
        content: {
            "application/json": {
                schema: z.object({ error: z.string() })
            }
        }
      },
       "404": { // Added case where no keywords are generated
         description: "No valid keywords generated by AI",
         content: {
            "application/json": {
                schema: z.object({ error: z.string() })
            }
         }
      }
    },
  };

  async handle(c) {
    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();
    const { businessDescription } = data.body;
    
    // Access API Keys from environment variables 
    // const geminiApiKey = c.env?.GOOGLE_AI_API_KEY;
    const geminiApiKey = "AIzaSyB7XxW-Id5JLdFYd4NfZjOZ-jZj04QGaus";
    // const placesApiKey = c.env?.GOOGLE_PLACES_API_KEY; // New key needed
    const placesApiKey = "AIzaSyDjulqv2NP3-KxRtO7mdtsDbZaw3Lfywis"; // New key needed

    if (!geminiApiKey) {
       c.status(500);
       return c.json({ error: "API key for Google AI not configured." });
    }
     if (!placesApiKey) {
       c.status(500);
       return c.json({ error: "API key for Google Places not configured." });
    }

    let keywords = [];
    let firstKeyword = "";

    // --- Step 1: Call Gemini API --- 
    try {
      const ai = new GoogleGenAI({apiKey: geminiApiKey}); // Use correct key variable
      const modelName = "gemini-2.0-flash"; 

      const fullPrompt = `System Instruction: you will generate search keywords for potential b2b clients. the user will tell you about their business, you need to analyze who are their potential clients. output your keywords (potential clients) as if you will search it on google maps. DO NOT add anything else, just show the keywords. Format it as a list of keywords, one per line.\n\nUser Business Description: ${businessDescription}`;

      const userMessagePart = {
        role: "user",
        parts: [{ text: fullPrompt }]
      }

      const geminiResponse = await ai.models.generateContent({
        model: modelName,
        contents: [userMessagePart],
      });

      const geminiText = geminiResponse.text;

      // Parse the response and get the first keyword
     keywords = geminiText.split('\n').map(k => k.trim()).filter(k => k.length > 0);
      if (keywords.length === 0) {
           c.status(404); // Use 404 Not Found, or maybe 400 Bad Request?
           return c.json({ error: "AI did not generate any valid keywords." });
      }
      firstKeyword = keywords[0];

    } catch (error) {
      console.error("Error calling Gemini API:", error);
       c.status(500);
      return c.json({ error: "Failed to generate keywords from AI model." });
    }

    // --- Step 2: Call Google Places API --- 
    try {
        const placesUrl = 'https://places.googleapis.com/v1/places:searchText';
        const placesResponse = await fetch(placesUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': placesApiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.priceLevel,places.internationalPhoneNumber,places.userRatingCount'
            },
            body: JSON.stringify({ textQuery: firstKeyword })
        });

        if (!placesResponse.ok) {
            const errorBody = await placesResponse.text();
            console.error(`Places API Error (${placesResponse.status}): ${errorBody}`);
            c.status(500);
            return c.json({ error: `Failed to fetch data from Google Places API. Status: ${placesResponse.status}` });
        }

        const placesData = {
            places: await placesResponse.json(),
            keywords: keywords
        };
        
        // Return the data matching the new ResponseSchema
        return placesData; // Return the whole response from Places API

    } catch (error) {
        console.error("Error calling Google Places API:", error);
        c.status(500);
        return c.json({ error: "Failed to process request to Google Places API." });
    }
  }
} 