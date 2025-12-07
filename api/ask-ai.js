const path = require("path");
const fs = require("fs");

// Перевірка доступності fetch
if (typeof fetch === 'undefined') {
  console.error("Fetch is not available, this might be an issue");
}

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
    const title = item.title;
    const titleOriginal = item.titleOriginal || "";
    
    if (titleOriginal) {
      return `${title} (${titleOriginal})`;
    } else {
      return title;
    }
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
- НЕ веди діалог, просто відповідай на питання користувача.
- Якщо питання не стосується фільмів/мультфільмів з цього списку — дай коротку відповідь на запитання користувача і нагадай, що ти тут щоб допомогти знайти або обрати фільм зі списку на сайті. Намагайся не давати занадто довгих відповідей.
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
    
    // Логування розміру контексту
    const contextSize = systemPrompt.length;
    console.log("Context size:", contextSize, "characters");
    
    if (contextSize > 100000) {
      console.warn("Context is very large, might cause issues");
    }

    const requestBody = {
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
    };
    
    console.log("Sending request to OpenAI:", {
      model: requestBody.model,
      systemPromptLength: systemPrompt.length,
      questionLength: question.trim().length,
      messagesCount: requestBody.messages.length
    });
    
    let response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);
      throw new Error("Помилка з'єднання з API: " + fetchError.message);
    }
    
    console.log("Response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("OpenAI API error response:", errorData);
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${errorText}`);
    }

    let data;
    try {
      const responseText = await response.text();
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse response:", parseError);
      throw new Error("Помилка парсингу відповіді від API");
    }
    
    // Логування для діагностики
    console.log("OpenAI response structure:", {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      firstChoice: data.choices?.[0] ? {
        hasMessage: !!data.choices[0].message,
        hasContent: !!data.choices[0].message?.content,
        contentLength: data.choices[0].message?.content?.length,
        contentPreview: data.choices[0].message?.content?.substring(0, 50) || "empty"
      } : null,
      fullResponseKeys: Object.keys(data)
    });
    
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error("No choices in response:", data);
      return res.status(500).json({ 
        error: "Не вдалося отримати відповідь",
        details: "API повернув неочікувану структуру відповіді"
      });
    }
    
    let answer = data.choices[0]?.message?.content?.trim();
    
    if (!answer || answer.length === 0) {
      console.error("Empty answer in response:", data);
      return res.status(500).json({ 
        error: "Не вдалося отримати відповідь",
        details: "Модель повернула порожню відповідь"
      });
    }
    
    // Перевірка на занадто короткі або некорисні відповіді
    if (answer.length < 3) {
      console.error("Answer too short:", answer);
      return res.status(500).json({ 
        error: "Не вдалося отримати відповідь",
        details: "Модель повернула занадто коротку відповідь"
      });
    }

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("OpenAI API error:", error.message || error);
    return res.status(500).json({ 
      error: "Не вдалося отримати відповідь",
      details: error.message || String(error)
    });
  }
};
