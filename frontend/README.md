# Welina Analytics frontend

React 19 + Vite demo for Skill Acquisition, Behavior Reduction and ABC analysis. The data is fictional. `src/data/mockData.js` imports the shared fixture `data/clinicalSeed.json` at the repository root; the .NET API embeds that **same JSON**. To change the demo, update `scripts/generate_clinical_seed.py` and regenerate the shared JSON instead of adding separate frontend arrays.

```bash
# From frontend/
npm ci
npm run dev   # http://localhost:5173/
npm test      # fixture integrity + localStorage analytics tests
npm run build # static GitHub Pages bundle
```

Expand **Program definition** or **ABC recording setup** in the analytics UI to inspect the seeded setup fields and master lists. The seed is anchored to October 14, 2026 so filters remain deterministic. Data simulated in the UI is saved in browser localStorage; the demo is automatically reseeded after a fixture version change, or with **Reset Demo Data**. See the repository root README for coverage and API details.
