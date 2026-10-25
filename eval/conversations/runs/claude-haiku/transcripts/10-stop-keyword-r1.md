# 10-stop-keyword · Replies STOP after the first answer

Claude Haiku 5.5 (effort low) · rep 1 · PASS · ended: opt_out · $0.0004

**Lead:** Hi, saw your ad. Looking for a 2 bed condo in Mesa

**Ava** (reply; 2446 ms; stage_changed): Hi, I'm Ava, the virtual assistant at Agave Lane Realty. Thanks for reaching out! We can help you find a 2 bedroom condo in Mesa. What price range are you considering?

**Lead:** STOP

**Ava** (opt_out; 1515 ms; opted_out): Understood, you won't get more messages from us.

## Lead record

```json
{
  "name": null,
  "email": null,
  "phone": "+14805550161",
  "language": "en",
  "stage": "qualifying",
  "facts": {
    "area": "Mesa",
    "property_type": "condo",
    "bedrooms": "2",
    "intent": "buy"
  },
  "is_hot": false,
  "opted_out": true
}
```

## Checks

- ✅ answers valid
- ✅ opt-out true

Style: {"replies":2,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
