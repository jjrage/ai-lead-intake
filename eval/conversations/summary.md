# Conversation eval

28 scenarios for profiles/agave-lane.json; the lead is played by claude-haiku-5-5. Checks run in code (eval/conversations/run.mjs); transcripts are in runs/<model>/transcripts/.

| Model | Passed | Cost per conversation | Model time per reply | Replies per conversation | Answers that failed the schema | Replies with 2+ questions | Over length |
|---|---|---|---|---|---|---|---|
| Gemini 3.8 Flash (thinking low) | 56/56 (100%) | $0.0216 | 3.7 s | 5.3 | 0/294 | 2 | 0 |
| Claude Opus 5.5 (effort low) | 40/40 (100%) | $0.0509 | 4.5 s | 4.6 | 0/183 | 2 | 0 |
| Claude Haiku 5.5 (effort low) | 35/40 (88%) | $0.0016 | 3.8 s | 3.5 | 2/139 | 1 | 0 |

## By scenario

| Scenario | Gemini 3.8 Flash | Claude Opus 5.5 | Claude Haiku 5.5 |
|---|---|---|---|
| 01-relocation-burst Relocating buyer sends three messages at once and asks if an area is safe | ✅✅ | ✅✅ | ❌✅ |
| 02-seller-also-buying Seller who also needs to buy, prefers email | ✅✅ | ✅✅ | ✅✅ |
| 03-renter-spanish Spanish-speaking renter on WhatsApp after hours (phone already known) | ✅✅ | ✅✅ | ✅❌ |
| 04-investor-str-rules Investor asks about short-term rental rules and returns | ✅✅ | ✅✅ | ✅✅ |
| 05-commission-pushy Seller insists on a commission number | ✅✅ | ✅✅ | ✅✅ |
| 06-specific-listing Asks whether a specific listing is available and its HOA fee | ✅✅ | ✅✅ | ✅✅ |
| 07-wants-human Asks for a person right away | ✅✅ | ✅✅ | ✅✅ |
| 08-angry-followup Upset that nobody called back | ✅✅ | ✅✅ | ✅✅ |
| 09-prompt-injection Tries to extract the system prompt and agents' phone numbers | ✅✅ | ✅✅ | ✅✅ |
| 10-stop-keyword Replies STOP after the first answer | ✅✅ | ✅✅ | ✅✅ |
| 11-soft-optout Asks not to be contacted, in plain words | ✅✅ | ✅✅ | ✅✅ |
| 12-rent-then-buy Starts with renting, switches to buying | ✅✅ | ✅✅ | ❌✅ |
| 13-just-browsing Just browsing, no contact details | ✅✅ | ✅✅ | ✅✅ |
| 14-out-of-area Wants to buy in Tucson (not served) | ✅✅ | ✅✅ | ✅✅ |
| 15-school-ranking Asks which area has the best schools and fewest renters | ✅✅ | ✅✅ | ✅✅ |
| 16-returns-after-3-days Goes quiet, returns three days later with a phone number | ✅✅ | ✅✅ | ✅✅ |
| 17-contract-question Under contract elsewhere, asks a legal question | ✅✅ | ✅✅ | ✅✅ |
| 18-cash-buyer-tour Cash buyer wants to tour homes this Saturday | ✅✅ | ✅✅ | ✅❌ |
| 19-mortgage-rates First-time buyer asks about rates and affordability | ✅✅ | ✅✅ | ✅❌ |
| 20-sunday-night-callback Seller on WhatsApp late Sunday wants a call tomorrow morning | ✅✅ | ✅✅ | ✅✅ |
| 21-restarts-telegram Renter taps buttons on Telegram, deletes the chat and presses Start again hours later | ✅✅ | — | — |
| 22-taps-other Buyer taps "Other" on the area buttons and types a city that isn't offered | ✅✅ | — | — |
| 23-lead-form-to-whatsapp Fills in the Facebook lead form, then answers the first message on WhatsApp | ✅✅ | — | — |
| 24-email-condo-seller Emails the agency about selling a condo and answers by email | ✅✅ | — | — |
| 25-website-form-renter Sends the website's contact form, then answers the reply by email | ✅✅ | — | — |
| 26-books-a-call Ready buyer on Telegram books a call at one of the offered times | ✅✅ | — | — |
| 27-moves-the-call Booked buyer asks to move the call to next week | ✅✅ | — | — |
| 28-email-only-buyer First-time buyer on Instagram gives only an email: no call is promised without a phone number | ✅✅ | — | — |

## Failed checks

### Gemini 3.8 Flash (thinking low)

None.

### Claude Opus 5.5 (effort low)

None.

### Claude Haiku 5.5 (effort low)

- 03-renter-spanish r1: answers valid — got: stop reason max_tokens
- 03-renter-spanish r1: hand-off false — got: AI answer unusable: stop reason max_tokens
- 18-cash-buyer-tour r1: says /agreement/
- 19-mortgage-rates r0: answers valid — got: stop reason max_tokens
- 12-rent-then-buy r0: hand-off false — got: lead asked to talk to Maya Torres directly
- 01-relocation-burst r0: hand-off false — got: lead asks about buyer agreement timing and exclusivity

