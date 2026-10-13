# Model comparison (eval/runs)

| Model | All fields correct | Lead P / R | Hot P / R | Draft checks passed | Draft format | Invalid | $ per lead | p50 / p90 s | Errors |
|---|---|---|---|---|---|---|---|---|---|
| Claude Sonnet 5 (effort low) | 74% ± 15 | 100% / 100% | 67% / 100% | 97% | 98% | 0/90 | $0.0106 | 6.0 / 7.0 | 0 |
| Claude Haiku 4.5 | 61% ± 16 | 100% / 100% | 46% / 100% | 92% | 96% | 0/90 | $0.0041 | 4.2 / 5.5 | 0 |
| Claude Opus 5.5 (effort low) | 100% ± 0 | 100% / 100% | 100% / 100% | 100% | 100% | 0/90 | $0.0218 | 6.0 / 7.1 | 0 |
| Gemini 3.8 Flash (thinking low) | 98% ± 3 | 100% / 100% | 100% / 100% | 99% | 100% | 0/90 | $0.0024 | 2.3 / 3.3 | 0 |
| Gemini 3.5 Flash-Lite | 71% ± 16 | 100% / 100% | 67% / 100% | 98% | 98% | 0/90 | $0.0013 | 1.9 / 2.2 | 0 |
| Gemini 3.1 Flash-Lite | 69% ± 16 | 100% / 100% | 57% / 100% | 99% | 100% | 0/90 | $0.0009 | 2.1 / 11.6 | 0 |

Per-field accuracy (share of cases, each case averaged over its runs):

| Model | category | services | urgency | budget | contact | language | needs_review | reply |
|---|---|---|---|---|---|---|---|---|
| Claude Sonnet 5 (effort low) | 100% | 91% | 79% | 100% | 100% | 100% | 91% | 100% |
| Claude Haiku 4.5 | 100% | 95% | 56% | 96% | 96% | 100% | 92% | 99% |
| Claude Opus 5.5 (effort low) | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| Gemini 3.8 Flash (thinking low) | 100% | 100% | 100% | 100% | 98% | 100% | 99% | 100% |
| Gemini 3.5 Flash-Lite | 100% | 100% | 60% | 100% | 100% | 100% | 97% | 100% |
| Gemini 3.1 Flash-Lite | 100% | 100% | 56% | 100% | 100% | 100% | 97% | 100% |

Draft checks passed, both judges pooled (Claude Opus 5 and Gemini 3.1 Pro (Gemini app); judges agree on 98% of checks):

| Model | language | specific | accurate | no_commitments | no_redundant_questions | scope | safe |
|---|---|---|---|---|---|---|---|
| Claude Sonnet 5 (effort low) | 100% | 100% | 99% | 81% | 97% | 100% | 100% |
| Claude Haiku 4.5 | 100% | 100% | 92% | 63% | 93% | 100% | 100% |
| Claude Opus 5.5 (effort low) | 100% | 100% | 99% | 99% | 100% | 100% | 100% |
| Gemini 3.8 Flash (thinking low) | 100% | 100% | 99% | 97% | 100% | 100% | 100% |
| Gemini 3.5 Flash-Lite | 100% | 100% | 97% | 89% | 99% | 100% | 100% |
| Gemini 3.1 Flash-Lite | 100% | 100% | 97% | 97% | 97% | 100% | 100% |

- Claude Sonnet 5 (effort low): 30 cases, 90 scored runs, 0 failed attempts
- Claude Haiku 4.5: 30 cases, 90 scored runs, 0 failed attempts
- Claude Opus 5.5 (effort low): 30 cases, 90 scored runs, 0 failed attempts
- Gemini 3.8 Flash (thinking low): 30 cases, 90 scored runs, 0 failed attempts
- Gemini 3.5 Flash-Lite: 30 cases, 90 scored runs, 0 failed attempts
- Gemini 3.1 Flash-Lite: 30 cases, 90 scored runs, 0 failed attempts

API spend on the models under test: $3.69. Judges run on CLI subscriptions.

"± N" is the 95% interval across cases in percentage points. Lead and hot precision/recall are over all runs.
Cost is per call at list price with a cold prompt cache.
