import { createApp } from "./app.js";

// Server entrypoint — app construction lives in app.ts so it can be imported by
// tests without starting a listener.
const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
