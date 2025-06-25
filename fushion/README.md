# Fushion

This folder merges the backend features of **my-app-5** with the Tailwind based
UI from **talking-bubble-verse-main-3**.

- All UI components come from the talking‑bubble project.
- Set `NEXT_PUBLIC_API` (or `VITE_API_BASE`) to override the backend URL.

## Running the project

1. Create a `.env` file with your OpenAI API key

   ```bash
   echo "OPENAI_API_KEY=your-key" > .env
   ```

2. Start the FastAPI backend

   ```bash
   cd fushion
   uvicorn main:app --reload
   ```

3. In another terminal start the Vite dev server

   ```bash
   npm install
   npm run dev
   ```

Login uses any ID (at least 3 characters) with the key `open-sesame`.

