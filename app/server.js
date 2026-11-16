require("dotenv").config();

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const db = require("./db");
const { CITIES, findCity } = require("./data/cities");

const PORT = Number(process.env.PORT) || 3000;
const COMPANY_NAME = process.env.COMPANY_NAME || "Atlanta Roof Check";
const COMPANY_LEGAL_NAME = process.env.COMPANY_LEGAL_NAME || COMPANY_NAME;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "hello@example.com";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const CONSENT_VERSION = "2026-11-15-v1";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ISSUE_TYPES = [
  { value: "leak", label: "Active leak" },
  { value: "storm_damage", label: "Storm or hail damage" },
  { value: "replacement", label: "Roof replacement" },
  { value: "insurance_claim", label: "Insurance claim / inspection for a claim" },
  { value: "not_sure", label: "Not sure — I want an inspection" }
];
const URGENCY = [
  { value: "emergency", label: "Emergency (water is coming in now)" },
  { value: "soon", label: "Soon (this week)" },
  { value: "planning", label: "Planning ahead (no rush)" }
];

function consentText() {
  return (
    `I agree that ${COMPANY_LEGAL_NAME} may share my information with one local partner ` +
    `roofing contractor for the purpose of contacting me about a free roof inspection, ` +
    `and that the partner (and ${COMPANY_LEGAL_NAME}) may call, text, or email me at the ` +
    `phone number and email I provided, including with an automatic telephone dialing ` +
    `system or a prerecorded or artificial voice. Message and data rates may apply. ` +
    `I understand I am not required to agree to this as a condition of purchasing any ` +
    `property, goods, or services, and I may opt out of calls or texts at any time by ` +
    `replying STOP or by emailing ${SUPPORT_EMAIL}.`
  );
}

function baseLocals(req, extra = {}) {
  return {
    companyName: COMPANY_NAME,
    supportEmail: SUPPORT_EMAIL,
    cities: CITIES,
    issueTypes: ISSUE_TYPES,
    urgencyOptions: URGENCY,
    consentText: consentText(),
    path: req.path,
    ...extra
  };
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "";
}

function sign(value) {
  const h = crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
  return `${value}.${h}`;
}

function verify(signed) {
  if (!signed || !signed.includes(".")) return null;
  const value = signed.slice(0, signed.lastIndexOf("."));
  const expected = sign(value);
  const a = Buffer.from(signed);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? value : null;
}

function isAdmin(req) {
  const raw = (req.headers.cookie || "")
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("arc_admin="));
  if (!raw) return false;
  const token = decodeURIComponent(raw.slice("arc_admin=".length));
  const value = verify(token);
  if (!value) return false;
  const [flag, exp] = value.split(":");
  return flag === "1" && Number(exp) > Date.now();
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  if (req.path.startsWith("/admin") && req.method === "GET" && req.path !== "/admin/login") {
    return res.redirect("/admin/login");
  }
  return res.status(401).send("Unauthorized");
}

function csrfToken() {
  return crypto.randomBytes(16).toString("hex");
}

function setCsrfCookie(res, token) {
  res.append("Set-Cookie", `arc_csrf=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
}

function readCookie(req, name) {
  const raw = (req.headers.cookie || "")
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  return raw ? decodeURIComponent(raw.slice(name.length + 1)) : "";
}

function validCsrf(req) {
  const fromForm = String(req.body?._csrf || "");
  const fromCookie = readCookie(req, "arc_csrf");
  return fromForm && fromCookie && fromForm === fromCookie;
}

const recentPosts = new Map();
function rateLimitForm(req, res, next) {
  const key = clientIp(req);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const max = 8;
  const entry = recentPosts.get(key) || [];
  const fresh = entry.filter((t) => now - t < windowMs);
  if (fresh.length >= max) {
    return res.status(429).render("error", baseLocals(req, {
      title: "Please wait",
      message: "Too many inspection requests from this network. Please try again in a few minutes."
    }));
  }
  fresh.push(now);
  recentPosts.set(key, fresh);
  next();
}

function clean(str, max = 200) {
  return String(str || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

function validZip(zip) {
  return /^\d{5}(-\d{4})?$/.test(zip);
}

async function notifyNewLead(lead) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return { skipped: true };
  const from = process.env.FROM_EMAIL || "Atlanta Roof Check <onboarding@resend.dev>";
  const body = [
    `New opt-in inspection request (#${lead.id})`,
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    `Email: ${lead.email}`,
    `Address: ${lead.address}, ${lead.city}, GA ${lead.zip}`,
    `Issue: ${lead.issue_type}`,
    `Urgency: ${lead.urgency}`,
    `Landing city: ${lead.landing_city || ""}`,
    `Consent version: ${lead.consent_version}`,
    `Time: ${lead.created_at}`
  ].join("\n");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `New roof inspection lead: ${lead.city} / ${lead.issue_type}`,
      text: body
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`);
  }
  return { sent: true };
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function leadsToCsv(rows) {
  const headers = [
    "id",
    "created_at",
    "name",
    "phone",
    "email",
    "address",
    "city",
    "zip",
    "issue_type",
    "urgency",
    "landing_city",
    "consent_version",
    "status",
    "sold_to_roofer",
    "sale_price",
    "notes"
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.locals.companyName = COMPANY_NAME;
  next();
});

app.get("/", (req, res) => {
  const token = csrfToken();
  setCsrfCookie(res, token);
  res.render("home", baseLocals(req, {
    title: `Free roof inspection in metro Atlanta | ${COMPANY_NAME}`,
    city: null,
    csrfToken: token,
    errors: [],
    values: {}
  }));
});

app.get("/privacy", (req, res) => {
  res.render("privacy", baseLocals(req, { title: `Privacy Policy | ${COMPANY_NAME}` }));
});

app.get("/terms", (req, res) => {
  res.render("terms", baseLocals(req, { title: `Terms | ${COMPANY_NAME}` }));
});

app.get("/partners", (req, res) => {
  res.render("partners", baseLocals(req, { title: `Partner roofers | ${COMPANY_NAME}` }));
});

app.get("/cities", (req, res) => {
  res.render("cities", baseLocals(req, { title: `Service areas | ${COMPANY_NAME}` }));
});

app.get("/roof-inspection/:citySlug", (req, res) => {
  const city = findCity(req.params.citySlug);
  if (!city) {
    return res.status(404).render("error", baseLocals(req, {
      title: "City not found",
      message: "We do not have a landing page for that city yet. Pick a metro Atlanta city from the list."
    }));
  }
  const token = csrfToken();
  setCsrfCookie(res, token);
  res.render("landing", baseLocals(req, {
    title: `Free roof inspection in ${city.name}, GA | ${COMPANY_NAME}`,
    city,
    csrfToken: token,
    errors: [],
    values: { city: city.name }
  }));
});

function collectForm(req) {
  const values = {
    name: clean(req.body.name, 120),
    phone: clean(req.body.phone, 40),
    email: clean(req.body.email, 120).toLowerCase(),
    address: clean(req.body.address, 200),
    city: clean(req.body.city, 80),
    zip: clean(req.body.zip, 12),
    issue_type: clean(req.body.issue_type, 40),
    urgency: clean(req.body.urgency, 40),
    consent: req.body.consent === "on" || req.body.consent === "yes" || req.body.consent === "1"
  };
  const errors = [];
  if (values.name.length < 2) errors.push("Please enter your name.");
  if (!validPhone(values.phone)) errors.push("Please enter a valid U.S. phone number.");
  if (!validEmail(values.email)) errors.push("Please enter a valid email address.");
  if (values.address.length < 4) errors.push("Please enter the property street address.");
  if (values.city.length < 2) errors.push("Please enter the city.");
  if (!validZip(values.zip)) errors.push("Please enter a 5-digit ZIP code.");
  if (!ISSUE_TYPES.some((t) => t.value === values.issue_type)) errors.push("Please choose the type of roof issue.");
  if (!URGENCY.some((t) => t.value === values.urgency)) errors.push("Please choose how urgent this is.");
  if (!values.consent) errors.push("Please check the consent box if you want a partner roofer to contact you.");
  if (!validCsrf(req)) errors.push("The form expired. Please refresh the page and try again.");
  return { values, errors };
}

async function handleLead(req, res, cityFromPage) {
  const { values, errors } = collectForm(req);
  if (cityFromPage && !values.city) values.city = cityFromPage.name;
  if (errors.length) {
    const token = csrfToken();
    setCsrfCookie(res, token);
    return res.status(400).render(cityFromPage ? "landing" : "home", baseLocals(req, {
      title: cityFromPage
        ? `Free roof inspection in ${cityFromPage.name}, GA | ${COMPANY_NAME}`
        : `Free roof inspection in metro Atlanta | ${COMPANY_NAME}`,
      city: cityFromPage,
      csrfToken: token,
      errors,
      values
    }));
  }

  const lead = await db.insertLead({
    name: values.name,
    phone: values.phone,
    email: values.email,
    address: values.address,
    city: values.city,
    zip: values.zip,
    issue_type: values.issue_type,
    urgency: values.urgency,
    landing_city: cityFromPage ? cityFromPage.name : clean(req.body.landing_city, 80),
    consent_given: 1,
    consent_text: consentText(),
    consent_version: CONSENT_VERSION,
    ip: clientIp(req),
    user_agent: clean(req.headers["user-agent"], 400)
  });

  try {
    await notifyNewLead(lead);
  } catch (err) {
    console.error("Lead saved, but email notification failed:", err.message);
  }

  return res.redirect(`/thanks?id=${lead.id}`);
}

app.post("/leads", rateLimitForm, (req, res, next) => {
  handleLead(req, res, null).catch(next);
});

app.post("/roof-inspection/:citySlug", rateLimitForm, (req, res, next) => {
  const city = findCity(req.params.citySlug);
  if (!city) {
    return res.status(404).render("error", baseLocals(req, {
      title: "City not found",
      message: "We do not have a landing page for that city yet."
    }));
  }
  handleLead(req, res, city).catch(next);
});

app.get("/thanks", (req, res) => {
  res.render("thanks", baseLocals(req, {
    title: `Request received | ${COMPANY_NAME}`,
    leadId: clean(req.query.id, 20)
  }));
});

app.get("/admin/login", (req, res) => {
  if (isAdmin(req)) return res.redirect("/admin");
  const token = csrfToken();
  setCsrfCookie(res, token);
  res.render("admin-login", baseLocals(req, {
    title: "Admin sign-in",
    csrfToken: token,
    error: null
  }));
});

app.post("/admin/login", (req, res) => {
  if (!validCsrf(req)) {
    const token = csrfToken();
    setCsrfCookie(res, token);
    return res.status(400).render("admin-login", baseLocals(req, {
      title: "Admin sign-in",
      csrfToken: token,
      error: "The form expired. Please try again."
    }));
  }
  if (!ADMIN_PASSWORD) {
    const token = csrfToken();
    setCsrfCookie(res, token);
    return res.status(500).render("admin-login", baseLocals(req, {
      title: "Admin sign-in",
      csrfToken: token,
      error: "ADMIN_PASSWORD is not set on the server."
    }));
  }
  const submitted = String(req.body.password || "");
  const a = Buffer.from(submitted);
  const b = Buffer.from(ADMIN_PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    const token = csrfToken();
    setCsrfCookie(res, token);
    return res.status(401).render("admin-login", baseLocals(req, {
      title: "Admin sign-in",
      csrfToken: token,
      error: "Incorrect password."
    }));
  }
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const cookie = sign(`1:${exp}`);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append("Set-Cookie", `arc_admin=${encodeURIComponent(cookie)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`);
  res.redirect("/admin");
});

app.post("/admin/logout", requireAdmin, (req, res) => {
  res.append("Set-Cookie", "arc_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.redirect("/admin/login");
});

app.get("/admin", requireAdmin, async (req, res, next) => {
  try {
    const leads = await db.allLeads();
    const token = csrfToken();
    setCsrfCookie(res, token);
    res.render("admin", baseLocals(req, {
      title: "Lead desk",
      leads,
      csrfToken: token,
      saved: req.query.saved === "1",
      storage: db.storageInfo()
    }));
  } catch (err) {
    next(err);
  }
});

app.get("/admin/leads.csv", requireAdmin, async (req, res, next) => {
  try {
    const leads = await db.allLeads();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="leads-${stamp}.csv"`);
    res.send(leadsToCsv(leads));
  } catch (err) {
    next(err);
  }
});

app.post("/admin/leads/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!validCsrf(req)) return res.status(400).send("Bad CSRF token. Refresh and try again.");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).send("Bad id");
    await db.updateLeadSale(id, {
      status: clean(req.body.status, 40) || "new",
      sold_to_roofer: clean(req.body.sold_to_roofer, 160),
      sale_price: clean(req.body.sale_price, 40),
      notes: clean(req.body.notes, 500)
    });
    res.redirect("/admin?saved=1");
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).render("error", baseLocals(req, {
    title: "Not found",
    message: "That page does not exist."
  }));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", baseLocals(req, {
    title: "Server error",
    message: "Something went wrong. Please try again."
  }));
});

async function start() {
  const info = await db.init();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`${COMPANY_NAME} listening on port ${PORT} (${info.driver}${info.storage && info.storage !== "postgres" ? `: ${info.storage}` : ""})`);
    if (!ADMIN_PASSWORD) {
      console.warn("WARNING: ADMIN_PASSWORD is not set. The admin desk will not accept logins.");
    }
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
