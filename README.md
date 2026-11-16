# Metro Atlanta roofing lead-gen kit

Legal, opt-in (form-based) starter kit for a roofing lead business: research, a pitch list of real metro Atlanta roofing *companies*, an MVP web app, and a launch plan.

**Do not scrape homeowner phone numbers. Do not cold-call or cold-text homeowners.** Storm data in this project is for timing ads and content, not for calling people in a hail swath.

| Path | What it is |
| --- | --- |
| [RESEARCH.md](RESEARCH.md) | Sourced market, TCPA, Georgia law, storm data, and traffic-cost notes |
| [LAUNCH_PLAN.md](LAUNCH_PLAN.md) | Step-by-step launch, sourced startup costs, sample roofer pitch and rate card |
| [roofers_atlanta.csv](roofers_atlanta.csv) | 26 metro Atlanta roofing companies (name, site, phone, city) pulled from their public sites or contact pages on 2026-11-15 |
| [app/](app/) | Node/Express MVP (Render free + Neon), with local SQLite fallback and NOAA SPC script |
| [render.yaml](render.yaml) | Render Blueprint (free web service, root directory `app`) |
| [app/.env.example](app/.env.example) | Environment variable template (copy to `.env` locally; never commit `.env`) |

Start with `RESEARCH.md` and `app/README.md`. Local run steps are in `app/README.md`.

This is software, not legal advice. Have a Georgia attorney review the consent language, privacy policy, and how you transfer leads before you take the site public or accept money.

## Deploy on Render + Neon (no coding required)

You need a free [Neon](https://neon.com) account and a free [Render](https://render.com) account. The GitHub repo is already public: [dseven-beep/roof-leads-atlanta](https://github.com/dseven-beep/roof-leads-atlanta).

### 1. Create a Neon Postgres database

Official steps: [How do I create a new project in Neon?](https://neon.com/faqs/create-new-neon-project) and [Where do I find a copy-pasteable Postgres connection string?](https://neon.com/faqs/where-find-database-connection-string)

1. Sign in to the [Neon Console](https://console.neon.tech).
2. Click **New Project**.
3. Enter a project name (for example `atlanta-roof-check`) and choose a **Region**. Pick the AWS region closest to your app (for Atlanta, a US East region is a good fit).
4. Under **Services**, Postgres database is on by default. Click **Create project**.
5. On the project dashboard, click **Connect** in the Console nav.
6. In the **Connect to your branch** modal, pick the branch, compute, database, and role. Leave **Connection pooling** on (the default). Click the copy icon next to the connection string.
7. Paste that string into a password manager. It is your `DATABASE_URL`. Neon’s string already includes `sslmode=require`. Do not put it in this GitHub repo.

Neon’s free plan details are on [neon.com/pricing](https://neon.com/pricing).

### 2. Deploy with a Render Blueprint (recommended)

Official steps: [Render Blueprints setup](https://render.com/docs/infrastructure-as-code) and [Blueprint YAML reference](https://render.com/docs/blueprint-spec) (`sync: false` prompts you for secret values on first create).

1. Open the [Render Dashboard](https://dashboard.render.com) and sign in.
2. Click **New > Blueprint**.
3. Click **Connect** next to `dseven-beep/roof-leads-atlanta`. Connect your GitHub account if Render asks you to.
4. Name the Blueprint, leave the branch as `main`, and leave **Blueprint Path** as `render.yaml` (the file at the repo root).
5. Review the change list. Render will prompt you for every variable marked `sync: false` in `render.yaml`. Fill these in:
   - **DATABASE_URL** — the Neon connection string from step 1
   - **ADMIN_PASSWORD** — a long password only you know (this is how you sign in at `/admin`)
   - **PUBLIC_BASE_URL** — you can leave this blank for now and set it after the first deploy to your `https://….onrender.com` URL
   - **SUPPORT_EMAIL** — an email you actually check
   - **RESEND_API_KEY** and **NOTIFY_EMAIL** — optional; leave blank if you are not sending new-lead email yet
6. `SESSION_SECRET` is generated automatically. Click **Deploy Blueprint**.
7. Wait until the web service deploy is **Live** (service **Deploys** tab). Open the `*.onrender.com` URL in the service header.

After the first deploy, you can add or change variables on the service’s **Environment** page: click **+ Add Environment Variable**, then **Save, rebuild, and deploy**. Official steps: [Environment Variables and Secrets](https://render.com/docs/configure-environment-variables).

### Alternative: New > Web Service (no Blueprint)

Official steps: [Web Services](https://render.com/docs/web-services) and [Your First Render Deploy](https://render.com/docs/your-first-deploy)

1. In the Render Dashboard, click **New > Web Service**.
2. Select **Git Provider**, connect GitHub if needed, choose `dseven-beep/roof-leads-atlanta`, and click **Connect**.
3. Set **Root Directory** to `app`, **Language** / runtime to **Node**, **Build Command** to `npm install`, and **Start Command** to `npm start`.
4. Choose the **Free** compute plan.
5. Under **Advanced**, add environment variables: `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET` (a long random string), `NODE_ENV=production`, plus optional `RESEND_API_KEY`, `NOTIFY_EMAIL`, `PUBLIC_BASE_URL`, and `SUPPORT_EMAIL`.
6. Click **Create Web Service**. Wait until the deploy is **Live**, then open the `*.onrender.com` URL.

### 3. Verify the form and admin page

1. Open the public site. Submit a test inspection request on the home page or a city page such as `/roof-inspection/marietta`. Check the consent box or the form will reject the submission.
2. You should land on a thank-you page.
3. Go to `/admin`, sign in with `ADMIN_PASSWORD`, confirm the test lead is listed, and download `/admin/leads.csv`.
4. Delete the test lead later from the database if you do not want it in production records.

### Render free-tier notes

Documented at [render.com/docs/free](https://render.com/docs/free):

- The web service **spins down after 15 minutes idle** and can take about a minute to wake.
- **750 Free instance hours** per workspace per month.
- Free web services **cannot send outbound traffic on SMTP ports 25, 465, or 587**. Use an HTTP email API such as Resend, not SMTP.
- Do **not** use Render’s own free Postgres for production data: it **expires 30 days** after creation. Neon is the durable free database for this stack.
