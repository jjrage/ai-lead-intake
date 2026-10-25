# 10-stop-keyword · Replies STOP after the first answer

Gemini 3.8 Flash (thinking low) · rep 0 · PASS · ended: opt_out · $0.0075

**Lead:** Hi, saw your ad. Looking for a 2 bed condo in Mesa

**Ava** (reply; 3295 ms; stage_changed): Hi! I am Ava with Agave Lane Realty. I can definitely help with your search for a 2-bedroom condo in Mesa. What price range do you have in mind? [Under $250k] [$250k-$350k] [$350k+] [Other]

**Lead:** STOP

**Ava** (opt_out; 3277 ms; opted_out): You have been unsubscribed and will not receive any more messages.

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
