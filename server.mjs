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
- Max Aspect Ratio: ${ratio}:1
- Geometry Detail: ${modelInfo.triangles.toLocaleString()} triangles (${modelInfo.vertices.toLocaleString()} vertices)

Review this part casually, naturally, be informitive, and constructively like an engineer speaking to someone who needs some help.
1. Speak in first-person ("Looking at this...", "My first thought...", "I'd watch out for...").
2. Don't use dry manual-style headers or robotic lists. Use short, conversational paragraphs or quick bullet points.
3. Call out practical considerations (scale relative to a standard print bed, layer orientation for strength, wall loops/infill), and 
specify print settings like infil. Tell the user exactly what infill and the exact percent and give a list of other print settings depending on the usecase. More strength needed more a robotic part ect..
4. Keep total output under 180 words.
5. Compliment the user on what's done well in the model.
6. Tell the user what their next steps should be.
7. Provide a friendly and polite ending to motivate the user into continuing with using the product.`;

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