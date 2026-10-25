# 23-lead-form-to-whatsapp · Fills in the Facebook lead form, then answers the first message on WhatsApp

Gemini 3.8 Flash (thinking low) · rep 2 · PASS · ended: lead_done · $0.0167

**Lead:** (sent the lead form on Facebook: intent: buy; full_name: Jordan Avery; email: jordan.avery@example.com; phone_number: +16025550142)

**Ava** (reply; 3471 ms; stage_changed): I'm Ava, the virtual assistant at Agave Lane Realty. Which city or neighborhood are you hoping to buy in?

**Lead:** hi! mostly gilbert or chandler

**Ava** (reply; 3462 ms): Gilbert and Chandler are wonderful areas. What price range do you have in mind for your new home? [Under $400k] [$400k-$600k] [$600k-$800k] [Other]

**Lead:** Budget is around $450k

**Lead:** Pre-approved already too

**Ava** (reply; 4014 ms): Having that pre-approval ready is great! What type of home are you looking for, such as a single-family house, condo, or townhome? [Single-family] [Townhome] [Condo] [Other]

**Lead:** townhouse or small house is fine, 3 bedrooms would be ideal

**Ava** (reply; 3685 ms): Got it, a 3-bedroom townhome or small house. What timeline are you thinking for your move? [Within 1-2 months] [Within 3-6 months] [Just browsing] [Other]

**Lead:** Ideally by April if possible

**Ava** (reply; 3740 ms; stage_changed): Thank you, Jordan! We have all the details: looking for a 3-bedroom townhome or small house in Gilbert or Chandler around $450k, pre-approved, and aiming to move by April. An agent will be in touch with you during office hours to help get things started.

## Lead record

```json
{
  "name": "Jordan Avery",
  "email": "jordan.avery@example.com",
  "phone": "+16025550142",
  "language": "en",
  "stage": "qualified",
  "facts": {
    "intent": "buy",
    "area": "Gilbert or Chandler",
    "budget": "$450k",
    "financing": "pre-approved",
    "property_type": "townhouse or small house",
    "bedrooms": "3",
    "timeline": "by April"
  },
  "is_hot": false,
  "opted_out": false
}
```

## Checks

- ✅ answers valid
- ✅ intent buy — buy
- ✅ fact area ~ /gilbert|chandler/ — Gilbert or Chandler
- ✅ fact budget ~ /450/ — $450k
- ✅ stage qualified — qualified
- ✅ hand-off false
- ✅ never /^(hi|hello|hey)\b/
- ✅ never /thanks? (you )?for (your|the) (request|interest|form)/
- ✅ never /(what is|what's|may i have|could i get|can i get) (your|the best) (full )?(name|phone|number|email)/

Style: {"replies":5,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
