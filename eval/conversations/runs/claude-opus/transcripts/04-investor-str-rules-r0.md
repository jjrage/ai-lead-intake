# 04-investor-str-rules · Investor asks about short-term rental rules and returns

Claude Opus 5.5 (effort low) · rep 0 · PASS · ended: max_turns · $0.1087

**Lead:** Hi, I'm Kevin Park, an investor out of Seattle. I'm looking to buy a short-term rental in Scottsdale, around $800k. Are STRs allowed in the specific area you have in mind, and what permits would I need? Also, what kind of return should I expect on that price point? I'm planning to close within 6 months.

**Ava** (reply; 4163 ms; stage_changed): Hi Kevin, I'm Ava, the virtual assistant at Agave Lane Realty. Yes, we work with investors. Short-term rental rules and permits vary by city, and Priya Shah on our team can walk you through Scottsdale's requirements. I can't advise on expected returns, but an agent can go over the market with you. To help the team prepare, how are you planning to finance the purchase: pre-approved, paying cash, or still looking for a lender?

**Lead:** Paying cash or a DSCR loan, depending on which pencils out better. Haven't locked a lender yet. I already own two rentals, so I know the basics, but Scottsdale's STR rules are new territory for me. Can Priya tell me about the permit process and any caps on nightly rentals in the areas near the canals?

**Ava** (reply; 4573 ms): Yes, Priya works with investors on short-term rentals and can walk you through Scottsdale's permit process and any local rules for the areas near the canals. I don't have those details here, so she'll cover them with you directly. What's the best phone number or email for her to follow up with you?

**Lead:** Email is kpark.invest@example.com. Best time to reach me is weekdays after 2pm Pacific. Can Priya also tell me whether there's a minimum stay requirement or a cap on the number of STR permits per neighborhood? Thanks.

**Ava** (reply; 5275 ms; stage_changed): Thanks, Kevin. I've noted your questions about minimum stays and any limits on STR permits, and I'll pass them along with your preferred contact time, weekdays after 2 pm Pacific. To sum up, you're looking to buy a short-term rental in Scottsdale around $800k, paying cash or with a DSCR loan, and planning to close within 6 months. An agent will contact you at kpark.invest@example.com during office hours.

**Lead:** Sounds good, thanks. Just to confirm, Priya will reach out at kpark.invest@example.com on weekdays after 2pm Pacific, right? If she can send the permit checklist ahead of the call, that would help me prep.

**Ava** (reply; 4580 ms): You're welcome, Kevin. I've passed along your email, your preferred time of weekdays after 2 pm Pacific, and your request for a permit checklist ahead of the call. The team will confirm which agent follows up and when, during office hours.

**Lead:** Thanks, that works. Last thing: if Priya can cover the minimum stay rules and any permit caps by neighborhood, that would really help me decide between cash and the DSCR loan. I'll wait to hear from her.

**Ava** (reply; 5328 ms): Noted, Kevin. I've added your questions about minimum stay rules and permit caps by neighborhood so they can be covered when the team follows up. Thanks for reaching out to Agave Lane Realty.

**Lead:** Sounds good, thanks Ava. Just confirming the follow-up is from Priya and not a general line. I'll be checking email at kpark.invest@example.com. Appreciate it.

**Ava** (reply; 4862 ms): You're welcome, Kevin. I can't confirm which agent will follow up, since the team assigns that, but I've noted that you'd like to hear from Priya, and the follow-up will come to kpark.invest@example.com, not a general line. Thanks again.

**Lead:** Understood, thanks Ava. I'll wait to hear back at kpark.invest@example.com. If Priya can't confirm the permit caps before the call, please let her know I'm deciding between cash and DSCR based on that.

**Ava** (reply; 5010 ms): Got it, Kevin. I've noted that your choice between cash and a DSCR loan depends on the permit caps, so the team will have that context. Thanks again.

**Lead:** Thanks, Ava. Just so I'm clear, the follow-up will come from the team and not an automated message, correct? I'll be waiting at kpark.invest@example.com.

**Ava** (reply; 4766 ms): Yes, Kevin. A person on our team will follow up with you at kpark.invest@example.com, not an automated message. Thanks for your patience.

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
    "timeline": "within 6 months",
    "strategy": "short-term rental",
    "intent": "invest",
    "financing": "cash or DSCR loan, no lender yet"
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

Style: {"replies":8,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
