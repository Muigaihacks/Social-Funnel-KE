# Acquisition OS — Accounts Setup Checklist

**Purpose:** Social Funnel must own and control all accounts (per contract Clause 13). This checklist is for the Social Funnel contact to open and configure the accounts below **from scratch**. **Do not use the developer’s personal credentials.**

**How we use these platforms:**  
n8n receives leads from all channels (Meta, LinkedIn, WhatsApp inbound, web forms) and sends them to our **custom backend** (Node + Prisma + PostgreSQL). The backend deduplicates, stores, and we then run the 60-second response, scoring, follow-up, booking, and Slack alerts. Our backend **replaces** Airtable/HubSpot as the place we store and manage leads.

---

## Document status (from your uploads)

| Document | Status |
|----------|--------|
| **Acquisition OS Build Brief.pdf** | Read and used for scope and integrations. |
| **Social_Funnel_Development_Agreement_v3.pdf** | Read and used for scope, deliverables, and account ownership (Clause 13). |
| **AcquisitionOS_ Build Guide Make .com** | Place the Word/PDF file in `docs/` (see README in docs or developer for copy command). Once in repo, we align checklist and scenario map to it. |

---

## Webhook URLs — we’ll provide these after the build is deployed

**For now, do not enter any Callback URL or Webhook URL** into Meta, LinkedIn, 360dialog, or Twilio. We will give you the URLs **after** the build is finished and the backend (and n8n) are deployed. Until then, complete all account creation and hand over credentials, tokens, and IDs; skip the step where you paste a URL into each platform.

When we’re ready, we’ll give you one URL per integration (different paths, same base). You’ll then add them here:

| Platform | What we’ll give you | When you’ll use it |
|----------|---------------------|---------------------|
| **Meta (Facebook & Instagram Lead Ads)** | One URL + a **Verify Token**. | In the Meta app: Webhooks → Page → leadgen → Callback URL + Verify token. |
| **LinkedIn (Lead Gen Forms)** | One URL. | In the LinkedIn Developer App: Webhooks → register URL. |
| **Meta – Messenger / Instagram DMs** (optional) | One URL (same or separate). | When you add Messenger/Instagram and subscribe to **messages** (Part 1.7). |
| **Twilio – missed call** (optional) | One URL for **Status Callback**. | Twilio phone number → Voice → Status Callback URL (Part 9). |
| **360dialog (WhatsApp inbound)** | One URL. | 360dialog dashboard → Webhook URL for inbound messages. |
| **Website forms** | One URL. | Point form submit action to this URL (no new account). |

---

# Part 1 — Meta (Facebook & Instagram Lead Ads + optional DMs)

**Why:** Capture leads from Facebook and Instagram **lead forms** (and optionally from **Facebook Messenger** and **Instagram DMs**).

We do **not** assume you have any Meta accounts. Follow the steps below to create everything from scratch.

---

## 1.1 Meta Business Manager (the “container”)

- Go to **[business.facebook.com](https://business.facebook.com)**.
- If you don’t have a Business Manager yet:
  - Click **Create account** (or **Create Business**).
  - Enter **business name** (e.g. Social Funnel Limited), your **name**, and **business email** (e.g. info@socialfunnel.agency).
  - Complete the flow. This creates the **Business Manager** — the container that will hold your **Pages**, **Ad Accounts**, and **Apps**.
- If you already have a Business Manager, log in and go to **Business Settings**.
- Add any team members who need access (e.g. **Admin**) via **Users** → **People**.

**Summary:** Everything below (Page, Ad Account, App) will be created or linked **inside** this Business Manager. The **Ad Account** is **not** the same as the Business Manager: the Business Manager **contains** the Ad Account(s) and Page(s).

---

## 1.2 Facebook Page

- In **Business Manager** → **Accounts** → **Pages**:
  - If you don’t have a Page: click **Add** → **Create a new Page** and follow the steps (name, category, etc.). This is the **Facebook Page** that will be linked to your lead ad campaigns (and optionally to Messenger).
  - If you already have a Page: click **Add** → **Add an existing Page** and claim it.
- Remember this Page: it is the **“lead form destination”** Page. When you create a Lead Ad campaign in Ads Manager, you choose this Page. All lead forms for that campaign will be tied to this Page.

---

## 1.3 Ad Account (where campaigns run)

- In **Business Manager** → **Accounts** → **Ad accounts**:
  - If you don’t have an Ad account: click **Add** → **Create a new ad account** (name it e.g. “Social Funnel – Lead Ads”). You may need to add payment method later when you run ads.
  - If you already have an Ad account: click **Add** → **Add an existing ad account** and link it.
- This **Ad account** is where you will create **Lead Ad** campaigns. It is **separate** from the Business Manager: the Business Manager **owns** this Ad account and the Page.

---

## 1.4 Meta Developer App (for Lead Ads webhooks — and optional DMs)

All of this is done on **[developers.facebook.com](https://developers.facebook.com)**. Use a **Facebook account** that has access to Social Funnel’s Business Manager (e.g. the same one you used above).

**Step A – Create the app**

- Go to **developers.facebook.com** → **My Apps** → **Create App**.
- Choose **Business** as the app type → **Next**.
- App name: e.g. **“Acquisition OS – Social Funnel”**. Contact email: Social Funnel’s email. Business account: leave default or select if prompted.
- **Create App**. You are now in the **App Dashboard** for this app.

**Step B – Link the app to your Business Manager (do this on business.facebook.com)**

- Open a new tab and go to **[business.facebook.com](https://business.facebook.com)** → **Business Settings** → **Accounts** → **Apps**.
- Click **Add** → **Add an existing app** (or **Connect an app**).
- Select the app you just created (**Acquisition OS – Social Funnel**). Confirm.
- The app is now **linked** to your Business Manager. All further app configuration is back on **developers.facebook.com** in the **App Dashboard**.

**Step C – Add Webhooks and subscribe to Lead Ads (back on developers.facebook.com)**

- In the **App Dashboard** → **Add Product** → find **Webhooks** → **Set up**.
- Under **Webhooks**, select **Page** (not User).
- **Do not enter the Callback URL or Verify token yet.** We will send you both **after the build is deployed**. For now, you can add the Webhooks product and note that you will subscribe to **leadgen** when we provide the URL. When we do, you will:
  - Enter **Callback URL:** the URL we give you (e.g. `https://…/api/v1/webhooks/meta-leadgen`).
  - Enter **Verify token:** the secret value we send you (same as in our backend env).
  - Tick **leadgen** under **Subscribe to fields**, then Save. Meta will then send a verification request; our live endpoint will respond and it will show as **Verified**.

**Step D – Permissions (App Dashboard)**

- Go to **App Review** (or **Use cases** / **Permissions and features** in the dashboard).
- Ensure these permissions are **requested** (and approved where required):  
  `lead_retrieval`, `ads_management`, `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`.
- For development you may have limited access; for production, complete any **App Review** steps Meta asks for.

**Step E – Install the app on your Facebook Page (once per Page)**

- You only do this **once per Page** that will be used for lead ads. You do **not** do it again for each new ad.
- In **Business Manager** → **Accounts** → **Pages** → select your Page → **Assign partners** / **Page access** (or go to the Page’s **Settings** → **Apps**).
- Add the **Acquisition OS – Social Funnel** app to this Page (so the Page can send leadgen events to our webhook).
- If you have more than one Page that will run lead ads, repeat for each of those Pages.

**Step F – (Optional) Facebook and Instagram DMs**

If you want to capture **inbound DMs** (Facebook Messenger and Instagram direct messages) as leads — same idea as WhatsApp inbound — follow the **full guide in Part 1.7** below. Otherwise skip to section 1.5.

---

## 1.5 Confirm Page and Ad Account are in the same Business Manager

- In **Business Manager** ([business.facebook.com](https://business.facebook.com)) → **Accounts** → **Pages** and **Ad accounts**.
- Confirm the **Facebook Page** you use for lead ads and the **Ad account** where you run (or will run) lead ad campaigns are both **in this same Business Manager** that now **owns the app** (from step 1.4 Step B).
- Lead ad forms are always created **inside** an Ad account and tied to a Page. Both must be in the Business Manager that has the app linked.

---

## 1.6 Handover to developer (Meta)

Provide the developer (securely):

- **App ID** and **App Secret** (App Dashboard → **Settings** → **Basic**).
- **Page Access Token** with `leadgen` and `pages_read_engagement` for the Page that has lead ads (generated from App Dashboard or Graph API Explorer, with the correct permissions).
- The **Verify Token** (the same secret word you entered in the Webhooks subscription).

**Facebook and Instagram:** One setup covers **both** Facebook Lead Ads and **Instagram Lead Ads** (same leadgen webhook). No separate Instagram-only setup for lead forms.

---

## 1.7 Facebook and Instagram DMs (Messenger + Instagram Messaging) — full setup guide

**Why:** Capture **inbound direct messages** when someone messages your **Facebook Page** (Messenger) or your **Instagram business account** (Instagram DMs). Those conversations are ingested as leads and get the same 60-second response and pipeline treatment (like WhatsApp inbound).

Use the **same** Meta Developer App you created in section 1.4. You do **not** create a second app.

---

### 1.7.1 Add the Messenger product (Facebook DMs)

- Go to **[developers.facebook.com](https://developers.facebook.com)** → **My Apps** → open **Acquisition OS – Social Funnel**.
- In the **App Dashboard** → **Add Product** (or **Products** in the left menu).
- Find **Messenger** → **Set up**.
- Under **Messenger** you’ll see **Webhooks**. Click **Add callback URL** (or **Configure** if you already have Webhooks for the Page).
- **Callback URL:** Use the **same** n8n URL we gave you for Meta (e.g. `https://your-n8n.com/webhook/meta-leadgen`), **or** we will give you a **second** URL (e.g. `https://your-n8n.com/webhook/meta-messenger`) if we want to separate Lead Ads and Messenger in our workflows. The developer will tell you which to use.
- **Verify token:** Use the **same** verify token you used for Lead Ads (the secret word we agreed on).
- **Subscribe to fields:** Tick **messages** (required for receiving DMs). Optionally **messaging_postbacks**, **messaging_optins** if we use buttons or opt-in. The developer will confirm.
- Click **Verify and Save**. Meta will send a GET request to the URL; our endpoint must respond with the challenge so it shows as verified.
- **Generate Page token:** In the same Messenger section, under **Token Generation**, select your **Page** and generate a **Page Access Token**. Ensure it has **pages_messaging** (and **pages_manage_metadata**, **pages_read_engagement** if not already). Save this token — we need it to send replies and to associate incoming messages with your Page.
- **Subscribe the Page to the app:** Under **Webhooks** → **Page** → ensure your Page is **subscribed** (you may have done this when you subscribed to **leadgen**). For Messenger we need the same Page subscribed with **messages** enabled.

---

### 1.7.2 Add the Instagram product (Instagram DMs)

- In the **App Dashboard** → **Add Product** → find **Instagram** (or **Instagram Graph API** / **Instagram Messaging**).
- Click **Set up**.
- **Connect Instagram account:** You must connect an **Instagram Business** or **Creator** account to your **Facebook Page**. (If your Instagram isn’t connected yet: go to the Page’s **Settings** → **Instagram** → connect the account.) Only Instagram accounts connected to a Facebook Page can use the Messaging API.
- Under **Instagram** → **Webhooks** (or **Messaging**): add a **Callback URL** and **Verify token**. We can use the **same** Meta callback URL (our backend/n8n will distinguish Lead Ads vs Messenger vs Instagram by payload). Or we give you a dedicated URL (e.g. `https://your-n8n.com/webhook/meta-instagram`). The developer will confirm.
- **Subscribe to fields:** Tick **messages** (and any other fields the UI shows for Instagram messaging).
- **Generate Instagram token:** In the Instagram product section, generate an **Instagram access token** (or use the Page token with Instagram permissions). We need this to send replies on Instagram and to identify the Instagram account. Permissions typically include **instagram_basic**, **instagram_manage_messages**, **pages_show_list**, **pages_manage_metadata**.
- Complete any **App Review** steps Meta asks for (e.g. **instagram_manage_messages** may require review for production).

---

### 1.7.3 Permissions (App Review)

- In **App Dashboard** → **App Review** (or **Use cases** / **Permissions and features**).
- Ensure these are **requested** (and approved where required):
  - **pages_messaging** (Messenger)
  - **instagram_basic**, **instagram_manage_messages** (Instagram DMs)
  - **pages_show_list**, **pages_manage_metadata**, **pages_read_engagement**
- For production, set the app to **Live** and complete any verification Meta requires.

---

### 1.7.4 Handover to developer (Facebook & Instagram DMs)

Provide the developer (securely), **in addition to** the Lead Ads handover (1.6):

- **Same App ID and App Secret** (no change).
- **Page Access Token** that has **pages_messaging** (so we can receive and reply to Messenger). If you generated a new token in 1.7.1, provide that one.
- **Instagram access token** (or confirmation that the Page token includes Instagram permissions) so we can receive and reply to Instagram DMs.
- **Instagram Business Account ID** (numeric ID of the Instagram account connected to the Page). The developer can also get this from the API; if you see it in the dashboard, include it.
- Confirmation of which **callback URL(s)** you used for Messenger and for Instagram (same URL or two separate URLs).

Once we have this, we can ingest Messenger and Instagram DMs as leads and trigger the 60-second response on those channels.

---

# Part 2 — WhatsApp (60-second response + inbound messages)

**Why:** (1) Send the first response within 60 seconds (primary channel). (2) Receive **inbound** messages when someone messages your dedicated number — we ingest those as leads and respond.

We do **not** assume you have a 360dialog or WhatsApp Business Account. Create both from scratch below.

---

## 2.1 360dialog account (BSP for WhatsApp Business API)

- Go to **[360dialog.com](https://www.360dialog.com)**.
- Do **not** use the main **“Get Started”** button (that may lead to a paid onboarding flow).
- Click **Login** (top right). On the login page, use **Sign up** / **Register** to create a new account.
- Register with **Social Funnel’s business email** (e.g. info@socialfunnel.agency). Complete any email verification and profile steps.

---

## 2.2 WhatsApp Business Account (WABA) and phone number

- In the **360dialog dashboard** (or **Client Hub**), find **“Create new WABA”** or **“Embedded Signup”** (or similar).
- Follow the flow. You have two options:
  - **Register a new phone number** for WhatsApp Business (dedicated number for lead response), or  
  - **Use an existing number** you want to dedicate (e.g. the number on [socialfunnel.agency](https://socialfunnel.agency/)).  
  If you use an existing number, it will be **migrated** to WhatsApp Business and should no longer be used as a regular WhatsApp number — use it only for Acquisition OS.
- Complete the flow. 360dialog will create the **WhatsApp Business Account (WABA)** linked to that number.
- **Business verification:** 360dialog will guide you through **Meta’s Business Verification** (company name, address, website, documents). This can take a few days. You can usually get the **API key** and **phone number** before verification is fully approved; **sending** (especially to users who haven’t messaged first) may be limited until verification is done. Complete verification for full production use.

---

## 2.3 API key and webhook for inbound messages

- In 360dialog: create an **API key** for the integration (dashboard or Client Hub).
- **Do not set the inbound messages webhook URL yet.** We will send you the URL after the build is deployed. When we do, you will add it in 360dialog so that when someone messages your WABA number, 360dialog POSTs to that URL and we ingest the lead.

---

## 2.4 Handover to developer (WhatsApp)

Provide the developer (securely):

- **360dialog API key**
- **WhatsApp Business phone number** in **E.164** format (e.g. +254…)

---

# Part 3 — Email (60-second fallback)

**Why:** When we can’t respond on WhatsApp (e.g. no WhatsApp opt-in), we send the first response by **email** within 60 seconds. We send **from** your domain so it’s recognizable and trustworthy.

---

## 3.1 SendGrid account

- Go to **[sendgrid.com](https://sendgrid.com)** → **Start for Free** or **Sign Up**.
- Register with **Social Funnel’s business email** (e.g. info@socialfunnel.agency).
- Complete sign-up: verify email, add phone/2FA if asked, enter company details.

---

## 3.2 Authenticate your domain and set the “From” address

- In SendGrid: **Settings** → **Sender Authentication**.
- **Authenticate a domain:** use **socialfunnel.agency** (Social Funnel’s website). Add the DNS records SendGrid gives you to your domain so SendGrid can send on behalf of @socialfunnel.agency. This is **domain authentication** — it proves we’re allowed to send from that domain and improves deliverability.
- The **From address** we will use for the 60-second response (and follow-ups) will be an address **on that domain**, e.g. **info@socialfunnel.agency**. So we’re not “just” verifying the domain — we actually **send** from that email. You don’t need a separate “response address”; we use **info@socialfunnel.agency** (or another address you prefer on the same domain).

---

## 3.3 API key

- **Settings** → **API Keys** → **Create API Key**.
- Name (e.g. “Acquisition OS”). Permissions: **Restricted Access** → enable at least **Mail Send** (and **Template Engine** if we use templates).
- Create and **copy the key once** (it won’t be shown again).

---

## 3.4 Handover to developer (Email)

Provide the developer (securely):

- **SendGrid API key**
- **Verified From address** we will use (e.g. **info@socialfunnel.agency**)

---

# Part 4 — LinkedIn (Lead Gen Forms from LinkedIn Ads)

**Why:** Capture leads from **LinkedIn Lead Gen Forms** (when someone submits a form on a LinkedIn ad).

We do **not** assume you have a LinkedIn Developer App. We assume you have a **LinkedIn (user) account** and a **LinkedIn Company Page** (e.g. the one for Social Funnel). Everything else is set up from scratch below.

**Clarification:** Your **LinkedIn account** = the person’s profile (e.g. the one that manages Social Funnel). **Campaign Manager** = the **website** where you manage ads ([linkedin.com/campaignmanager](https://www.linkedin.com/campaignmanager)). The **Ad account** = the **account inside** Campaign Manager (where campaigns and billing live). So: you **log in** with your LinkedIn account; inside Campaign Manager you see **Ad account(s)**. They are not the same thing.

---

## 4.1 LinkedIn Campaign Manager and Ad account

- Go to **[linkedin.com/campaignmanager](https://www.linkedin.com/campaignmanager)**.
- Log in with the **LinkedIn account** that has (Super) Admin access to Social Funnel’s **Ad account**.
- If you don’t have an Ad account yet: create one and link it to your **Company Page** (Social Funnel’s). This is where you will run Lead Gen Form campaigns.
- Note which **Company Page** and **Ad account** you use — we’ll need to link the Developer App to that Company Page.

---

## 4.2 LinkedIn Developer Application (from scratch)

- Go to **[linkedin.com/developers](https://www.linkedin.com/developers/apps)**.
- **Create app** (do not assume an existing app). Click **Create app**.
- Fill in: **App name** (e.g. “Acquisition OS – Social Funnel”), **LinkedIn Page** → select **Social Funnel’s Company Page** (this **links** the app to the Company Page — it’s done here in the Developer Portal, not in Campaign Manager). Upload a logo if required, agree to terms.
- Create the app. You are now in the **App Dashboard** for this app.

---

## 4.3 Products (Sign In with LinkedIn + Marketing Developer Platform)

- In the **App Dashboard** → **Products** (or **Products and services**).
- **Sign In with LinkedIn:** This product lets apps use LinkedIn for login. Request it if it’s listed; some Marketing API features depend on it.
- **Marketing Developer Platform:** This is the product that gives access to **Marketing API** (ads, Lead Gen, Lead Sync). Request **Marketing Developer Platform** so we can use the Lead Gen Forms API and webhooks.
- For each product: click **Request access** (or similar), accept terms. Wait for approval if required.

---

## 4.4 Permissions

- In the app → **Permissions** (or **Auth**).
- Ensure **r_marketing_leadgen_automation** and **rw_ads** (or the equivalent for Lead Gen / Lead Sync) are requested and approved. Adjust as per LinkedIn’s current product names.

---

## 4.5 Webhooks

- **Do not register the webhook URL yet.** We will send you the URL after the build is deployed. When we do, you will go to the app → **Webhooks**, enter the URL we give you, and Save. LinkedIn will send a validation request; our live endpoint will respond with the correct challenge and it will show as verified.

---

## 4.6 Company verification

- LinkedIn may require **company verification** for the app or Company Page to use the Marketing API in production. Complete any steps they ask for (e.g. verify domain, confirm company details).

---

## 4.7 Handover to developer (LinkedIn)

Provide the developer (securely):

- **Client ID** and **Client Secret** (App Dashboard → **Auth** or **Credentials**).
- **Ad account ID** and **Company Page** (or Page ID) used for Lead Gen campaigns (so we can map leads correctly).

---

# Part 5 — OpenAI (personalized 60s messages + lead scoring)

**Why:** We use **GPT-4o-mini** to (1) generate **personalized** first-response messages (60-second response), (2) **score** leads (e.g. 1–10), and (3) support other text/classification tasks in the pipeline.

---

## 5.1 OpenAI account and API key

- Go to **[platform.openai.com](https://platform.openai.com)** (or [openai.com](https://openai.com) and sign in / sign up).
- Create an account (or use an existing one) with **Social Funnel’s business email** if possible, or an email that Social Funnel controls.
- In the dashboard: **API keys** (or **Settings** → **API keys**) → **Create new secret key**. Name it (e.g. “Acquisition OS”). Copy the key once; store it securely.
- Ensure the account has access to **GPT-4o-mini** (or the model we will use). Billing may need to be set up for API usage.

---

## 5.2 Handover to developer

Provide the developer (securely):

- **OpenAI API key**

---

# Part 6 — Calendly (booking calls and site visits)

**Why:** Leads book calls or site visits via Calendly. When someone books (or reschedules), Calendly sends a **webhook** to us so we can update the lead’s pipeline stage and send confirmations/reminders.

---

## 6.1 Calendly account

- Go to **[calendly.com](https://calendly.com)** → **Sign up** (or **Get started**).
- Create the account with **Social Funnel’s business email** (or a shared calendar email Social Funnel controls).
- Create at least one **event type** (e.g. “Strategy call”, “Site visit”) and set availability. You can refine this later; we only need the account and webhook setup for the pipeline.

---

## 6.2 Webhook (developer will guide)

- In Calendly: **Integrations** (or **Account** → **Integrations**) → **Webhooks** (or **Developer**).
- Create a webhook subscription: we will give you the **URL** to send booking (and reschedule/cancel) events to. Calendly will send POST requests when someone books or changes a booking; our n8n or backend will consume these and update the lead.
- If Calendly asks for a **signing key** or **secret**, save it and share it with the developer so we can verify requests.

---

## 6.3 Handover to developer

Provide the developer (securely):

- **Calendly webhook URL** you configured (or confirm the URL we gave you is the one you used).
- Any **webhook signing secret** or **API token** if we need it for verification or to fetch booking details.

---

# Part 7 — Slack (team notifications and lead alerts)

**Why:** **Slack** is where we **notify** the Social Funnel team about new or scored leads (e.g. “New lead: John, score 8”). It can also be used for **alerts** (e.g. “Lead not contacted in 5 minutes”) and, if we build it, **assignment** of leads to team members. It is **not** the place we store leads — that’s our backend; Slack is for **visibility and action**.

---

## 7.1 Slack workspace and app (or Incoming Webhook)

- If Social Funnel doesn’t have a **Slack workspace**, create one at [slack.com](https://slack.com) with a **Social Funnel–owned** email.
- To post messages from n8n/our backend, we need either:
  - An **Incoming Webhook** (simple: one URL per channel), or  
  - A **Slack App** with **Bot** scope and **chat:write** (more flexible).
- **Option A – Incoming Webhook:** In Slack → **Apps** → **Manage** → **Build** → **Create New App** → **From scratch** → name it (e.g. “Acquisition OS”). Add **Incoming Webhooks** → **Activate** → **Add New Webhook to Workspace** → choose the channel (e.g. #leads). Copy the **Webhook URL**.
- **Option B – Slack App with Bot:** Create an app as above, add **Bot** scope **chat:write**, install to workspace, copy **Bot User OAuth Token** (starts with `xoxb-`).

---

## 7.2 Handover to developer

Provide the developer (securely):

- **Slack Incoming Webhook URL** (if using Option A), or  
- **Slack Bot User OAuth Token** and the **channel ID** or **channel name** we should post to (if using Option B).

---

# Part 8 — Website forms (no new account)

**Why:** Leads that come from **web forms** (landing pages, contact forms, etc.) must also be ingested.

- **No new account** is required. We will give you **one webhook URL** (e.g. an n8n URL like `https://your-n8n.com/webhook/web-form`).
- You (or your web developer) point **every form** that should feed Acquisition OS to this URL: when the user submits the form, the form sends a POST request with fields such as name, email, phone, source. We then ingest that into our backend and run the same 60-second response and pipeline.
- If the form is on Wix, WordPress, Typeform, or custom HTML, it must be configured to **POST** to that URL (or use a form tool that can “Send to webhook”). The developer will provide the exact URL and expected field names.

---

# Part 9 — Missed call capture (Twilio) — full setup guide

**Why:** When someone **calls** Social Funnel’s number and the call is **missed** (no answer, busy, etc.), we want to (1) create or update a **lead** using the caller’s phone number (if available), and (2) send an automatic **follow-up** (e.g. “We missed your call — reply here or book a call”) via WhatsApp or email. Twilio gives us a phone number and sends a **webhook** when a call ends (including “no-answer”), so we can do this without a human picking up.

We do **not** assume you have a Twilio account. Follow the steps below from scratch. This part is **optional** — only do it if you want missed-call capture in the pipeline.

---

## 9.1 Twilio account

- Go to **[twilio.com](https://www.twilio.com)**.
- Click **Sign up** (or **Get started**).
- Register with **Social Funnel’s business email** (e.g. info@socialfunnel.agency).
- Complete sign-up: verify email and phone. Twilio may ask for a small verification charge or prepay balance to activate the account.

---

## 9.2 Buy a phone number (for lead calls)

- In the **Twilio Console** (dashboard) → **Phone Numbers** → **Manage** → **Buy a number** (or **Get a number**).
- Select your **country** (e.g. Kenya +254 if you want a local number for leads).
- Choose a number with **Voice** capability (required). SMS is optional if you only need missed-call capture.
- Complete the purchase. The number will appear under **Phone Numbers** → **Manage** → **Active numbers**. Note the number in **E.164** format (e.g. +254…).

**Tip:** Use a number **dedicated** to lead calls (e.g. “Contact us” on the website or ads) so all inbound calls are potential leads. If you already have a number elsewhere, you can often **port** it to Twilio (see Twilio’s porting guide); otherwise use this new number and update your website/ads to show it.

---

## 9.3 Configure the number: Voice webhook + Status Callback (missed call)

When someone calls this number, Twilio will (1) hit a **Voice URL** (we can give you one that just hangs up or plays a short message), and (2) when the call **ends**, Twilio will send a **Status Callback** POST to a URL we provide. We use that to create/update the lead and trigger the follow-up.

- **Do not set the Voice URL or Status Callback URL yet.** We will send you both URLs after the build is deployed. When we do, you will go to Twilio Console → **Phone Numbers** → your number → **Voice Configuration**, enter the URLs we give you, and save.

---

## 9.4 Handover to developer (Twilio)

Provide the developer (securely):

- **Account SID** (Twilio Console → **Account** → **API keys & tokens** or dashboard home). Looks like `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
- **Auth Token** (same place; keep it secret). The developer will use these to validate webhook requests and to call Twilio’s API if we need to (e.g. fetch call details).
- **Twilio phone number** in **E.164** format (e.g. +254XXXXXXXXX). This is the number you configured in 9.2–9.3 (the “lead call” number).
- Confirmation that the **Status Callback URL** you entered in 9.3 is the one the developer gave you (so we receive `no-answer` / `busy` / `completed` events and can create the lead and send the follow-up).

Once we have this, we’ll process incoming status callbacks, create or update a lead by **From** (caller ID), and trigger the “We missed your call” follow-up via WhatsApp or email.

---

# Summary table — who opens what and what to hand over

| # | Purpose | Account / service | Opened by | Handover to developer |
|---|---------|-------------------|-----------|------------------------|
| 1 | FB/IG lead capture | Meta Business Manager, Page, Ad Account, Developer App | Social Funnel | App ID, App Secret, Page token (leadgen), Verify Token |
| 1b | FB/IG DMs (Messenger + Instagram) | Same Meta app; add Messenger + Instagram products | Social Funnel | Page token with pages_messaging; Instagram token; Instagram Business Account ID; callback URL(s) used |
| 2 | 60s response + WhatsApp inbound | 360dialog + WABA | Social Funnel | 360dialog API key, WhatsApp number (E.164), inbound webhook URL set in 360dialog |
| 3 | 60s fallback (email) | SendGrid | Social Funnel | SendGrid API key, verified From address (e.g. info@socialfunnel.agency) |
| 4 | LinkedIn lead capture | LinkedIn Campaign Manager, Ad account, Developer App | Social Funnel | Client ID, Client Secret, Ad/Company IDs |
| 5 | Personalized messages + scoring | OpenAI | Social Funnel | OpenAI API key |
| 6 | Booking (calls / site visits) | Calendly | Social Funnel | Webhook URL configured, signing secret/token if any |
| 7 | Team notifications / alerts | Slack | Social Funnel | Incoming Webhook URL or Bot token + channel |
| 8 | Web forms | — | — | No account; we provide one ingest URL |
| 9 | Missed call capture | Twilio | Social Funnel | Account SID, Auth Token, Twilio phone number (E.164), Status Callback URL configured |

---

# Contract reminder (Clause 13)

- All accounts must be **owned and controlled by the Company** (Social Funnel Limited).
- All API credentials must be **documented and handed over** to the Company; the developer must not retain exclusive access.

---

*Last updated: March 2026 — for Acquisition OS internal build. Align with Make.com Build Guide (Full scenario map + Part 2) once that document is available.*
