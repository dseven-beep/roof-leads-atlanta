# Atlanta Roof Check (MVP)

Opt-in, TCPA-oriented roof-inspection landing pages for metro Atlanta, a Postgres (or local SQLite) lead store, an admin desk to export leads and record which roofer bought them, and a NOAA SPC script that flags hail/wind reports in the Atlanta MSA.

This app is designed to run on **Render's free web plan** with **Neon Postgres** (also free). It does **not** scrape homeowner phone numbers and it does **not** place calls or texts. Homeowners submit a form and check an explicit consent box. You then sell each exclusive lead to one roofer from your pitch list.

This is software, not legal advice. Have a Georgia attorney review the consent language, privacy policy, and how you transfer leads before you take the site public or accept money.

## Local run (SQLite fallback)

Requires Node 20+ (tested on Node 24). If `DATABASE_URL` is unset, the app uses `node:sqlite` and writes `data/local.db`.

```bash
cd app
cp .env.example .env
# Set at least:
#   ADMIN_PASSWORD=a-long-password
#   SESSION_SECRET=another-long-random-string
npm install
npm start
```

Open http://localhost:3000 and http://localhost:3000/roof-inspection/marietta.

Submit the form (check the consent box). Then sign in at `/admin` and export `/admin/leads.csv`.

### Test the storm script against real NOAA data

```bash
# Known busy hail/wind day in north metro Atlanta
npm run storms -- --date 2025-04-10 --also-wind

# Annual SPC WCM hail/wind databases
npm run storms -- --wcm 2025 --hail-only
npm run storms -- --today
```

Daily CSVs live at `https://www.spc.noaa.gov/climo/reports/` (`today_hail.csv`, `YYMMDD_rpts_hail.csv`, and the wind equivalents). Annual files live at `https://www.spc.noaa.gov/wcm/data/`.

## Deploy on Render + Neon

Step-by-step, non-developer instructions (with official Neon and Render doc links) live in the [repo-root README](../README.md#deploy-on-render--neon-no-coding-required).

Short version:

1. Create a free Neon project in the Console (**New Project**), then click **Connect** and copy the connection string as `DATABASE_URL`. Official: [create a project](https://neon.com/faqs/create-new-neon-project), [copy the connection string](https://neon.com/faqs/where-find-database-connection-string).
2. On Render, use **New > Blueprint** against this repo (it reads `render.yaml` at the repo root, which sets `rootDir: app`). Official: [Blueprints setup](https://render.com/docs/infrastructure-as-code). Fill in `DATABASE_URL` and `ADMIN_PASSWORD` when prompted (`sync: false`). Leave `RESEND_API_KEY` / `NOTIFY_EMAIL` blank if you are not sending email yet.
3. Or use **New > Web Service**, set Root Directory to `app`, Build `npm install`, Start `npm start`, Free plan, and add the same env vars under **Advanced**. Official: [Web Services](https://render.com/docs/web-services).
4. When the deploy is Live, submit a test form and sign in at `/admin`.

You can add or change variables later on the service **Environment** page ([docs](https://render.com/docs/configure-environment-variables)).

### Important Render free-tier limits

Documented at https://render.com/docs/free:

- The web service **spins down after 15 minutes idle** and can take about a minute to wake.
- **750 Free instance hours** per workspace per month.
- Free web services **cannot send outbound traffic on SMTP ports 25, 465, or 587**. Use an HTTP email API such as Resend, not nodemailer/SMTP.
- Do **not** use Render's own free Postgres for production data: it **expires 30 days** after creation. Neon is the durable free database for this stack.

## Environment variables

See `.env.example`. `ADMIN_PASSWORD` must be set or the admin login will refuse all passwords.

## What this MVP is not

- It is not a dialer, SMS blaster, or scraper.
- Google Local Services Ads are generally for the business that performs the trade. Do not run LSAs as if this site were the roofing contractor.
- Partner roofers who call or text homeowners are responsible for honoring the consent, opt-outs, and do-not-call rules that apply to them. Keep the stored consent record and share it with the buyer.

## Local verification (November 15, 2026)

On this machine, with `DATABASE_URL` unset (SQLite at `data/local.db`):

- The home page and `/roof-inspection/marietta` rendered.
- A POST without the consent checkbox was rejected (HTTP 400).
- A complete opt-in form saved lead #1 with the stored consent text, version `2026-11-15-v1`, IP, and user agent, then redirected to `/thanks?id=1`.
- Admin login, sale fields (`sold_to_roofer`, `sale_price`), and CSV export worked.

Storm script, real NOAA data:

- `--date 2025-04-10 --also-wind` flagged **75** metro Atlanta hits (**26 hail, 49 wind**) from the official daily CSVs and excluded nearby non-MSA Georgia counties (for example Dade, Walker, Hall).
- `--wcm 2025 --hail-only` flagged **57** metro Atlanta hail reports out of 9,367 national WCM hail rows, on dates including 2025-04-10. Daily LSR files and the annual WCM database are different products, so counts for the same calendar day will not always match.
- `--today` on Nov 15, 2026 correctly reported **0** metro Atlanta hits (the national daily files that morning had no Georgia MSA reports).
