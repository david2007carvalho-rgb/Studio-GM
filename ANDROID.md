# Studio GM on your phone

This folder is the whole game plus everything needed to build an Android app (APK) and to update it later.
GitHub builds the APK for you (free). You do the setup once, about 10 minutes.

## One-time setup

1. Make a free account at github.com and create a **new public repository** (for example `studio-gm`).
   It must be public so the phone can download updates from GitHub Pages for free.
2. Put the contents of this folder in the repository (everything, including the hidden `.github` folder).
   - Easiest on a computer: unzip, then on the repository page choose **Add file > Upload files** and drag the files and folders in.
   - If `.github/workflows/build.yml` did not upload, choose **Add file > Create new file**, type the name `.github/workflows/build.yml` and paste the file's content.
3. In the repository open **Settings > Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab. A run called "Build Studio GM" starts by itself (re-run it from there if you changed Pages after the first run). Wait for the green check (about 8 minutes the first time).
5. On your phone open the repository, go to **Releases > Studio GM (latest)** and download **Studio-GM.apk**. Open it and allow "install from this source" when Android asks.

If a run turns red, open it, copy the error text from the failing step and send it to me.

## Updating when you have a new feature

Send me your idea, I change the code, you put the new files in the repository (same upload as step 2) and wait about 2 minutes.
The app checks by itself when you open it, downloads the new version and shows **"Update ready - Restart"**. Tap Restart. That is all.
Your saves are never touched.

- **Menu > Updates** (the gear) shows the version, lets you check by hand and shows the update address (already filled in).
- **No GitHub at all:** I can also give you a small `.sgmupdate` file. Save it on the phone, open **Menu > Updates > Install update from a file** and pick it.
- If an update ever breaks the game on start, the app goes back to the installed version by itself. **Menu > Updates > Go back to the installed version** does the same by hand.
- You only need to install a new APK when the Android part changes (icon, name, permissions). The latest one is always on the Releases page and installs over the old one without losing saves.

## Good to know

- Saves live inside the app on the phone. They survive updates, but **uninstalling the app deletes them**.
- `android-signing/debug.keystore` is the key that signs your APK. Keep it in the repository: with a different key Android refuses to install over the old app.
- **Menu > Mods** has the Studio GM Toolkit mods (ceremony, reviews, brand deals, themes...). The IMDb photos need internet.
- The Android back button closes the open window (profile, film page, menu) before leaving the app.
- The same site also works in the phone browser at `https://YOUR-NAME.github.io/studio-gm/`.

## What was changed in the game

- `src/mobile.css`: phone layout (compact header, bottom page bar, full-screen windows, bigger touch targets). It only applies below 700px wide.
- `src/app/`: the Menu (updates + mods) and the update code. `src/mods/`: the Toolkit mods running inside the app.
- `App.tsx` and `SaveSlots.tsx`: one Menu button each. Nothing in the game rules changed.
- `scripts/postbuild.mjs`, `vite.config.ts`, `capacitor.config.json`, `.github/workflows/build.yml`: build and update plumbing.
