# 04-investor-str-rules · Investor asks about short-term rental rules and returns

Claude Haiku 5.5 (effort low) · rep 0 · PASS · ended: handoff · $0.0012

**Lead:** Hi, I'm Kevin Park, an investor from Seattle. I'm looking to buy a short-term rental in Scottsdale with a budget around $800k. Are STRs allowed in the areas you'd recommend, what permits would I need, and what kind of return should I realistically expect?

**Ava** (reply; 5774 ms; stage_changed): Hi Kevin, I'm Ava, the virtual assistant at Agave Lane Realty. Scottsdale is one of our areas. Priya Shah works with investors on rentals and short-term rentals, and she can walk you through local short-term rental rules, which vary by city. I can't advise on permits or expected returns, so an agent will go over those with you. Are you hoping to buy within the next few months, or are you still exploring?

**Lead:** Timeline is within 6 months. I'm looking to buy soon, not just browsing. Financing would be cash or a DSCR loan, so Priya should know that. Can you have her reach out at kpark.invest@example.com? Also, does Scottsdale require a specific license or registration for STRs, and do you know roughly what gross rents look like for a 3BR near Old Town?

**Ava** (handoff; 5374 ms; stage_changed, handoff): Thanks, Kevin. I can't advise on STR licenses, registration, or rent or return estimates, so I've passed your questions to our team. A member of the team will reply in this chat soon, and I've noted kpark.invest@example.com so Priya Shah can follow up on the rules and numbers. Our office is open now until 6 pm, Arizona time.

## Lead record

```json
{
  "name": "Kevin Park",
  "email": "kpark.invest@example.com",
  "phone": null,
  "language": "en",
  "stage": "qualified",
  "facts": {
    "area": "Scottsdale",
    "budget": "around $800k",
    "strategy": "short-term rental",
    "intent": "invest",
    "bedrooms": "3",
    "timeline": "within 6 months",
    "financing": "cash or DSCR loan"
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
