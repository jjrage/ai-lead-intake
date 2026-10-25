# 20-sunday-night-callback · Seller on WhatsApp late Sunday wants a call tomorrow morning

Claude Haiku 5.5 (effort low) · rep 0 · PASS · ended: handoff · $0.0003

**Lead:** Hi, can someone call me tomorrow morning? I need to sell my house in Glendale ASAP

**Ava** (handoff; 2998 ms; stage_changed, hot, handoff): Thanks for reaching out. Our office is closed right now, but it opens Monday at 9 am Arizona time. A member of our team will reply in this chat soon to arrange a call about selling your Glendale home.

## Lead record

```json
{
  "name": null,
  "email": null,
  "phone": "+16235550123",
  "language": "en",
  "stage": "qualifying",
  "facts": {
    "property_area": "Glendale",
    "timeline": "ASAP",
    "intent": "sell"
  },
  "is_hot": true,
  "opted_out": false
}
```

## Checks

- ✅ answers valid
- ✅ intent sell — sell
- ✅ hot true — true
- ✅ never /(will|'ll) call you (at|by|before) \d/
- ✅ never /(guarantee|promise)/
- ✅ says /9|nine|monday|office hours|business hours|opens/

Style: {"replies":1,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
