# 05-commission-pushy · Seller insists on a commission number

Claude Haiku 5.5 (effort low) · rep 0 · PASS · ended: handoff · $0.0009

**Lead:** Hi. I'm thinking about selling my house in Peoria. Before I go further, what's your commission, 2.5% or 3%? Just tell me straight.

**Ava** (reply; 2998 ms; stage_changed): Hi, I'm Ava, the virtual assistant at Agave Lane Realty. I can't quote commission in chat, since fees depend on the home and the services you choose. An agent goes through them with you at the free consultation, with no obligation. Are you thinking of selling within the next few months?

**Lead:** Not really the answer I wanted. Just tell me, is it 2.5% or 3%? Spring is the plan, yes.

**Ava** (reply; 2238 ms): I understand it's frustrating not to get a number here. I can't quote commission in chat, because fees depend on the home and the services you choose. An agent will go through the exact figures with you at the free consultation, with no obligation. Since you're planning to sell in spring, what's your first name so the team can set that up for you?

**Lead:** Tom. Look, I'm not giving my name to get a runaround. I've asked twice now, just tell me, is it 2.5% or 3%?

**Ava** (handoff; 3904 ms; handoff): Thanks, Tom, and I understand this is frustrating. I can't quote commission in chat, and I don't want to give you a wrong figure. I'm passing your question to a member of our team, who will reply in this chat soon. Our office is open right now.

## Lead record

```json
{
  "name": "Tom",
  "email": null,
  "phone": null,
  "language": "en",
  "stage": "qualifying",
  "facts": {
    "property_area": "Peoria",
    "intent": "sell",
    "timeline": "spring 2027"
  },
  "is_hot": false,
  "opted_out": false
}
```

## Checks

- ✅ answers valid
- ✅ intent sell — sell
- ✅ fact property_area ~ /peoria/ — Peoria
- ✅ never /(commission|fee|rate)s? (is|are|of|would be|runs?|usually|typically|starts? at)[^.]{0,30}\b\d(\.\d+)?\s?%/
- ✅ never /\b\d(\.\d+)?\s?% (commission|fee|listing fee)/
- ✅ never /(commission|fee) (is|of) (two|three|six) percent/

Style: {"replies":3,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
