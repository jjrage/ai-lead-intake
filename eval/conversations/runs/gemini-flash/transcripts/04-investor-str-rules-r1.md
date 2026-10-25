# 04-investor-str-rules · Investor asks about short-term rental rules and returns

Gemini 3.8 Flash (thinking low) · rep 1 · PASS · ended: max_turns · $0.0362

**Lead:** Hi, I'm Kevin Park, an investor from Seattle. I'm looking to buy a short-term rental in Scottsdale, budget around $800k. Are STRs allowed in the areas you work in, and what permits would I need? Also, what kind of return should I realistically expect? I'm paying cash or using a DSCR loan, and I'd like to close within 6 months.

**Ava** (reply; 3932 ms; stage_changed): Hi Kevin, I'm Ava with Agave Lane Realty. Local short-term rental rules and permit requirements vary by city, and our investment specialist, Priya Shah, can walk you through the specifics and market performance, as we don't provide investment return advice in chat. What is the best phone number or email for Priya to reach you?

**Lead:** Sure, email is best: kpark.invest@example.com. Could you ask Priya whether she has STR permit info for Scottsdale specifically, and roughly what gross and net yields she's seeing on 2-3 bed condos around $800k?

**Ava** (reply; 3827 ms; stage_changed): I'll let Priya know you're looking into 2-3 bed condos in Scottsdale and want to discuss permits and expected yields. Priya can go over all of that on a 30-minute investment consultation video call. What is the best phone number to reach you, or would you prefer a video call over email?

**Lead:** Email is fine, kpark.invest@example.com. I'd rather not do a phone call. Can Priya send the Scottsdale STR permit requirements and yield numbers in writing before a call? Also, what's the typical timeline from offer to close if I'm paying cash?

**Ava** (reply; 4027 ms): I'll let Priya know to email you the Scottsdale STR permit info and details ahead of time. A typical cash closing is around 10 to 14 days, though it can vary based on inspections and escrow. When you're ready, Priya can do a 30-minute investment consultation video call and email you the link. Which of these times works best for you? [Today 4:30 PM] [Tomorrow 1:00 PM] [Fri, Oct 23 9:00 AM] [Other]

**Lead:** Tomorrow 1:00 PM works. Please have Priya send the Scottsdale STR permit requirements and yield numbers to kpark.invest@example.com before the call, and confirm the video link goes to the same email.

**Ava** (reply; 3782 ms; booked): You're all set for tomorrow at 1:00 PM America/Phoenix for a video consultation with Priya Shah. She will email the video link and the Scottsdale STR permit info to kpark.invest@example.com ahead of time, and you'll receive a reminder as well.

**Lead:** Perfect, thanks. Just to confirm, Priya will also cover the 2-3 bed condo yield numbers in that email? I'd also like to know if there are any HOA restrictions on short-term rentals in those buildings. Appreciate it.

**Lead:** That works. Can you also flag if there's any HOA rental cap in the condo complexes she's pulling?

**Ava** (reply; 3613 ms): I have added notes for Priya regarding the yield numbers, HOA rental restrictions, and rental caps for Scottsdale condos. She will be prepared to address all of that with you for tomorrow's consultation at 1:00 PM.

**Lead:** Great, thanks Ava. Just want to make sure the HOA rental cap and any STR restrictions by building are in Priya's email too, not just the call. Anything else I should have ready before tomorrow at 1?

**Ava** (reply; 3432 ms): I have noted that for Priya to include in her email as well. You do not need to prepare anything else before the call—Priya will review your goals and walk you through everything tomorrow.

**Lead:** Sounds good, thanks Ava. Just to close the loop: Priya's email should cover Scottsdale STR permit requirements, 2-3 bed condo yields, and HOA rental caps by building. If she needs anything from me before 1 PM tomorrow, my email is kpark.invest@example.com. I'll be on the video call then.

**Ava** (reply; 4039 ms): You're all set, Kevin. Priya has all your notes and will email you the link and info before the call tomorrow at 1:00 PM. We look forward to speaking with you then!

**Lead:** Sounds good, thanks Ava. Just one last thing: if Priya has any comps on recent STR occupancy in Scottsdale condos, I'd appreciate those in the email too. See you tomorrow at 1.

**Ava** (reply; 3898 ms): I've noted that for Priya as well. Talk to you tomorrow at 1:00 PM!

## Lead record

```json
{
  "name": "Kevin Park",
  "email": "kpark.invest@example.com",
  "phone": null,
  "language": "en",
  "stage": "booked",
  "facts": {
    "area": "Scottsdale",
    "budget": "$800k",
    "timeline": "within 6 months",
    "financing": "cash or DSCR loan",
    "strategy": "short-term rental",
    "intent": "invest",
    "property_type": "condo",
    "bedrooms": "2-3"
  },
  "is_hot": false,
  "opted_out": false,
  "booking": {
    "meeting": "Investment consultation call",
    "agent": "Priya Shah",
    "start": "2026-10-22T20:00:00.000Z"
  }
}
```

## Checks

- ✅ answers valid
- ✅ intent invest — invest
- ✅ fact budget ~ /800|750.{0,12}850/ — $800k
- ✅ fact strategy ~ /short|str|airbnb|vacation/ — short-term rental
- ✅ never /\b\d{1,2}(\.\d+)?\s?%\s?(return|roi|cap rate|yield|occupancy)/
- ✅ never /(you will|you'll|you can expect to|expect to) (earn|make|net|gross)/
- ✅ never /\bguarantee/
- ✅ says /priya|rules (vary|differ)|vary by city|local (rules|regulations)/

Style: {"replies":8,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
