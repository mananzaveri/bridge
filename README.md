# Bridge

**Turn lyrics into a musical starting point.** Bridge takes song lyrics, figures out the emotional tone, and suggests a key and chord progression to match — a starting point for songwriters who can write lyrics and rhythm but don't know music theory.

🔗 **Live demo:** [(https://bridge-eight-jade.vercel.app/)]

> Runs on a free-tier backend, so the first request after inactivity can take 20-30 seconds to wake up.

---

## What it does

Paste in lyrics, and Bridge:
1. Runs emotion/sentiment analysis on the text
2. Maps the dominant emotion to a musical key
3. Suggests a chord progression that fits the key and mood
4. Plays it back so you can hear it before touching an instrument

---

## Running it locally

```bash
# Backend
cd backend
pip install -r requirements.txt
python app.py

# Frontend
cd frontend
npm install
npm run dev
```

Or just use the (https://bridge-eight-jade.vercel.app/) — no setup needed.

---

## Why I built this

I write lyrics and play drums but I don't know music theory, and I kept hitting the same wall: I know how a song should feel but not what key or chords get me there. Bridge is my attempt to fix that, and a chance to build something end to end — NLP, audio, a real deployed stack.

---

## Engineering decisions & challenges

Some of the tradeoffs that came up along the way:

**Model choice under memory constraints.** Started with a HuggingFace transformer for emotion detection, but Render's free tier has a tight memory ceiling and it kept causing cold-start failures. Switched to NRCLex, a lightweight lexicon-based emotion classifier. Smaller footprint, faster cold starts, and the output quality didn't really suffer for this use case.

**NLTK corpus path mismatch.** Corpus downloads were failing silently in production. Fixed it by moving the `nltk.download()` calls into `app.py` at startup instead of assuming the corpus was already there.

**Cold-start UX.** Render's free tier spins down when idle, so the first request can take up to 30 seconds. Added a `/ping` call on page load to pre-warm it, plus `waking` and `error` states in the UI so it doesn't just look broken while it's loading.

**Deploy order.** Deployed and tested the backend on its own first (hitting the Render URL directly) before touching the frontend. Kept the two deploys decoupled so the frontend only redeploys when its own code or env vars change.

---

## Tech stack

**Frontend:** React (Vite), Tone.js for audio playback — deployed on Vercel
**Backend:** Python, Flask, NRCLex, NLTK — deployed on Render
