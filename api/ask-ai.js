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
    const title = item.title; // Українська назва (відображається на сайті)
    const titleOriginal = item.titleOriginal || ""; // Оригінальна назва
    
    if (titleOriginal && titleOriginal !== title) {
      return `${title} / ${titleOriginal}`;
    } else {
      return title;
    }
  });
  
  return lines.join("\n");
}

// Системний промпт для моделі
function getSystemPrompt(movieContext) {
  return `Ти — помічник на сайті з фільмами та мультфільмами для Соні. 

Що користувач може робити на сайті:
- Переглядати список мультфільмів та фільмів.
- Дивитися деталі про обраний фільм чи мультфільм.
- Отримувати підказки й коротку інформацію через AI-асистента.
- Відкривати окремі сторінки для серіалів (якщо є).
- Шукати мультфільми й фільми в колекції сайту за допомогою пошуку.


ВАЖЛИВО:
- Відповідай ТІЛЬКИ українською мовою.
- Відповідай коротко: 1-5 речень.
- Це ОДНОРАЗОВИЙ запит — діалог НЕ продовжується після твоєї відповіді.
- НЕ задавай зустрічних запитань.
- НЕ пропонуй продовження діалогу (типу "якщо хочеш", "можу запропонувати", "чи хочеш щось ще").
- Просто дай відповідь на питання і все — без додаткових пропозицій.
- Якщо питання не стосується фільмів/мультфільмів з цього списку — дай коротку відповідь на запитання користувача.
- Якщо фільму/мультфільму немає в списку — чесно скажи його назву і що його немає на сайті і додай "Ти можеш написати Максиму і він додасть його до списку".
- В питаннях стосовно сайту, а конкретно стосовно функціоналу сайту - відповідай тільки на питання на які ти маєш відповідь, в іншому випадку кажи що ти не маєш відповіді на це запитання і пропонуй користувачеві звернутись до Максима.

Ось список доступного контенту на сайті:

${movieContext}

Відповідай без пропозицій продовження.`;
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
      model: "gpt-5-mini",
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
      max_completion_tokens: 2048,
      reasoning_effort: "low",
      stream: true
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

    if (!response.ok || !response.body) {
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

    // Стрімимо відповідь далі клієнту
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of response.body) {
      const text = decoder.decode(chunk);
      buffer += text;

      // OpenAI stream надсилає блоки типу "data: {json}\n\n"
      const parts = buffer.split("\n\n");
      // Останню частину залишаємо в буфері, якщо вона неповна
      buffer = parts.pop() || "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.replace("data:", "").trim();
        if (payload === "[DONE]") {
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(content);
          }
        } catch (err) {
          console.error("Stream parse error:", err);
        }
      }
    }

    res.end();
    return;
  } catch (error) {
    console.error("OpenAI API error:", error.message || error);
    return res.status(500).json({ 
      error: "Не вдалося отримати відповідь",
      details: error.message || String(error)
    });
  }
};
