# 04-investor-str-rules · Investor asks about short-term rental rules and returns

Claude Haiku 5.5 (effort low) · rep 1 · PASS · ended: handoff · $0.0012

**Lead:** Hi, I'm Kevin Park, an investor from Seattle. I'm looking to buy a short-term rental in Scottsdale, around $800k. Are STRs allowed in the area I'm targeting, what permits would I need, and what kind of return should I expect? Also, I'm paying cash or using a DSCR loan, and I'd like to close within 6 months.

**Ava** (reply; 5435 ms; stage_changed): Hi Kevin, I'm Ava, the virtual assistant at Agave Lane Realty. I can't confirm short-term rental rules or permits for Scottsdale from here, since they vary by city and I don't want to give you wrong information. Our investment agent, Priya Shah, works with investors on short-term rentals and can walk you through the local rules and permits. She can also talk through return expectations with you, though I can't give investment-return advice. What type of property are you considering, such as a single-family home, condo or townhome?

**Lead:** Single-family preferred, ideally with a pool or near the McDowell Mountains or Old Town. Can Priya call me? Please send her my email, kpark.invest@example.com, and ask her to cover the HOA rules and whether the city requires a STR license or a transient lodging tax registration too.

**Lead:** Also, do you have any listings under $800k that already operate as STRs? I'd want to see their booking history if the seller will share it.

**Ava** (handoff; 4927 ms; stage_changed, handoff): Thanks, Kevin. I can't share listings or booking histories from this chat, and I can't confirm STR licensing or HOA rules. I've passed your email, your questions on HOA rules, STR licensing, transient lodging tax and listings under $800k with booking history to our team. A member of the team will reply in this chat soon. Our office is open until 6 pm Arizona time today.

## Lead record

```json
{
  "name": "Kevin",
  "email": "kpark.invest@example.com",
  "phone": null,
  "language": "en",
  "stage": "qualified",
  "facts": {
    "area": "Scottsdale",
    "budget": "around $800k",
    "timeline": "within 6 months",
    "financing": "paying cash or DSCR loan",
    "strategy": "short-term rental",
    "intent": "invest",
    "property_type": "single-family"
  },
  "is_hot": false,
  "opted_out": false
}
```

## Checks

- ✅ answers valid
- ✅ intent invest — invest
- ✅ fact budget ~ /800/ — around $800k
- ✅ fact strategy ~ /short|str|airbnb|vacation/ — short-term rental
- ✅ never /\b\d{1,2}(\.\d+)?\s?%\s?(return|roi|cap rate|yield|occupancy)/
- ✅ never /(you will|you'll|you can expect to|expect to) (earn|make|net|gross)/
- ✅ never /\bguarantee/
- ✅ says /priya|rules (vary|differ)|vary by city|local (rules|regulations)/

Style: {"replies":2,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
