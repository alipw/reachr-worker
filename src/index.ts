import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList";
import { GeneratePotentialClients } from "./endpoints/generatePotentialClients";
import { ValidateBusinessDescription } from "./endpoints/validateBusinessDescription";

// Start a Hono app
const app = new Hono();
app.use('*', cors());

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/tasks", TaskList);
openapi.post("/api/tasks", TaskCreate);
openapi.get("/api/tasks/:taskSlug", TaskFetch);
openapi.delete("/api/tasks/:taskSlug", TaskDelete);
openapi.post("/api/generate-potential-clients", GeneratePotentialClients);
openapi.post("/api/validate-business-description", ValidateBusinessDescription);

// Export the Hono app
export default app;
