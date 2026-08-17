import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Essential: Allow large payloads because base64 screenshots can be several megabytes
app.use(express.json({ limit: "10mb" }));

// Serve static frontend files (HTML, main.js, CSS, etc.)
app.use(express.static(__dirname));

// Backend route handling POST requests from analyzeButton
app.post("/api/model-overview", async (req, res) => {
  try {
    const { screenshot, modelInfo } = req.body;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY is not set in environment variables." });
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this 3D STL model. Dimensions: ${modelInfo.dimensions.width}x${modelInfo.dimensions.height}x${modelInfo.dimensions.depth}. Vertices: ${modelInfo.vertices}, Triangles: ${modelInfo.triangles}. Provide a concise structural summary and functional overview.`
              },
              {
                type: "image_url",
                image_url: {
                  url: screenshot
                }
              }
            ]
          }
        ],
        temperature: 0.2
      })
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      return res.status(groqResponse.status).json({
        error: data.error?.message || "Groq API request failed."
      });
    }

    const overview = data.choices?.[0]?.message?.content || "No analysis generated.";
    res.json({ overview });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});