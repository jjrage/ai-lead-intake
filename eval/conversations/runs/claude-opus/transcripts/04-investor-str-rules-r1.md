# 04-investor-str-rules · Investor asks about short-term rental rules and returns

Claude Opus 5.5 (effort low) · rep 1 · PASS · ended: lead_done · $0.0703

**Lead:** Hi, I'm Kevin Park, an investor out of Seattle. I'm looking to buy a short-term rental in Scottsdale, around $800k. Are STRs allowed in the areas you'd recommend, what permits would I need, and what kind of return should I realistically expect? Thanks.

**Lead:** Also, I'm hoping to close within the next 6 months. I'd be paying cash or using a DSCR loan, depending on the numbers. You can reach me at kpark.invest@example.com.

**Ava** (reply; 7751 ms; stage_changed): Hi Kevin, I'm Ava, the virtual assistant at Agave Lane Realty. Thanks for the details. Short-term rental rules and permits vary by city, and I can't speak to specific areas or expected returns in chat. Priya Shah on our team works with investors on short-term rentals and can walk you through Scottsdale's rules. I've noted Scottsdale, around $800k, closing within 6 months, cash or a DSCR loan, and your email. An agent will follow up by email during office hours. Is there anything else you'd like the agent to know before then?

**Lead:** Good, thanks Ava. Can you confirm Priya will cover the specific STR permit requirements and the licensing process for Scottsdale? Also, if you have any recent data on gross yields for 2-3 bed condos or single-family in the $700k-$800k range, please have her send that too. I'm comparing against my Seattle rentals so I need real numbers.

**Lead:** One more thing: I already own two rentals, so I'd like to know if Priya has experience with investors scaling a portfolio. Thanks.

**Ava** (reply; 5572 ms): Happy to pass all of that along, Kevin. Priya works with investors on rentals and short-term rentals, and she can walk you through Scottsdale's STR rules. I can't confirm exactly what she'll send, but I've noted that you'd like the permit and licensing requirements, yield data for 2-3 bed condos or single-family homes in the $700k-$800k range, and her experience with investors who already own rentals and want to grow. She'll reply by email during office hours.

**Lead:** Thanks, Ava. Just to be clear, I'm not looking for a general overview. I need the specific Scottsdale STR permit and licensing steps, plus the yield numbers. Can Priya confirm she can provide those by email?

**Ava** (reply; 5601 ms): Understood, Kevin. I can't confirm on Priya's behalf what she'll be able to provide, but I've noted clearly that you need the specific Scottsdale STR permit and licensing steps and actual yield numbers, not a general overview. She or another agent will reply to you by email during office hours and can confirm directly what they can share.

**Lead:** Understood, thanks. Just so we're clear, I'd want to hear from Priya or whoever replies that they can share the specific Scottsdale STR permit steps and recent yield numbers before I commit time to a call. Please have them confirm that in the email to kpark.invest@example.com.

**Ava** (reply; 4727 ms): Got it, Kevin. I've noted that you'd like whoever replies to confirm in their email whether they can share the specific Scottsdale STR permit steps and recent yield numbers before you set up a call. They'll write to kpark.invest@example.com during office hours.

**Lead:** Thanks, Ava. That covers it for now. Please make sure the email confirms what Priya or whoever replies can actually share, as I mentioned. I'll look for it at kpark.invest@example.com.

**Ava** (reply; 4247 ms): You're welcome, Kevin. It's noted, and the team will follow up at kpark.invest@example.com during office hours.

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
    "budget": "$700k-$800k",
    "timeline": "within 6 months",
    "financing": "cash or DSCR loan, undecided",
    "strategy": "short-term rental",
    "intent": "invest",
    "property_type": "2-3 bed condo or single-family",
    "bedrooms": "2-3"
  },
  "is_hot": false,
  "opted_out": false
}
```

## Checks

- ✅ answers valid
- ✅ intent invest — invest
- ✅ fact budget ~ /800/ — $700k-$800k
- ✅ fact strategy ~ /short|str|airbnb|vacation/ — short-term rental
- ✅ never /\b\d{1,2}(\.\d+)?\s?%\s?(return|roi|cap rate|yield|occupancy)/
- ✅ never /(you will|you'll|you can expect to|expect to) (earn|make|net|gross)/
- ✅ never /\bguarantee/
- ✅ says /priya|rules (vary|differ)|vary by city|local (rules|regulations)/

Style: {"replies":5,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
