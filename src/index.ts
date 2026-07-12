import { createApp } from "./app.js";
import { settings } from "./config/settings.js";

// Server entrypoint — app construction lives in app.ts so it can be imported by
// tests without starting a listener. PORT is validated/defaulted in settings.
const app = createApp();

app.listen(settings.PORT, () => {
  console.log(`✅ Server running on http://localhost:${settings.PORT}`);
});
