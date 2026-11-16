# Launch plan (opt-in Atlanta roofing leads)

A practical sequence for a very low infrastructure budget. Hosting can stay near $20/year. **Paid ads will cost much more than $20/year** if you use them. This is not legal advice; have a Georgia attorney review consent language and contracts before you take money or go live.

## Step-by-step

1. **Form the company.** Register a domestic Georgia LLC online for a **$100** filing fee (credit card). Mail or in-person filing is **$110**. Source: [georgia.gov/register-llc](https://georgia.gov/register-llc) (page last updated June 2026). Pick a registered agent in Georgia. File the annual registration each year between January 1 and April 1 (the official page requires it; the exact annual fee was not captured in that article). Get an EIN from IRS.gov (free). Ask an accountant whether you need a local business/occupational tax certificate in the city or county where you operate.

2. **Buy a domain.** As of November 1, 2026, Namecheap’s regular **.com registration** price is **$15.98/year**, “without the ICANN fee.” Source: [Namecheap knowledge base, “.com price change - November 1, 2026”](https://www.namecheap.com/support/knowledgebase/article.aspx/10840/2201/com-price-change-november-1-2026/) (updated Oct 15, 2026). Promotional first-year prices change often; use the live checkout total. Point the domain at Render later.

3. **Deploy the app for $0/month infrastructure.**
   - Neon Free Postgres: **$0/month**, permanent (not a trial), no credit card, 100 CU-hours and 1 GB storage per project, scale-to-zero after 5 minutes idle. Source: [neon.com/pricing](https://neon.com/pricing) (page last updated Nov 4, 2026).
   - Render free web service: **$0**, with the limits in [render.com/docs/free](https://render.com/docs/free) (spins down after 15 minutes idle; 750 Free instance hours/month; **no outbound SMTP** on ports 25/465/587). Use Resend or another HTTP email API if you want new-lead alerts.
   - Follow `app/README.md` for env vars (`DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, brand name, support email).

4. **Have counsel review** the form consent, privacy policy, terms, and the roofer purchase agreement (what a “valid lead” is, exclusivity, refund rules, and how consent records are delivered). The app language is a draft.

5. **Pre-sell before you buy traffic.** Use `roofers_atlanta.csv` (26 companies; public business phones and websites only). Call or email the **business**, introduce exclusive opt-in inspection leads, and try to get two or three roofers to agree on a price and service area before you spend on ads. Sample message and rate card are below.

6. **Turn on the cheapest demand channels first** (see sourced figures in `RESEARCH.md`):
   - Claim a **free Nextdoor Business Page** and post useful, non-spammy inspection offers. Paid Nextdoor ads start at **$5/day**.
   - Test **Craigslist Services** posts at **$5** each, with honest copy and a link to a city landing page.
   - Share city pages (`/roof-inspection/marietta`, etc.) on your own profiles. Do not scrape groups or message homeowners unsolicited.
   - Add Google search ads or Meta lead ads only after at least one roofer will buy the leads. LocaliQ’s national median search CPL for Roofing & Gutters is **$228.15**. That can wipe a small budget if leads sit unsold.
   - Do **not** run Google Local Services Ads as if this site were the roofing company.

7. **Use storm data as a timing signal, not a calling list.** After NOAA SPC hail or damaging-wind reports hit metro Atlanta counties, refresh the affected city pages and, if budget allows, raise ad spend there. Run `npm run storms -- --today` or `--date YYYY-MM-DD`. Never call or text a home just because it sits near a hail report.

8. **Deliver leads fast and keep records.** When a form arrives, notify the buying roofer immediately (email/SMS to the *roofer*), attach or offer the consent record, and log the sale price in `/admin`. Exclusive delivery is the product.

9. **Measure before you scale.** Track: form conversion rate, cost per opted-in lead, percent sold, refund/unqualified rate, and (from roofers, if they will share it) appointments set and jobs closed. Adjust price only after you have actual Atlanta data.

## Sourced startup / first-year cash costs (infrastructure)

| Item | Amount | Source |
| --- | --- | --- |
| Georgia domestic LLC, online | $100 | [georgia.gov/register-llc](https://georgia.gov/register-llc) |
| .com domain, regular Namecheap registration | $15.98/year plus ICANN fee | [Namecheap .com price change](https://www.namecheap.com/support/knowledgebase/article.aspx/10840/2201/com-price-change-november-1-2026/) |
| Neon Postgres (Free) | $0 | [neon.com/pricing](https://neon.com/pricing) |
| Render web service (Free) | $0, with spin-down and hour caps | [render.com/docs/free](https://render.com/docs/free) |
| **Infrastructure subtotal (typical)** | **About $116 the first year** if you form an LLC and buy a .com, or **about $16** if you already have an entity and only buy the domain | |
| Optional tests | Nextdoor from $5/day; Craigslist Services $5/post | Official pages cited in `RESEARCH.md` |
| Optional search ads | Budget at your own risk; national roofing/gutters search median CPL $228.15 | LocaliQ |

The “about $20/year running costs” target is realistic for **domain + free hosting only**, not for LLC formation in year one and not for advertising.

## Sample pricing sheet (for roofers; suggested starting points, not Atlanta transaction data)

These are **starting quotes to test**, framed against published vendor menus — not prices this project has already collected in Atlanta.

**Product:** Exclusive, homeowner-requested roof inspection lead from a TCPA-style written consent form. Sold once. Name, phone, email, address, issue type, urgency, and a copy of the consent record are included. You (the roofer) make the first contact.

**Suggested test rates (exclusive PPL):**

- Standard exclusive inspection request: **$95**
- After a documented metro hail/wind day in the homeowner’s county, or an “emergency / water coming in” request: **$125**
- Introductory block for a new partner (prepaid, 5 leads): **$400** ($80 each), used only while you prove quality

**Why those numbers sit where they do:** shared marketplace leads are often reported in a lower band (Networx $10–$100+, contractor-reported Angi $15–$85, both shared). Exclusive published menus run higher (99 Calls organic $54.99; Service Direct roofing $85–$550; 99 Calls Google Ads $147–$405). Pay-per-appointment products are higher still (The Lead Giants $175–$200). $95–$125 exclusive PPL is intended to be cheaper than most exclusive ad-driven leads and more valuable than a shared Angi-style lead — **if** you actually deliver unique, opted-in homeowners quickly.

**Validity / refund (draft — have counsel finish this):** a lead is refundable or replaced if the number is disconnected, the person says they did not submit the form, the address is outside the agreed counties, or it is a duplicate you already received from us within 30 days. No refund solely because the homeowner hired someone else or the job did not close.

**What you will not get:** shared leads, scraped phone lists, or door-knock lists built from storm reports.

## Sample pitch (email or voicemail to a roofing *company*)

Subject: Exclusive opt-in roof inspection requests in [City / Cobb-Fulton-Gwinnett]

Hi [Name],

I am building a small, local lead source for metro Atlanta roofers. Homeowners request a free roof inspection on a city landing page and check a written consent box before we pass their information along. Each request is sold once — not to three other roofers at the same time.

I am offering [your company] exclusive inspection leads in [counties] at $[95] each (or $[125] for emergency / post-storm requests), with the consent record included. I can start with a five-lead trial at $[400].

I am not a storm chaser and I do not scrape or cold-call homeowners. If you want to try a handful and see the form and the consent language first, I can send both this week.

[Your name]  
[Your LLC]  
[Your phone]  
[Your site]

Call the public business number in `roofers_atlanta.csv`. Do not call or text homeowners from that file; there are none in it.
