import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import axios from "axios";

// --- Schemas ---

const RequestBodySchema = z.object({
  data: z.array(
    z.object({
      phoneNumber: z.string().openapi({
        description: "Recipient's phone number.",
        example: "+1234567890",
      }),
      message: z.string().openapi({
        description: "Message to send.",
        example: "Hello, this is a test message.",
      }),
    })
  ),
});

const SuccessResponseSchema = z
  .object({
    status: z.string().openapi({ example: "ok" }),
  })
  .openapi("ValidationSuccess");

const ErrorResponseSchema = z.object({
  error: z.string(),
});

// --- OpenAPI Route ---

export class SendCampaign extends OpenAPIRoute {
  schema = {
    tags: ["Campaign"],
    summary: "Send a marketing campaign via WhatsApp",
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
        description: "Messages sent successfully.",
        content: {
          "application/json": {
            schema: SuccessResponseSchema,
          },
        },
      },
      "500": {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  };

  async handle(c) {
    const body = await this.getValidatedData<typeof this.schema>();
    const { data: messages } = body.body;

    try {
      // Step 1: Get access token from login API
      // const loginApiUrl = "http://173.249.59.138/api/auth/sign-in";
      // const loginResponse = await axios.post(
      //   loginApiUrl,
      //   {
      //     username: "admin",
      //     password: "String@123",
      //   },
      // );

      // if (
      //   loginResponse.status !== 201 ||
      //   !loginResponse.data?.data?.accessToken
      // ) {
      //   c.status(500);
      //   return c.json({ error: "Failed to authenticate with login API." });
      // }

      const accessToken =
        "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsInJvbGUiOiJDbGluaWMiLCJjbGluaWNJZCI6MSwiaWF0IjoxNzQ0ODg0MjA5LCJleHAiOjE3NDQ5MjAyMDl9.lKxBqwU4CUqKId5etw4QEgdD9igkjWnhIIbDhbl_VAwa8XC75bnW3uzSjbVl0aOBwbEIBUCHyEYgeKTwLY4VmBxZVCnNqoCHh33IwLjCjQ5iFpKuH6jTVdBnxXmgjrRnIu5sWqDlv2v8guOCQWiNsKXJgrx0RaL38ALdStpwn6gze6ix-IuL7Xg8NXzqQFqsAQrf-YdfI5imi-ZDYddiJSYPbTkmI5aRzjH2JXZgTk11dV9uwKOmC97qnwTEmFMD3ko55_sLABRayKcmMwyVyXHVhFQggGl1MJaZhq3AD3QX_lMqNR8keIrvvPd0LbcDI2Jaq2YnuUVgEUM-v4MzwA";

      // Step 2: Send messages via WhatsApp API
      const whatsappApiUrl =
        "http://173.249.59.138/api/whatsapp-web/send-many-message";

      const whatsappResponse = await axios.post(
        whatsappApiUrl,
        { data: messages },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return c.json({
        status: "ok",
        details: messages.map((entry) => ({
          phoneNumber: entry.phoneNumber,
          status: "sent",
        })),
      });
    } catch (error) {
      console.error("Error:", error);
      c.status(500);
      return c.json({ error: "Internal Server Errors: " + error.message });
    }
  }
}
