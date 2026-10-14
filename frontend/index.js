
const express = require("express")
require("dotenv").config()

const app = express()
app.use(express.urlencoded({ extended: false }))

const port = process.env.PORT || 3000
const backendUrl = process.env.BACKEND_URL || "http://localhost:5500"

// Prevent HTML/JavaScript injection
const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c])

const page = (body) => `
  <html>
    <head><meta charset="utf-8"><title>Three-Stackerino</title></head>
    <body style="font-family: sans-serif; max-width: 640px; margin: 40px auto;">
      ${body}
      <p><small>Backend URL in use: <code>${escape(backendUrl)}</code></small></p>
    </body>
  </html>
`

// GET / - Display messages and statistics
app.get("/", async (req, res) => {
  let response
  let stats

  try {
    // Get messages from backend
    response = await fetch(`${backendUrl}/api/messages`)

    // Get message count from backend
    const statsResponse = await fetch(`${backendUrl}/api/stats`)

    if (!statsResponse.ok) {
      throw new Error(`Stats API returned ${statsResponse.status}`)
    }

    stats = await statsResponse.json()

  } catch (err) {
    console.error(`Could not reach the backend at ${backendUrl}:`, err.message)
    return res.status(502).send(page(`
      <h1>😢 The frontend is up, but the backend is not responding</h1>
      <p>I tried to call the backend and failed.</p>
      <p>Error: <code>${escape(err.message)}</code></p>
      <p>Check: is the backend running? Is BACKEND_URL correct?</p>
    `))
  }

  const data = await response.json()

  if (!response.ok) {
    console.error(`The backend answered ${response.status}:`, data.detail)
    return res.status(502).send(page(`
      <h1>🟠 The backend responds, but the database does not</h1>
      <p>Frontend ✅ → Backend ✅ → Database ❌</p>
      <p>Error: <code>${escape(data.detail || data.error)}</code></p>
      <p>Check: is PostgreSQL running? Are the backend's DB_* variables correct?</p>
    `))
  }

  const list = data.messages
    .map((m) => `<li><b>${escape(m.author)}</b>: ${escape(m.text)} <small>(${m.created_at})</small></li>`)
    .join("")

  res.send(page(`
    <h1>🖥️ Three-Stackerino Message Board</h1>
    <p>Frontend ✅ → Backend ✅ → Database ✅</p>

    <h2>Total messages: ${escape(stats.total_messages)}</h2>

    <form method="POST" action="/messages" style="background: #eef; padding: 16px; border-radius: 8px;">
      <input name="author" placeholder="Your name" maxlength="50" required>
      <input name="text" placeholder="Write a message" maxlength="280" required size="35">
      <button>Post</button>
    </form>

    <ul>${list || "<li>No messages yet.</li>"}</ul>

    <p>Answered by backend number <b>${escape(data.backend_number)}</b>
       (hostname <code>${escape(data.backend_hostname)}</code>)</p>
  `))
})

// POST /messages - Send a message to the backend
app.post("/messages", async (req, res) => {
  try {
    const response = await fetch(`${backendUrl}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: req.body.author,
        text: req.body.text
      }),
    })

    if (!response.ok) {
      console.error(`The backend rejected the message (${response.status}):`, await response.text())
    }

  } catch (err) {
    console.error(`Could not reach the backend at ${backendUrl}:`, err.message)
  }

  res.redirect("/")
})

// Healthcheck
app.get("/healthcheck", (req, res) => {
  res.status(200).send("The frontend works!")
})

const server = app.listen(port, () => {
  console.log(`Frontend listening on http://localhost:${port}`)
  console.log(`The frontend will call the backend at ${backendUrl}`)
})

process.on("SIGTERM", () => server.close(() => process.exit(0)))
process.on("SIGINT", () => server.close(() => process.exit(0)))