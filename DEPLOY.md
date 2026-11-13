# Putting PLAYORA online: a beginner's guide

This guide takes you from "the project is on my computer" to "anyone can open PLAYORA on
their phone". No prior knowledge of Git, hosting or DNS needed. Plan for **30 to 45 minutes**
the first time. Everything here is **free**.

**The settings you'll need, checked against this exact project:**

| Setting | Value |
|---|---|
| Hosting | Cloudflare Pages (free plan) |
| Framework preset | **None** |
| Build command | **`npm run build`** |
| Build output directory | **`dist`** |
| Root directory | leave **empty** |
| Production branch | **`main`** |
| Node.js version | 22 (already set by the `.node-version` file; nothing to type) |

Why these: `npm run build` runs `scripts/build.mjs`, which writes the finished website into the
`dist` folder. The project has no npm packages, so the build takes a few seconds.

---

## 1. What "hosting" means, and what we need

Right now PLAYORA lives on your computer. When you run `npm start`, your computer acts as a tiny
web server that only **you** can reach (that's what `localhost` means).

**Hosting** means putting the website on a computer that's always on and connected to the
internet (a server), with a public address (a URL) that anyone can type.

We'll use three free things:

1. **GitHub**: an online home for your project's files, with a history of every change.
2. **Cloudflare Pages**: takes the files from GitHub, builds the site and serves it worldwide, fast, with HTTPS.
3. **GitHub Desktop**: a simple app to send your changes from your computer to GitHub, no commands needed.

After the first setup the flow is: *edit on your computer → click "Push" → the site updates itself.*

## 2. Do I need to buy a domain name now?

**No.** Cloudflare gives you a free address like **`https://playora.pages.dev`**, which works
on every device right away. You can buy a domain like `playora.com` later (part 13) without
redoing anything. Many sites launch on the free address first.

---

## 3. Create a GitHub account

1. Go to **https://github.com/signup**.
2. Enter your email, create a password, choose a username (it will appear in your project's address, e.g. `github.com/yourname/playora`).
3. Solve the check and click **Create account**.
4. Enter the code GitHub emails you. If it asks about your plan, choose **Free**.

## 4. Install GitHub Desktop and create the repository

A **repository** ("repo") is a project folder that GitHub tracks.

1. Download **GitHub Desktop** from **https://desktop.github.com** and install it.
2. Open it and choose **Sign in to GitHub.com**. Your browser opens; click **Authorize desktop**. Back in the app, click **Finish**.
3. Make sure the PLAYORA project folder is where you want to keep it (for example `Desktop\playora`).
   Inside it you should see `package.json`, `site.config.json`, `games`, `src`, `scripts`…
4. In GitHub Desktop: menu **File → Add local repository…** → **Choose…** → select the PLAYORA folder → **Add repository**.
5. It will say *"This directory does not appear to be a Git repository."* Click the blue link **create a repository**.
6. In the window that opens:
   - **Name**: `playora`
   - **Git ignore**: leave **None** (the project already has a `.gitignore`, which keeps the `dist` folder off GitHub)
   - **License**: None
   - Click **Create repository**.

## 5. Upload ("push") PLAYORA to GitHub

1. In GitHub Desktop click **Publish repository** (top bar).
2. Keep the name `playora`. **"Keep this code private"**: your choice. Both work with Cloudflare.
   Private hides your code; the website itself is public either way.
3. Click **Publish repository**. After a few seconds the button changes to **Fetch origin**: your files are on GitHub.
4. Check: go to **https://github.com/YOUR-USERNAME/playora**. You should see the folders `games`, `scripts`, `src` and files like `README.md`.
   You should **not** see a `dist` folder; that's correct.

> **No GitHub Desktop?** Alternative: on github.com click **+ → New repository**, name it `playora`, click
> **Create repository**, then **uploading an existing file** and drag in everything from the project folder
> **except** `dist` (and `node_modules` if it exists), then **Commit changes**. This works, but
> future updates are easier with GitHub Desktop.

---

## 6. Create a Cloudflare account

1. Go to **https://dash.cloudflare.com/sign-up**.
2. Enter your email and a password, click **Sign up**.
3. Open the verification email from Cloudflare and click the link.
4. If Cloudflare asks what you want to do first, you can skip it. You do **not** need to add a domain now.

## 7. Connect GitHub to Cloudflare Pages

1. In the Cloudflare dashboard's left menu, click **Workers & Pages** (in some layouts it sits inside a group named **Compute** or **Build**; you can also type "Workers & Pages" in the dashboard search bar).
2. Click **Create application**.
3. Choose the **Pages** option (if the screen shows Workers first, look for the **Pages** tab or a link like
   "Looking to deploy Pages? **Get started**").
4. Click **Connect to Git** (sometimes "Import an existing Git repository").
5. Choose **GitHub** and click **Connect GitHub**. A GitHub window opens:
   - Choose **Only select repositories**, pick **playora**.
   - Click **Install & Authorize** (GitHub may ask for your password).
6. Back in Cloudflare, select **playora** in the list and click **Begin setup**.

## 8 & 9. Enter the build settings

On the **Set up builds and deployments** screen, fill in exactly:

| Field | Type this |
|---|---|
| **Project name** | `playora` (this decides your address: `playora.pages.dev`. If the name is taken, Cloudflare tells you; pick something like `playora-games`) |
| **Production branch** | `main` |
| **Framework preset** | `None` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory (advanced)** | leave empty |
| **Environment variables** | none needed |

## 10. Deploy

Click **Save and Deploy**. You'll see a build log. In about a minute it should end with
*"Success! Your site is live!"*. In the log you'll see PLAYORA's own message:

```
✔ PLAYORA built into ./dist
  4 playable game(s), 4 coming soon, 8 categories
```

If it fails, scroll the log to the first red line. The build explains problems in plain words
(for example a typo in `games.json`). Fix it on your computer, then push again (part 11).

## 11. Get your public PLAYORA address

At the end of the deployment Cloudflare shows a link like **`https://playora.pages.dev`**
(you'll also find it any time under **Workers & Pages → playora**). Click it. That's your live website.

**One small follow-up:** open `site.config.json` on your computer and make sure `"siteUrl"`
matches your real address exactly (for example `"https://playora.pages.dev"` or
`"https://playora-games.pages.dev"`). Also set `"contactEmail"` to the address you want
messages sent to. Then publish the change (see "How updates work" below). This makes Google,
the sitemap and link previews use the right address, and turns on the contact form.

## 12. Test it from another device

1. On your phone, **turn off Wi-Fi** (so you're definitely using the public internet), open the browser and type your address.
2. Check: the menu button opens, search finds "comet", a game starts with **Play now**, the fullscreen button works,
   and the "Coming soon" games can't be played.
3. Send the link to a friend and ask them to try it on their computer.
4. Share the link in a chat app (WhatsApp, Discord…). A preview card with the PLAYORA image should appear.

---

## How updates work (automatic deployment)

This is already set up: Cloudflare watches your GitHub repository.

```
You edit files  →  GitHub Desktop: Commit + Push  →  GitHub  →  Cloudflare builds  →  live in ~1 minute
```

Every time:

1. Change something on your computer (for example `site.config.json`, or add a game).
2. Optional but recommended: run `npm start` and check it at http://localhost:8080.
3. Open **GitHub Desktop**. On the left you'll see the changed files.
4. Bottom-left, in **Summary**, describe the change (e.g. "Set contact email"), click **Commit to main**.
5. Click **Push origin** (top bar).
6. Within a minute or two the live site is updated. You can watch it in Cloudflare under
   **Workers & Pages → playora → Deployments**.

If a build fails, **the previous version stays online**, so visitors never see a broken site. And in **Deployments**
you can open any old version and click **Rollback** to restore it.

## Adding new games after PLAYORA is online

1. Put the game in `games/<game-id>/` with an `index.html` and a thumbnail (copy `games/_template/` to start).
2. Add its entry in `games/games.json`.
3. Test with `npm start`.
4. GitHub Desktop → Summary "Add <game name>" → **Commit to main** → **Push origin**.

That's it. The game gets its own page, appears on the homepage, in its category, in search and in the sitemap
automatically. Full details in **ADDING-GAMES.md**.

---

## 13. Connect a custom domain later (e.g. playora.com)

1. **Check and buy the name.** The easiest option is **Cloudflare Registrar** (sells domains at cost):
   Cloudflare dashboard → **Domain Registration → Register Domains**, search `playora`, and pick an available
   ending (`.com`, `.io`, `.gg`, `.games`…). Buying here puts the domain on Cloudflare automatically.
   *(If you buy elsewhere, e.g. Namecheap or OVH: in Cloudflare click **Add a domain**, choose the Free plan, then
   at your registrar replace the "nameservers" with the two Cloudflare gives you. This can take a few hours to activate.)*
2. Go to **Workers & Pages → playora → Custom domains → Set up a custom domain**.
3. Type `playora.com` (your domain) and click **Continue**, then **Activate domain**. Cloudflare creates the DNS record for you.
4. Repeat for `www.playora.com` so both versions work.
5. Wait until both show **Active** (usually minutes; can take up to a day).
6. Update `"siteUrl"` in `site.config.json` to `"https://playora.com"`, then commit and push.

> Don't create DNS records by hand before step 3. Cloudflare warns this can cause a "522" error. Let the Pages screen do it.
> The `playora.pages.dev` address keeps working too.

## 14. HTTPS: what it is and how to check it

**HTTPS** encrypts everything between the visitor and your site, so nobody on the same Wi-Fi can read or
change what they see. Browsers label sites without it "Not secure", and Google ranks HTTPS sites higher.

**You don't have to do anything:** Cloudflare creates and renews the security certificate for
`*.pages.dev` and for your custom domain automatically, free.

To verify:

1. Open your site. The address starts with **`https://`** and the browser shows a **padlock** (or "tune" icon) next to it.
2. Click the padlock → **Connection is secure** → **Certificate is valid**.
3. Type the address with `http://` (no "s"). It should switch to `https://` by itself.
   For a custom domain, make sure this is on: Cloudflare → your domain → **SSL/TLS → Edge Certificates → Always Use HTTPS**.
4. Optional deep check: **https://www.ssllabs.com/ssltest/**, enter your domain; you should get an **A** grade.
5. Optional: PLAYORA also sends security headers (from `dist/_headers`). Check them at
   **https://securityheaders.com**.

---

## After launch: recommended next steps

- **Google Search Console** (https://search.google.com/search-console): add your site, then submit `https://your-address/sitemap.xml` so Google indexes all game pages.
- **Cloudflare Web Analytics**: free, privacy-friendly visitor stats, in your Pages project.
- **AdSense**: apply once you have several playable games and real content. Google tends to approve sites with more original
  content. When approved, follow "Advertising" in README.md.

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails with "Build stopped. Please fix the following" | Read the bullet points: they name the game and field. Usually a missing comma or quote in `games.json`. |
| Build fails with "Could not read games/games.json" | A JSON typo. Paste the file into https://jsonlint.com to find the line. |
| Site shows old content after a push | Wait 1 to 2 minutes, check **Deployments** in Cloudflare, then refresh with `Ctrl + F5`. |
| `npm` is "not recognized" on your computer | Install Node.js from https://nodejs.org, then close and reopen the terminal. |
| A new game shows "couldn't load" | Check the folder name matches the `id`, and that the file is called `index.html` (lowercase). |
| Project name `playora` was taken | Use another name (e.g. `playora-games`) and set `siteUrl` to match. A custom domain makes this invisible to visitors. |
