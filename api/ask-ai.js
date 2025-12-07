const path = require("path");
const fs = require("fs");

// Завантаження даних про фільми
function loadData() {
  try {
    const moviesPath = path.join(process.cwd(), "src/data/movies.json");
    const filmsPath = path.join(process.cwd(), "src/data/films.json");
    
    console.log("Loading movies from:", moviesPath);
    console.log("Loading films from:", filmsPath);
    
    const movies = JSON.parse(fs.readFileSync(moviesPath, "utf8"));
    const films = JSON.parse(fs.readFileSync(filmsPath, "utf8"));
    
    console.log("Loaded", movies.length, "movies and", films.length, "films");
    
    return [...movies, ...films];
  } catch (error) {
    console.error("Error loading data:", error.message);
    throw new Error("Не вдалося завантажити дані: " + error.message);
  }
}

// Формування контексту про контент сайту
function buildMovieContext(allContent) {
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
- Якщо питання не стосується фільмів/мультфільмів з цього списку — дай коротку відповідь і нагадай, що ти тут щоб допомогти знайти або обрати фільм зі списку на сайті. Намагайся не давати занадто довгих відповідей.
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

  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error("OPENAI_API_KEY not configured");
    return res.status(500).json({ error: "API не налаштовано" });
  }

  try {
    const allContent = loadData();
    const movieContext = buildMovieContext(allContent);
    const systemPrompt = getSystemPrompt(movieContext);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: question.trim()
          }
        ],
        max_completion_tokens: 256
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices[0]?.message?.content || "Не вдалося отримати відповідь";

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("OpenAI API error:", error.message || error);
    return res.status(500).json({ 
      error: "Не вдалося отримати відповідь",
      details: error.message || String(error)
    });
  }
};
