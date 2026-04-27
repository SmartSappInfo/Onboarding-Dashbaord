A **real estate CRM** should manage the full lifecycle:

**enquiry → lead qualification → property matching → viewing → offer → negotiation → transaction → closing → repeat/referral**

## 1. Client / Contact Dataset

For buyers, sellers, renters, landlords, investors, and agents.

**Key fields**

* Client ID
* Full name / company name
* Phone, email, WhatsApp
* Client type:

  * Buyer
  * Seller
  * Tenant
  * Landlord
  * Investor
  * Developer
* Preferred contact channel
* Preferred contact time
* Location
* Budget range
* Status:

  * New lead
  * Active
  * Converted
  * Dormant
  * Lost

---

## 2. Property Preference Dataset

Very important for matching clients to listings.

**Key fields**

* Client ID
* Property purpose:

  * Buy
  * Rent
  * Lease
  * Invest
* Property type:

  * Apartment
  * House
  * Office
  * Shop
  * Warehouse
  * Land
* Preferred locations
* Budget minimum / maximum
* Number of bedrooms
* Bathrooms
* Parking needs
* Furnished/unfurnished
* Security preference
* Road access preference
* School / work proximity
* Move-in timeline
* Must-have features
* Nice-to-have features

---

## 3. Enquiries / Leads Dataset

Captures people who show interest.

**Key fields**

* Enquiry ID
* Enquiry date
* Source:

  * Website
  * Walk-in
  * Referral
  * Social media
  * Property portal
  * WhatsApp
  * Billboard
* Interested property
* Interested location
* Budget
* Enquiry type:

  * Buying
  * Renting
  * Selling
  * Valuation
  * Property management
* Assigned agent
* Lead status:

  * New
  * Contacted
  * Qualified
  * Viewing scheduled
  * Offer made
  * Converted
  * Lost

---

## 4. Property Listings Dataset

The agency’s inventory.

**Key fields**

* Property ID
* Title
* Property type
* Listing type:

  * Sale
  * Rent
  * Lease
* Address / area
* GPS/location
* Price
* Bedrooms/bathrooms
* Land size / floor area
* Photos/videos
* Description
* Amenities
* Owner/landlord ID
* Listing status:

  * Available
  * Reserved
  * Under offer
  * Sold
  * Rented
  * Withdrawn
* Date listed
* Agent responsible

---

## 5. Property Owner / Landlord Dataset

Useful when the agency represents sellers or landlords.

**Key fields**

* Owner ID
* Name
* Contact info
* Ownership documents status
* Preferred sale/rent price
* Minimum acceptable price
* Commission agreement
* Property IDs owned
* Payment details
* Communication preferences

---

## 6. Viewing / Site Visit Dataset

Tracks inspections and property tours.

**Key fields**

* Viewing ID
* Client ID
* Property ID
* Agent ID
* Viewing date/time
* Viewing type:

  * Physical visit
  * Virtual tour
* Attendance status:

  * Scheduled
  * Completed
  * Missed
  * Rescheduled
* Client feedback
* Interest level
* Follow-up date

---

## 7. Offer & Negotiation Dataset

Tracks serious buyer/renter intent.

**Key fields**

* Offer ID
* Client ID
* Property ID
* Offer amount
* Asking price
* Counteroffer amount
* Offer date
* Negotiation status:

  * Submitted
  * Countered
  * Accepted
  * Rejected
  * Withdrawn
* Conditions:

  * Inspection
  * Financing
  * Move-in date
  * Repairs
* Notes

---

## 8. Transaction / Deal Dataset

Once an offer is accepted.

**Key fields**

* Deal ID
* Client ID
* Property ID
* Deal type:

  * Sale
  * Rent
  * Lease
* Deal value
* Commission amount
* Commission percentage
* Deposit paid
* Balance due
* Payment status
* Closing date
* Deal status:

  * Pending
  * Documentation
  * Payment in progress
  * Closed
  * Cancelled

---

## 9. Documentation Dataset

Tracks legal and transaction documents.

**Key fields**

* Document ID
* Property ID
* Client ID
* Deal ID
* Document type:

  * Title deed
  * Site plan
  * Lease agreement
  * Sale agreement
  * ID document
  * Payment receipt
  * Commission agreement
* Submission status
* Verification status
* Expiry date if applicable
* Uploaded date

---

## 10. Communication / Follow-up Dataset

Tracks all agent-client interactions.

**Key fields**

* Communication ID
* Client ID
* Property ID
* Agent ID
* Channel:

  * Call
  * WhatsApp
  * Email
  * SMS
  * Meeting
* Date/time
* Summary
* Follow-up required
* Next follow-up date
* Outcome

---

## 11. Agent / Staff Dataset

For performance tracking.

**Key fields**

* Agent ID
* Name
* Phone/email
* Branch/location
* Specialization:

  * Residential
  * Commercial
  * Land
  * Rentals
  * Luxury
* Assigned leads
* Assigned listings
* Deals closed
* Commission earned

---

## 12. Loyalty / Referral Dataset

Real estate loyalty is mostly based on repeat transactions and referrals.

**Key fields**

* Client ID
* Repeat client status
* Number of purchases/rentals
* Total transaction value
* Referral source
* People referred
* Referral reward status
* Investor status
* Preferred agent
* Last transaction date
* Re-engagement probability

**Useful categories**

* First-time buyer
* Repeat tenant
* Landlord client
* Property investor
* High-referral client
* Dormant client

---

## 13. Client Preferences Dataset

This should be a separate dataset because preferences drive property matching.

**Key fields**

* Preferred neighborhoods
* Preferred property type
* Budget flexibility
* Financing status:

  * Cash buyer
  * Mortgage/pre-approved
  * Needs financing
* Urgency:

  * Immediate
  * 1–3 months
  * 3–6 months
  * Just browsing
* Lifestyle preferences:

  * Family-friendly
  * Gated community
  * Close to work
  * Close to schools
  * Quiet area
  * High nightlife area
* Investment preferences:

  * Rental yield
  * Capital appreciation
  * Short-let/Airbnb potential
  * Land banking

---

## 14. Marketing & Source Tracking Dataset

Useful for knowing which channels bring serious leads.

**Key fields**

* Campaign ID
* Source/channel
* Property promoted
* Leads generated
* Cost per lead
* Viewings booked
* Offers made
* Deals closed
* Conversion rate
* Revenue generated

---

## 15. Real Estate CRM Flow

```text
Enquiry
  ↓
Lead Qualification
  ↓
Preference Capture
  ↓
Property Matching
  ↓
Viewing / Site Visit
  ↓
Offer
  ↓
Negotiation
  ↓
Documentation
  ↓
Payment / Deposit
  ↓
Deal Closed
  ↓
Referral / Repeat Business Follow-up
```

## Most important real estate CRM datasets

For a strong real estate CRM, prioritize:

**clients, property preferences, enquiries, listings, viewings, offers, deals, documents, communications, agents, referrals, and marketing source tracking.**
