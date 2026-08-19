import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Increase payload limit to handle base64 image streams
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

app.post("/api/model-overview", async (req, res) => {
  try {
    const { screenshot, modelInfo, userPrompt } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY is missing on the server environment." });
    }

    if (!screenshot) {
      return res.status(400).json({ error: "No screenshot data provided." });
    }

    const { width, height, depth } = modelInfo.dimensions;
    const widthInches = (width / 25.4).toFixed(2);
    const heightInches = (height / 25.4).toFixed(2);
    const depthInches = (depth / 25.4).toFixed(2);

    const systemPrompt = `You are a world-class additive manufacturing expert and mechanical design engineer conducting a visual CAD audit and printability check for a teammate.

Part Metrics:
- Dimensions (X x Y x Z): ${width}mm x ${height}mm x ${depth}mm (${widthInches}" x ${heightInches}" x ${depthInches}")
- Detail Level: ${modelInfo.triangles.toLocaleString()} triangles
${userPrompt ? `- Teammate Note: "${userPrompt}"` : ""}

Deliver a concise, expert review (250–300 words) written in a warm, direct, first-person voice ("Looking at this...", "I noticed..."). Speak like a knowledgeable colleague—no rigid, robotic section titles or generic boilerplate.

Perform a thorough visual & structural sweep covering:

1. Identification & Positives:
   - Make a solid, educated guess on what the part is or how it functions based on the render and dimensions. Highlight one clean design feature done well.

2. Manufacturability & Failure Prevention:
   - Embossed/Engraved Detail & Text: Check if fine details, logos, or text risk blurring or failing to resolve based on standard 0.4mm nozzle limits.
   - Geometry & Wall Thickness: Flag thin walls, narrow pins, or sharp inner corners that could snap or delaminate under stress.
   - Print Orientation & Supports: Identify steep overhangs (>45°), bridging, or isolated features needing supports. Recommend the optimal bed orientation to minimize supports and maximize layer strength.

3. Slicer Settings:
   - Provide exact slicer parameters: Infill pattern (e.g., Gyroid) and percentage (e.g., 15-20%), wall loop count, and layer height recommendation.

Wrap up with an encouraging, confident sign-off! Keep the formatting clean using natural paragraphs and simple bolding for key specs—no heavy bullet dumps or manual-style headers.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen/qwen3.6-27b",
        reasoning_effort: "none",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              {
                type: "image_url",
                image_url: { url: screenshot }
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq Vision API Error:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Groq API request failed."
      });
    }

    const overview = data.choices?.[0]?.message?.content || "No review output generated.";
    res.json({ overview });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});