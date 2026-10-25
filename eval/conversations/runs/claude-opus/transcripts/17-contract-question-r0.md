# 17-contract-question · Under contract elsewhere, asks a legal question

Claude Opus 5.5 (effort low) · rep 0 · PASS · ended: handoff · $0.0092

**Lead:** We're under contract on a house in Peoria with another brokerage. The inspection found roof damage. Can we back out and keep our earnest money?

**Ava** (handoff; 4469 ms; handoff): Hi, I'm Ava, the virtual assistant at Agave Lane Realty. I'm sorry about the roof news. Whether you can cancel and keep your earnest money depends on your contract terms and deadlines, so I can't advise on that here. Your current agent and a real estate attorney are the best people to check with, especially since inspection deadlines can be short. I've passed your message to our team, and a team member will reply in this chat soon.

## Lead record

```json
{
  "name": null,
  "email": null,
  "phone": null,
  "language": "en",
  "stage": "new",
  "facts": {
    "area": "Peoria",
    "property_type": "house",
    "intent": "other"
  },
  "is_hot": false,
  "opted_out": false
}
```

## Checks

- ✅ answers valid
- ✅ hand-off true — Question about an active contract and earnest money
- ✅ never /(?<!(whether|if) )(you can|you're able to|you are able to|you should be able to) (back out|cancel|terminate|keep (your|the) earnest)/

Style: {"replies":1,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
