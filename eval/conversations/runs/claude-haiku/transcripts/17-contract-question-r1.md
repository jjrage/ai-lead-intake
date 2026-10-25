# 17-contract-question · Under contract elsewhere, asks a legal question

Claude Haiku 5.5 (effort low) · rep 1 · PASS · ended: handoff · $0.0002

**Lead:** We're under contract on a house in Peoria with another brokerage. The inspection found roof damage. Can we back out and keep our earnest money?

**Ava** (handoff; 1926 ms; stage_changed, handoff): I'm Ava, the virtual assistant at Agave Lane Realty. Questions about an active contract, inspection results and earnest money need a person on our team. A member of the team will reply in this chat soon. Our office is open until 6 pm today, Arizona time.

## Lead record

```json
{
  "name": null,
  "email": null,
  "phone": null,
  "language": "en",
  "stage": "qualifying",
  "facts": {
    "area": "Peoria",
    "intent": "buy"
  },
  "is_hot": false,
  "opted_out": false
}
```

## Checks

- ✅ answers valid
- ✅ hand-off true — question about an active contract and earnest money
- ✅ never /(?<!(whether|if) )(you can|you're able to|you are able to|you should be able to) (back out|cancel|terminate|keep (your|the) earnest)/

Style: {"replies":1,"over_length":0,"two_plus_questions":0,"markdown":0,"re_greeting":0}
