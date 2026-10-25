const http = require("http");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const PORT = 3000;

const SYSTEM_PROMPT = `
You are Bhasha Doubt Solver, an interactive AI tutor.

Your goal is to help students understand concepts and identify
misconceptions instead of immediately giving final answers.

1. Ask students to explain their reasoning.
2. Identify conceptual mistakes in their explanations.
3. Give simple hints and examples.
4. Ask follow-up questions to check understanding.
5. Be patient, encouraging, and supportive.
6. Use simple English. Support Indian languages when requested.
7. Adapt explanations to the student's previous mistakes.
`;

const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
        const filePath = path.join(
            __dirname,
            "public",
            "index.html"
        );

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end(
                    "Cannot find public/index.html. Please create it."
                );
            }

            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8"
            });

            res.end(data);
        });

        return;
    }

    if (req.method === "POST" && req.url === "/chat") {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", async () => {
            try {
                const { message, history = [] } = JSON.parse(body);

                if (!message || typeof message !== "string") {
                    res.writeHead(400, {
                        "Content-Type": "application/json"
                    });

                    return res.end(JSON.stringify({
                        error: "Please enter a message."
                    }));
                }

                if (!process.env.SARVAM_API_KEY) {
                    throw new Error(
                        "API key missing. Check your .env file."
                    );
                }

                const messages = [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT
                    },
                    ...history.slice(-10),
                    {
                        role: "user",
                        content: message
                    }
                ];

                const apiResponse = await fetch(
                    "https://api.sarvam.ai/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "api-subscription-key":
                                process.env.SARVAM_API_KEY
                        },
                        body: JSON.stringify({
                            model: "sarvam-105b",
                            messages,
                            reasoning_effort: null,
                            max_tokens: 700
                        })
                    }
                );

                const data = await apiResponse.json();

                if (!apiResponse.ok) {
                    console.error("Sarvam API error:", data);

                    throw new Error(
                        data.error?.message ||
                        `Sarvam API error: ${apiResponse.status}`
                    );
                }

                const reply =
                    data.choices?.[0]?.message?.content;

                if (!reply) {
                    throw new Error(
                        "The model returned no visible answer."
                    );
                }

                res.writeHead(200, {
                    "Content-Type": "application/json"
                });

                res.end(JSON.stringify({ reply }));

            } catch (error) {
                console.error(error.message);

                res.writeHead(500, {
                    "Content-Type": "application/json"
                });

                res.end(JSON.stringify({
                    error: error.message
                }));
            }
        });

        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

server.listen(PORT, () => {
    console.log(
        `Bhasha Doubt Solver is running at http://localhost:${PORT}`
    );
});