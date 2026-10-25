# 23-lead-form-to-whatsapp · Fills in the Facebook lead form, then answers the first message on WhatsApp

Gemini 3.8 Flash (thinking low) · rep 1 · PASS · ended: lead_done · $0.0293

**Lead:** (sent the lead form on Facebook: intent: buy; full_name: Jordan Avery; email: jordan.avery@example.com; phone_number: +16025550142)

**Ava** (reply; 3507 ms; stage_changed): I'm Ava with Agave Lane Realty. Which city or neighborhood are you hoping to buy in?

**Lead:** hi! mostly gilbert or chandler

**Ava** (reply; 5238 ms): Gilbert and Chandler are great choices. What price range do you have in mind for your budget? [Under $500k] [$500k-$700k] [$700k+] [Other]

**Lead:** Around $450k, I think. I'm pre-approved already.

**Ava** (reply; 3770 ms): Having that pre-approval ready is wonderful. What type of property are you looking for, such as a single-family home, condo, or townhome? [Single-family] [Townhome] [Condo] [Other]

**Lead:** Townhouse or a small house would be great, ideally 3 bedrooms

**Ava** (reply; 3608 ms): Got it. When are you hoping to move into your new home? [Within 1-2 months] [Within 3-6 months] [Just browsing] [Other]

**Lead:** Within 3-6 months would work. I'd like to be moved in by April if possible.

**Ava** (reply; 3472 ms; stage_changed): Thanks for sharing those details! You're looking for a 3-bedroom townhouse or single-family home in Gilbert or Chandler around $450k, moving within 3 to 6 months. We'd love to set up a 20-minute buyer consultation call with Maya Torres to go over next steps. Which of these times works best for you? [Tomorrow 9:00 AM] [Sat, Oct 24 1:00 PM] [Mon, Oct 26 9:00 AM] [Other]

**Lead:** Sat, Oct 24 1:00 PM works for me!

**Ava** (reply; 4226 ms; booked): You're all set for Saturday, October 24 at 1:00 PM! Maya Torres will call you then, and you'll receive a reminder before the call.

**Lead:** Sounds great, thanks! Looking forward to talking with Maya.

**Ava** (reply; 3612 ms): You're very welcome, Jordan! Have a wonderful rest of your week, and we'll talk soon.

## Lead record

```json
{
  "name": "Jordan Avery",
  "email": "jordan.avery@example.com",
  "phone": "+16025550142",
  "language": "en",
  "stage": "booked",
  "facts": {
    "intent": "buy",
    "area": "Gilbert or Chandler",
    "budget": "$450k",
    "financing": "pre-approved",
    "property_type": "townhouse or single-family",
    "bedrooms": "3",
    "timeline": "3-6 months (by April)"
  },
  "is_hot": false,
  "opted_out": false,
  "booking": {
    "meeting": "Buyer consultation call",
    "agent": "Maya Torres",
    "start": "2026-10-24T20:00:00.000Z"
  }
}
```

## Checks

- ✅ answers valid
- ✅ intent buy — buy
- ✅ fact area ~ /gilbert|chandler/ — Gilbert or Chandler
- ✅ fact budget ~ /450|400k?\s?-\s?\$?500/ — $450k
- ✅ stage qualified or booked — booked
- ✅ hand-off false
- ✅ never /^(hi|hello|hey)\b/
- ✅ never /thanks? (you )?for (your|the) (request|interest|form)/
- ✅ never /(what is|what's|may i have|could i get|can i get) (your|the best) (full )?(name|phone|number|email)/

Style: {"replies":7,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
