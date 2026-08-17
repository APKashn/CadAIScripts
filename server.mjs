import "dotenv/config";
import express from "express";
import Groq from "groq-sdk";

const app = express();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.use(express.json({ limit: "15mb" }));

app.post("/api/model-overview", async (req, res) => {
  const { screenshot, modelInfo } = req.body;

  if (!screenshot || !modelInfo) {
    return res.status(400).json({
      error: "Screenshot or model information is missing.",
    });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Give a concise overview of this uploaded STL model.

Model data:
${JSON.stringify(modelInfo, null, 2)}

Explain:
- likely object purpose, if recognizable
- visible shape and main features
- obvious 3D-printing considerations
- what cannot be determined from this view

Do not invent details. STL files do not contain unit information.`,
            },
            {
              type: "image_url",
              image_url: {
                url: screenshot,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 700,
    });

    res.json({
      overview: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("Groq error:", error);

    res.status(500).json({
      error: "AI analysis failed. Check the terminal for details.",
    });
  }
});

app.listen(3001, () => {
  console.log("Groq server running at http://localhost:3001");
});