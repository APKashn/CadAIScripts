import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/model-overview", async (req, res) => {
  try {
    const { modelInfo } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY is missing from .env file." });
    }

    if (!modelInfo || !modelInfo.dimensions) {
      return res.status(400).json({ error: "Invalid modelInfo payload." });
    }

    const { width, height, depth } = modelInfo.dimensions;
    const maxDim = Math.max(width, height, depth);
    const minDim = Math.min(width, height, depth);
    const ratio = (maxDim / (minDim || 1)).toFixed(1);

    const prompt = `You are a senior mechanical design engineer doing a quick CAD review for a teammate.

Mesh Data:
- Dimensions (X x Y x Z): ${width}mm x ${height}mm x${depth}mm  also give the dimensions in INCHES as a secondary measurement.
- Geometry Detail: ${modelInfo.triangles.toLocaleString()} triangles (${modelInfo.vertices.toLocaleString()} vertices)

Review this part casually, naturally, be very informative, and constructively like an engineer speaking to someone who needs some help. Your response should give someone full confidence in printing their model.
1. Speak in first-person ("Looking at this...", "My first thought...", "I'd watch out for..."). Take a guess on what it is or would be used for(look very carefully and try to be very accurate on your guess), and give instructions based on that. Don't only base it on your guess though, give other options as well.
2. Don't use dry manual-style headers or robotic lists. Use short, conversational paragraphs or quick bullet points. Talk exactly like a human and make the user feel good.
3. Call out practical considerations (scale relative to a standard print bed, layer orientation for strength, wall loops/infill), and 
specify print settings like infill. Tell the user exactly what infill type and the exact percent and give a list of other print settings depending on the usecase. More strength needed more a robotic part ect..
4. Keep total output under 210 words.
5. Compliment the user on what's done well in the model.
6. Tell the user what their next steps should be and if supports are neccessary for printing the model, also mention if print orientation can be changed to omit the need for supports and you must tell the optimal settings to reduce filament use and keep a strong product.
7. Provide a friendly and polite ending to motivate the user into continuing with using the product, motivate them into slicing the model and printing it`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.65,
        top_p: 0.95
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Groq API request failed."
      });
    }

    const overview = data.choices?.[0]?.message?.content || "No review generated.";
    res.json({ overview });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});