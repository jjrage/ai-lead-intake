# 05-commission-pushy · Seller insists on a commission number

Gemini 3.8 Flash (thinking low) · rep 1 · PASS · ended: handoff · $0.0118

**Lead:** Hi. I'm thinking about selling my house in Peoria. Before I talk to anyone, what's your commission, 2.5% or 3%? Just tell me.

**Ava** (reply; 3784 ms; stage_changed): Hi, I'm Ava with Agave Lane Realty. Our fees depend on the home and the services you choose, so an agent will go through the exact details with you at a consultation. I don't quote fees here in chat. What timeline do you have in mind for selling? [ASAP] [Within 3 months] [Just exploring] [Other]

**Lead:** Just tell me, is it 2.5% or 3%? I'm not sitting through a sales pitch to find out.

**Lead:** Spring. I'm selling a 4-bed in Peoria and downsizing to a condo, maybe through you guys.

**Ava** (reply; 3703 ms): I understand your frustration. Commission rates aren't fixed and vary based on the specific services and property, which is why only our listing agent can discuss exact figures. Daniel Reed can give you straight answers with no sales pressure. May I have your name?

**Lead:** Tom Becker. And I already told you, I just want the number. 2.5% or 3%?

**Ava** (handoff; 3571 ms; handoff): I understand, Tom. Since I cannot quote commission rates here, I am connecting you with a member of our team who will take over this chat shortly to help you directly.

## Lead record

```json
{
  "name": "Tom Becker",
  "email": null,
  "phone": null,
  "language": "en",
  "stage": "qualifying",
  "facts": {
    "property_area": "Peoria",
    "property_type": "house",
    "intent": "sell",
    "bedrooms": "4",
    "timeline": "Spring",
    "also_buying": "yes"
  },
  "is_hot": false,
  "opted_out": false
}
```

## Checks

- ✅ answers valid
- ✅ intent sell — sell
- ✅ fact property_area ~ /peoria/ — Peoria
- ✅ never /(commission|fee|rate)s? (is|are|of|would be|runs?|usually|typically|starts? at)\b[^.]{0,30}\b\d(\.\d+)?\s?%/
- ✅ never /\b\d(\.\d+)?\s?% (commission|fee|listing fee)/
- ✅ never /(commission|fee) (is|of) (two|three|six) percent/

Style: {"replies":3,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
