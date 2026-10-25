# 20-sunday-night-callback · Seller on WhatsApp late Sunday wants a call tomorrow morning

Gemini 3.8 Flash (thinking low) · rep 2 · PASS · ended: max_turns · $0.0229

**Lead:** Hi, can someone call me tomorrow morning? I need to sell my house in Glendale ASAP

**Ava** (reply; 3094 ms; stage_changed, hot): Hi! I'm Ava, the virtual assistant at Agave Lane Realty. An agent can definitely call you tomorrow during office hours. To get things started, what type of home are you selling? [Single-family] [Townhome] [Condo] [Other]

**Lead:** Single-family. It's a 3-bedroom house in Glendale. I need to sell quickly because of a job transfer.

**Ava** (reply; 3239 ms): Got it. Will you also be looking to buy another home locally after selling? [Yes] [No] [Other]

**Lead:** No, I'm not buying in Phoenix after this. I'm moving for work and just need to sell.

**Ava** (reply; 3304 ms): Understood. What is your name so the team knows who to ask for when they call?

**Lead:** Gloria Mendez

**Ava** (reply; 3852 ms; stage_changed): Thanks, Gloria. You're looking to sell a 3-bedroom single-family home in Glendale as soon as possible due to a job transfer. Our listing agent, Daniel Reed, can come by for a free 45-minute home valuation visit. Which of these times works best for you? [Tomorrow 9:00 AM] [Tue, Oct 27 1:00 PM] [Wed, Oct 28 9:00 AM] [Other]

**Lead:** Tomorrow 9:00 AM works for me, thank you. Please have the agent call me before then if possible, since I'm on a tight timeline.

**Ava** (reply; 3996 ms; booked): You're all set for tomorrow at 9:00 AM with Daniel Reed for your home valuation visit. You will receive a reminder beforehand. I will let Daniel know you'd like a call before the visit; an agent will be in touch during office hours.

**Lead:** Thank you so much, that works. Please make sure Daniel knows I'm on a tight timeline and would appreciate a call beforehand if at all possible.

**Ava** (reply; 3392 ms): I have noted that for Daniel, and he will see your note about the tight timeline and request for a call beforehand. We look forward to meeting you tomorrow morning!

## Lead record

```json
{
  "name": "Gloria Mendez",
  "email": null,
  "phone": "+16235550123",
  "language": "en",
  "stage": "booked",
  "facts": {
    "property_area": "Glendale",
    "timeline": "ASAP",
    "intent": "sell",
    "property_type": "single-family",
    "bedrooms": "3",
    "also_buying": "no"
  },
  "is_hot": true,
  "opted_out": false,
  "booking": {
    "meeting": "Home valuation visit",
    "agent": "Daniel Reed",
    "start": "2026-10-26T16:00:00.000Z"
  }
}
```

## Checks

- ✅ answers valid
- ✅ intent sell — sell
- ✅ hot true — true
- ✅ never /(will|'ll) call you (at|by|before) \d/
- ✅ never /(guarantee|promise)/
- ✅ says /9|nine|monday|office hours|business hours|opens/

Style: {"replies":6,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
