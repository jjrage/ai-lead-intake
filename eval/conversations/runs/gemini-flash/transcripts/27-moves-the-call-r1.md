# 27-moves-the-call · Booked buyer asks to move the call to next week

Gemini 3.8 Flash (thinking low) · rep 1 · PASS · ended: lead_done · $0.0083

**Lead:** Hi, something came up on Friday. Can we move my call with Maya to next week?

**Ava** (reply; 3269 ms; hot): No problem at all! We can reschedule for next week. Would Monday, Oct 26 at 10:00 AM or Tuesday, Oct 27 at 2:00 PM work for you? [Mon 10:00 AM] [Tue 2:00 PM] [Other]

**Lead:** Mon 10:00 AM works for me, thanks!

**Ava** (reply; 3560 ms; booked): You're all set! I've rescheduled your call with Maya Torres for Monday, October 26 at 10:00 AM. Maya will call you at this number, and you'll get a reminder before the call.

## Lead record

```json
{
  "name": "Alex Moreno",
  "email": null,
  "phone": "+14805550166",
  "language": "en",
  "stage": "booked",
  "facts": {
    "intent": "buy",
    "area": "Chandler",
    "budget": "$550k",
    "property_type": "single-family",
    "bedrooms": "3",
    "timeline": "within 3 months",
    "financing": "pre-approved"
  },
  "is_hot": true,
  "opted_out": false,
  "booking": {
    "meeting": "Buyer consultation call",
    "agent": "Maya Torres",
    "start": "2026-10-26T17:00:00.000Z"
  }
}
```

## Checks

- ✅ answers valid
- ✅ intent buy — buy
- ✅ stage booked — booked
- ✅ hand-off false
- ✅ never /\*\*/

Style: {"replies":2,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
