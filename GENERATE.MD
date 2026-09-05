You are an elite TypeScript architect. Generate a production-ready WhatsApp bot for a village office helpdesk with these hard requirements. Output full project scaffolding and code in one pass, using best practices.

# TECH STACK & RUNTIME
- Node.js LTS (>= 20), TypeScript strict mode.
- WhatsApp client: baileys@latest (multi-device).
- HTTP API: Express.
- ORM: Prisma.
- DB default: PostgreSQL (allow .env to switch to MySQL/SQLite).
- Auth/session: Baileys auth-state stored to ./storage/whatsapp.
- Timezone: Asia/Jakarta (WIB).

# PROJECT GOAL
A WhatsApp chatbot to help villagers with short, clear, accurate answers within a strict domain. The bot must only answer topics below; outside-scope questions receive a polite refusal.

# DOMAIN SCOPE (MUST ENFORCE)
Administrasi Penduduk:
- KTP: Syarat & prosedur pembuatan KTP baru.
- KK: Syarat & prosedur pembuatan/perubahan data/penambahan anggota.
- Surat Pindah: Syarat surat pindah domisili.
- Akta Kelahiran/Kematian: Prosedur & dokumen.

Layanan Sosial:
- Bantuan Sosial (PKH, BPNT) – info cara cek kelayakan dan alur pengajuan ke desa.
- Posyandu: Jadwal, imunisasi, pemeriksaan balita.

Keuangan Desa:
- PBB: Cara cek tagihan & jadwal pembayaran.
- Retribusi Sampah: Jadwal & biaya.

Umum:
- Jam Operasional Kantor Desa: Sen–Jum 08.00–16.00 WIB; Istirahat 12.00–13.00 WIB.
- Kontak Penting: Nomor telepon kantor atau staf (ambil dari DB/ENV).
- Tanggapan di luar topik: “Maaf, pertanyaan Anda di luar lingkup layanan saya. Silakan hubungi kantor desa untuk informasi lebih lanjut.”

# CONVERSATION STYLE
- Bahasa Indonesia.
- Jawaban singkat, jelas, akurat. Maks 2–3 kalimat.
- Jika pertanyaan tidak jelas: minta penjelasan singkat.
- Jangan memberi info di luar scope. Jangan bertele-tele.
- Hindari janji pengerjaan di masa depan.
- Sertakan ajakan ke kantor desa jika perlu dokumen asli.

# BOT FEATURES
1) WhatsApp Listener (Baileys):
   - Auto QR + persisted auth.
   - Auto-reconnect, exponential backoff.
   - Health log saat connection update.
   - Rate limit per sender (mis. 1 pesan/detik, burst 3).
   - Message router by intent.
   - Command prefix opsional ("/help", "/menu").

2) Intent & NLU (rule-first, lightweight):
   - Keyword mapping per topik dengan sinonim umum (e.g., “bikin KTP”, “ktp baru”, “e-KTP”).
   - Fallback classifier sederhana (tf-idf/regex scoring).
   - Strict domain filter: jika confidence < threshold atau topik di luar daftar → balas templat “di luar lingkup”.

3) Response Templates:
   - Templat jawaban ringkas untuk tiap subtopik (lihat “TEMPLATES”).
   - Variasi bahasa singkat agar tidak terasa robotik namun tetap konsisten.

4) Knowledge Config:
   - Sumber jawaban dari tabel `knowledge_items` (slug + content pendek).
   - Admin API untuk update konten operasional (jam kantor, nomor telepon, jadwal posyandu, biaya retribusi, dsb).
   - Versi & audit trail (created_by/updated_by).

5) REST API (Express):
   - Auth: simple API key via header `x-api-key` (configurable).
   - Routes (CRUD minimal, JSON):
     - `POST /api/messages/send` → kirim WA ke nomor tertentu.
     - `GET /api/health` → status koneksi WA + DB + uptime.
     - `GET/PUT /api/config/contact` → nomor telepon desa/staf.
     - `GET/PUT /api/config/hours` → jam operasional.
     - `GET/POST/PUT/DELETE /api/posyandu/schedules` → jadwal posyandu.
     - `GET/POST/PUT/DELETE /api/knowledge` → konten jawaban (KTP, KK, PBB, dsb).
     - `GET /api/logs/messages` → ringkas log (paginated).
   - Validation via zod.
   - Error handler konsisten (problem+json style).

6) Database (Prisma schema):
   - `User` (optional operator/admin).
   - `MessageLog` (id, from, to, text, intent, confidence, reply, timestamp).
   - `KnowledgeItem` (id, slug, title, content, category, updatedAt, updatedBy).
   - `Schedule` (id, type: 'POSYANDU'|'RETRIBUSI'|'PBB', date/time, location/notes).
   - `Config` (key, value JSON) untuk jam operasional, kontak penting, biaya retribusi, dsb.
   - Seed default values untuk jawaban templat.

7) Logging & Observability:
   - Pino logger (JSON), per-request id, request/response time.
   - Structured logs untuk event WA (connection, QR, message, send status).
   - Graceful shutdown (SIGINT/SIGTERM).

8) Security & Hardening:
   - ENV schema validation (zod): DATABASE_URL, API_KEY, NODE_ENV, TZ, PORT.
   - Disable x-powered-by, Helmet basics.
   - CORS configurable (default disabled).
   - Rate limit di API (IP-based).
   - Sanitization input, escape outputs untuk log.

9) Testing:
   - Vitest + supertest untuk API.
   - Unit test intent router.
   - E2E minimal: seed DB → GET/PUT config → kirim pesan simulasi lewat router internal.

10) Dev UX:
   - Scripts: dev (tsx + nodemon), build (tsc), start, test, prisma:generate/migrate/seed.
   - ESLint + Prettier (strict).
   - Dockerfile + docker-compose (Postgres 16).
   - Makefile opsional.

11) Deployment:
   - Single container (node:20-alpine).
   - Volume for `./storage/whatsapp` (persist auth).
   - Healthcheck endpoint `/api/health`.
   - Readiness log.

# FOLDERS
- src/
  - index.ts
  - config/env.ts
  - server/http.ts
  - server/routes/*.ts
  - wa/client.ts
  - wa/router.ts
  - wa/intents.ts
  - wa/templates.ts
  - db/prisma.ts
  - db/repo/*.ts
  - middlewares/*.ts
  - utils/*.ts
- prisma/schema.prisma
- storage/whatsapp (gitignored)
- tests/*

# INTENTS (with examples)
- ADMIN_KTP: (“bagaimana cara bikin ktp”, “syarat e-ktp”, “ktp baru”)
- ADMIN_KK: (“prosedur kk”, “tambah anggota kk”, “ubah data kk”)
- ADMIN_PINDAH: (“surat pindah domisili”, “cara pindah kk/ktp”)
- ADMIN_AKTA: (“akta kelahiran”, “akta kematian”, “syarat akta”)
- SOS_BANSOS: (“bantuan sosial”, “pkh”, “bpnt”, “apakah bisa mengajukan bantuan”)
- POSYANDU: (“jadwal posyandu”, “imunisasi balita”)
- KEUANGAN_PBB: (“cara bayar pbb”, “cek tagihan pbb”)
- KEUANGAN_SAMPAH: (“retribusi sampah”, “jadwal & biaya sampah”)
- UMUM_JAM: (“jam kantor desa”, “buka jam berapa”)
- UMUM_KONTAK: (“nomor telepon desa”, “kontak staf”)
- OUT_OF_SCOPE: default fallback.

# TEMPLATES (examples, keep responses short)
- ADMIN_KTP:
  “Untuk KTP baru, siapkan fotokopi KK & surat pengantar RT/RW, lalu datang ke kantor desa pada jam kerja.”
- ADMIN_KK:
  “Urus KK dengan surat pengantar RT/RW, fotokopi KTP, dan dokumen pendukung (nikah/akta lahir bila perlu).”
- ADMIN_PINDAH:
  “Surat pindah perlu pengantar RT/RW, fotokopi KK & KTP, serta pas foto 3×4.”
- ADMIN_AKTA:
  “Akta kelahiran/kematian: bawa dokumen pendukung (KK, KTP, surat keterangan terkait). Proses di kantor desa.”
- SOS_BANSOS:
  “Info bantuan sosial (PKH/BPNT) silakan datang ke kantor desa atau hubungi staf pelayanan sosial.”
- POSYANDU:
  “Jadwal Posyandu tersedia di kantor desa dan papan informasi. Anda juga bisa cek di sini bila jadwal sudah diinput.”
- KEUANGAN_PBB:
  “PBB bisa dibayar di kantor desa atau bank yang ditunjuk. Tagihan dapat dicek lewat petugas desa.”
- KEUANGAN_SAMPAH:
  “Retribusi sampah: jadwal & biaya ditetapkan desa. Silakan cek di kantor atau tanya petugas.”
- UMUM_JAM:
  “Kantor desa: Sen–Jum 08.00–16.00 WIB, istirahat 12.00–13.00 WIB.”
- UMUM_KONTAK:
  “Nomor telepon kantor desa: {{PHONE}}.”

- OUT_OF_SCOPE:
  “Maaf, pertanyaan Anda di luar lingkup layanan saya. Silakan hubungi kantor desa untuk info lebih lanjut.”

# .ENV required
- DATABASE_URL=postgresql://user:password@localhost:5432/dbname
- API_KEY=change-me
- TZ=Asia/Jakarta
- PORT=3000
- DESA_PHONE=08xxxxxxxxxx

# IMPLEMENTATION DETAILS (CODE REQUIREMENTS)
- Create baileys client with proper event handlers (messages.upsert, connection.update).
- Implement rate limiter per JID.
- Implement `class IntentRouter`:
  - `classify(text): { intent, confidence }` using rule sets & regex synonyms.
  - `reply(intent, ctx): string` pulling from KnowledgeItem or default templates.
- Message flow:
  - Normalize text → classify → if in-scope & confidence>=0.6 → reply template.
  - Else ask clarification if ambiguous, or OUT_OF_SCOPE template.
  - Log every interaction to `MessageLog`.
- Express API with routes listed above, all protected by `x-api-key` middleware (except `/api/health`).
- Prisma schema matching the above, with seed script to preload templates and config.
- Provide example curl requests in README for:
  - Update jam operasional.
  - Update nomor telepon desa.
  - Tambah jadwal posyandu.
  - Kirim pesan WA melalui API (`/api/messages/send`).
- Include Dockerfile and docker-compose.yml for Node + Postgres.
- Include tests for:
  - Intent classification samples.
  - API config read/write.
  - Router response selection.

# DELIVERABLES
- Full source files with correct imports and working build.
- README.md with setup steps:
  1) npm i
  2) npx prisma generate && npx prisma migrate dev && npx prisma db seed
  3) npm run dev
  4) Scan QR di terminal untuk login WA
- Example data & how to extend knowledge items safely.
- Clear instructions to change DB to MySQL/SQLite if needed.

# ACCEPTANCE CRITERIA
- `npm run dev` boots Express + Baileys without crashes.
- `/api/health` returns WA connection state and DB status.
- Sending a WA message from another phone receives correct, concise reply for in-scope intents.
- Out-of-scope queries receive the refusal template.
- Admin can update jam operasional & nomor telepon via API and bot uses latest values.
- All code compiles with TypeScript strict, ESLint passes, tests green.

Generate now.
