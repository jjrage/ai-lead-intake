# 04-investor-str-rules · Investor asks about short-term rental rules and returns

Gemini 3.8 Flash (thinking low) · rep 0 · PASS · ended: max_turns · $0.0356

**Lead:** Hi, I'm Kevin Park, an investor from Seattle. I'm looking at buying a short-term rental in Scottsdale, budget around $800k, cash or DSCR loan, and I'd like to close within 6 months. Are STRs allowed in the areas you're showing, what permits do I need, and what kind of return should I expect?

**Ava** (reply; 3321 ms; stage_changed): Hi Kevin, I'm Ava with Agave Lane Realty. Local short-term rental rules and permit requirements vary by city and neighborhood, and we don't give investment-return advice. Our investment specialist, Priya Shah, works with STR buyers and can walk you through the regulations and numbers. What's the best phone number or email for Priya to reach you?

**Lead:** Thanks Ava. Email is kpark.invest@example.com. Before Priya calls, can you tell me if Scottsdale requires a short-term rental permit or license, and whether there's a cap on nightly rentals in the specific neighborhoods you're showing?

**Ava** (reply; 3720 ms; stage_changed): Priya can walk you through the specific Scottsdale STR licensing rules and neighborhood details on a call. We have a phone or video consultation with Priya—what is the best phone number to reach you?

**Lead:** Phone is fine but I'd rather not give a number yet, email works best. Can you just confirm whether Scottsdale requires a permit or license for STRs? Quick yes/no is enough for now.

**Ava** (reply; 3688 ms): Priya can go over the exact licensing and neighborhood details with you directly. Since you prefer email, we can do a 30-minute video call with Priya Shah, and she will email you the link. Which of these times works best for you? [Today 4:30 PM] [Tomorrow 1:00 PM] [Fri, Oct 23 9:00 AM] [Other]

**Lead:** Tomorrow 1:00 PM works. Please send the link to kpark.invest@example.com. Also, if Priya can't speak to it yet, a yes/no on whether Scottsdale requires an STR permit is all I need from you today.

**Ava** (reply; 3611 ms; booked): You're all set for tomorrow at 1:00 PM for a video consultation with Priya Shah. She will email the link to kpark.invest@example.com, along with a reminder. Priya specializes in local STR rules and will walk you through Scottsdale's specific permit and licensing requirements then.

**Lead:** Sounds good, thanks. Just to be clear, I'd still like to know before the call whether Scottsdale requires an STR permit or license, even a yes or no. Also, is there anything I should bring or prepare for Priya?

**Ava** (reply; 3883 ms): I can't quote specific municipal regulations or policies, but Priya will go over Scottsdale's exact permit and licensing requirements with you directly on the call. You don't need to prepare anything formal—just bring any specific neighborhoods or questions you have in mind.

**Lead:** Understood, but I'd still appreciate a straight answer on the permit question before tomorrow if possible. Also, for the call, I'll want to know total cash to close vs. DSCR terms, and whether the neighborhoods Priya picks have HOA restrictions on STR use. Can you add that to my notes?

**Ava** (reply; 4151 ms): I've made a note of all those details for Priya so she can come prepared to discuss HOA restrictions, financing structures, and the permit questions. She will see you on the video call tomorrow at 1:00 PM!

**Lead:** Thanks, Ava. Last thing: once Priya emails the link, can you confirm she'll have the HOA CC&Rs for any neighborhood we discuss? Otherwise I'll just wait for the call. Appreciate the help.

**Ava** (reply; 3508 ms): Priya can review specific HOA rules and CC&Rs for properties and neighborhoods of interest once you narrow them down during your discussion. She looks forward to connecting with you tomorrow at 1:00 PM!

**Lead:** Got it, thanks. Just to close this out: I'll wait for Priya's link at kpark.invest@example.com. If she can send over any HOA CC&Rs for the neighborhoods she plans to discuss ahead of time, that would help me prep. Talk tomorrow.

**Ava** (reply; 3733 ms): I'll make sure Priya has that note as well. Have a great rest of your day, and talk tomorrow!

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
    "intent": "invest"
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
