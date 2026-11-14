// Entry point serverless untuk Vercel.
// Semua request di-rewrite ke /api/index (lihat vercel.json),
// lalu diteruskan ke Express app di src/index.ts.
import app from "../src/index";

export default app;
