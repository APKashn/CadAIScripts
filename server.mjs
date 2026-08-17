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
      return res.status(500).json({
        error: "GROQ_API_KEY is missing. Please set it in your .env file."
      });
    }

    if (!modelInfo || !modelInfo.dimensions) {
      return res.status(400).json({
        error: "Invalid or missing modelInfo payload."
      });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "user",
            content: `Analyze this 3D STL model based on its geometric metadata:
- Dimensions (X x Y x Z): ${modelInfo.dimensions.width}mm x ${modelInfo.dimensions.height}mm x ${modelInfo.dimensions.depth}mm
- Vertices: ${modelInfo.vertices}
- Triangles: ${modelInfo.triangles}

Provide a concise technical breakdown:
1. Bounding Box & Envelope Assessment
2. Structural/Mesh Resolution Density
3. 3D Printing Recommendations (orientation, potential overhangs, print bed sizing)`
          }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Groq API request failed."
      });
    }

    const overview = data.choices?.[0]?.message?.content || "No overview generated.";
    res.json({ overview });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});