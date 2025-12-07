const { GoogleGenerativeAI } = require("@google/generative-ai");

// Дані про фільми та мультфільми
const movies = require("../src/data/movies.json");
const films = require("../src/data/films.json");

// Формування контексту про контент сайту
function buildMovieContext() {
  const allContent = [...movies, ...films];
  
  const lines = allContent.map((item) => {
    const type = item.type || "мультфільм";
    const director = item.director || "невідомо";
    const year = item.year || "н/д";
    const title = item.title;
    const titleOriginal = item.titleOriginal || "";
    const description = item.description || "";
    
    return `• ${title} (${titleOriginal}) — ${type}, ${year}, реж. ${director}. ${description.slice(0, 120)}${description.length > 120 ? "..." : ""}`;
  });
  
  return lines.join("\n");
}

// Системний промпт для моделі
function getSystemPrompt(movieContext) {
  return `Ти — помічник на сайті з фільмами та мультфільмами для Соні. 

ВАЖЛИВО:
- Відповідай ТІЛЬКИ українською мовою.
- Відповідай ДУЖЕ коротко: 1-3 речення максимум.
- НЕ задавай зустрічних запитань.
- НЕ веди діалог, просто відповідай на одне питання.
- Якщо питання не стосується фільмів/мультфільмів з цього списку — скажи, що не маєш інформації.
- Якщо фільму/мультфільму немає в списку — чесно скажи, що його немає на сайті.

Ось список доступного контенту на сайті:

${movieContext}

Відповідай лаконічно і по суті.`;
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question } = req.body;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return res.status(400).json({ error: "Питання обов'язкове" });
  }

  if (question.length > 500) {
    return res.status(400).json({ error: "Питання занадто довге (макс. 500 символів)" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("GEMINI_API_KEY not configured");
    return res.status(500).json({ error: "API не налаштовано" });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.7,
      }
    });

    const movieContext = buildMovieContext();
    const systemPrompt = getSystemPrompt(movieContext);

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt + "\n\nПитання користувача: " + question.trim() }
          ]
        }
      ]
    });

    const response = result.response;
    const text = response.text();

    return res.status(200).json({ answer: text });
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(500).json({ error: "Не вдалося отримати відповідь" });
  }
};

