For **software companies (especially SaaS)**, the CRM is not just about sales—it connects **sales + product usage + support + revenue + retention**.

The lifecycle looks like:

**enquiry → lead → deal → onboarding → product usage → support → renewal/expansion → retention/churn**

Let’s break down the **datasets in a structured, product-ready way**.

---

# 💻 1. Account / Organization Dataset (B2B core)

Most SaaS CRMs are **account-based**.

**Key fields**

* Account ID
* Company name
* Industry
* Company size (employees, revenue)
* Location
* Website
* Plan type (Free, Basic, Pro, Enterprise)
* Account status:

  * Lead
  * Trial
  * Active
  * Suspended
  * Churned
* Signup date
* Renewal date
* Customer tier (SMB, Mid-market, Enterprise)

---

# 👤 2. Users / Contacts Dataset

People within each account.

**Key fields**

* User ID
* Account ID
* Name
* Email
* Role:

  * Admin
  * Manager
  * End user
* Job title
* Phone number
* Last login date
* Status:

  * Invited
  * Active
  * Inactive

---

# 📥 3. Enquiries / Leads Dataset

Top-of-funnel acquisition.

**Key fields**

* Lead ID
* Source:

  * Website signup
  * Demo request
  * Referral
  * Ads
  * Events
* Name / company
* Email / phone
* Use case / problem
* Company size
* Industry
* Budget (if known)
* Status:

  * New
  * Contacted
  * Qualified
  * Demo booked
  * Converted
  * Lost

---

# 🎯 4. Opportunities / Deals Dataset

Tracks sales pipeline.

**Key fields**

* Opportunity ID
* Account/Lead ID
* Deal value
* Plan/package
* Sales stage:

  * Qualification
  * Demo
  * Trial
  * Negotiation
  * Closed won
  * Closed lost
* Probability %
* Expected close date
* Assigned sales rep
* Competitors

---

# 🧪 5. Trial / Onboarding Dataset

Critical in SaaS.

**Key fields**

* Trial ID
* Account ID
* Trial start date
* Trial end date
* Onboarding status:

  * Not started
  * In progress
  * Completed
* Setup steps completed
* Activation milestone (e.g., first project created)
* Assigned onboarding manager
* Conversion status

---

# ⚙️ 6. Product Usage / Behavioral Dataset

This is what makes software CRMs unique.

**Key fields**

* Usage ID
* Account ID / User ID
* Feature used
* Frequency of use
* Session duration
* Last activity date
* Key actions completed
* Usage trends
* Engagement score

👉 Examples:

* Number of logins
* Projects created
* API calls
* Reports generated

---

# 📊 7. Feature Adoption Dataset

Tracks which features customers actually use.

**Key fields**

* Feature ID
* Account ID
* Feature usage status:

  * Not used
  * Trialing
  * Actively used
* Adoption date
* Depth of usage
* Drop-off points

---

# 💳 8. Subscription & Billing Dataset

Revenue engine of SaaS.

**Key fields**

* Subscription ID
* Account ID
* Plan name
* Pricing
* Billing cycle:

  * Monthly
  * Annual
* Start date
* Renewal date
* Payment status
* Upgrade/downgrade history
* Discounts applied
* Payment method

---

# 💰 9. Invoice & Payment Dataset

**Key fields**

* Invoice ID
* Account ID
* Amount billed
* Amount paid
* Outstanding balance
* Due date
* Payment status
* Payment method

---

# 📞 10. Support / Ticket Dataset

Customer success & retention driver.

**Key fields**

* Ticket ID
* Account ID
* User ID
* Issue type:

  * Bug
  * Feature request
  * Question
  * Complaint
* Priority level
* Status:

  * Open
  * In progress
  * Resolved
  * Escalated
* Resolution time
* Assigned support agent
* Satisfaction rating

---

# 📣 11. Communication Dataset

Tracks all interactions.

**Key fields**

* Communication ID
* Account ID
* User ID
* Channel:

  * Email
  * Chat
  * Call
  * In-app message
* Date/time
* Message summary
* Campaign (if marketing)
* Follow-up date

---

# 🎯 12. Marketing & Campaign Dataset

Tracks acquisition performance.

**Key fields**

* Campaign ID
* Channel:

  * Email
  * Ads
  * Social media
  * SEO
* Leads generated
* Cost per lead
* Conversion rate
* Revenue generated
* Campaign ROI

---

# 🧠 13. Customer Health / Analytics Dataset

This is crucial for retention.

**Key fields**

* Account ID
* Health score (0–100)
* Usage score
* Support score
* Payment reliability
* Engagement trend
* Churn risk:

  * Low
  * Medium
  * High

---

# 🔁 14. Churn & Retention Dataset

Tracks why customers leave or stay.

**Key fields**

* Account ID
* Churn date
* Churn reason:

  * Too expensive
  * Not enough value
  * Poor support
  * Switched competitor
* Retention actions taken
* Win-back attempts
* Reactivation status

---

# ❤️ 15. Loyalty / Expansion Dataset

Very important for SaaS growth.

**Key fields**

* Account ID
* Lifetime value (LTV)
* Total revenue
* Number of renewals
* Upsell history
* Cross-sell products
* Referral activity
* Advocacy status (case study, testimonial)

**Customer types**

* Free user
* Trial user
* Paying customer
* Power user
* Champion account
* At-risk account

---

# ⚙️ 16. Client Preferences Dataset

Helps personalize experience.

**Key fields**

* Preferred communication channel
* Preferred onboarding style:

  * Self-serve
  * Guided
* Feature interests
* Notification preferences
* Language
* Timezone
* Integration preferences (e.g., Slack, API, Zapier)

---

# 🔁 Software CRM Flow

```text
Lead / Enquiry
  ↓
Qualification
  ↓
Demo / Trial
  ↓
Onboarding
  ↓
Product Usage
  ↓
Subscription / Billing
  ↓
Support & Engagement
  ↓
Renewal / Expansion
  ↓
Retention or Churn
```

---

# 🧠 Key Insight

A software CRM is fundamentally about:

**acquisition + activation + usage + revenue + retention**

The most critical datasets are:

* Leads & opportunities (sales)
* Onboarding (activation)
* Product usage (behavior)
* Subscription & billing (revenue)
* Support (experience)
* Health & churn (retention)
