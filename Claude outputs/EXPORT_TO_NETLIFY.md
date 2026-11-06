# Export to Netlify

When the maintainer says "export to netlify", produce a fresh one-time zip of the production build, ready to drop onto Netlify.

1. Start from the latest `origin/main` (`git fetch origin && git switch main && git pull --ff-only`).
2. Build: `cd frontend`, then `npm run build` (on the maintainer's PC call npm through node, see `AGENTS.md`).
3. Zip the contents of `frontend/dist` with index.html at the zip root: `tar -a -cf C:\ADC\netlify-export\welina-netlify.zip -C dist .` (forward slashes in entries; do not use Compress-Archive on Windows PowerShell 5.1).
4. In Netlify choose Add new site, Deploy manually, and drop the zip. No build settings are needed.

The build uses a relative base (`./`), so the same bundle works at the root of a Netlify site and under the GitHub Pages subfolder. The zip is not committed. State the commit it was built from when reporting.

## Auto-deploy instead of a zip

`netlify.toml` at the repo root sets the base directory, build command, publish directory and Node 22. In Netlify choose Add new site, Import an existing project, connect `pkiran-aloha/ADC` and keep the detected settings. Every push to `main` then deploys. Netlify's own build is not covered by the local gate.
