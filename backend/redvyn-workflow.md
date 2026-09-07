# RedVyn Workflow and Architecture Specification

## 1. What it is

RedVyn is a coordination layer between people who need blood and people who can give it. It is not a blood bank, it does not store or test blood, and it does not certify safety. Screening, crossmatching and the physical transfusion remain the hospital's or blood bank's responsibility. RedVyn's job is to get the right eligible human to the right desk at the right time, and to prove they are who they say they are.

The primary interface is a phone call in Urdu and English, because the users who need this most do not reliably have smartphones, data, or literacy. WhatsApp and SMS carry the structured details that a voice call cannot convey safely, such as hospital name and donation code.

Two operating modes share one infrastructure:

**Scheduled Care** for thalassemia patients on a 2 to 4 week transfusion cycle. The system predicts the next required date and lines up donors days in advance, so a missed donor is a scheduling problem rather than an emergency.

**Emergency Broadcast** for trauma, postpartum hemorrhage and surgical cases, where the constraint is minutes and the strategy is parallel outreach rather than sequential calling.

The core design principle throughout: the language model handles conversation, and deterministic code handles every decision that affects who gets blood. No allocation, escalation or eligibility decision is ever made by an LLM.

---

## 2. Feature inventory

1. Donor registry with consent, eligibility and recovery tracking
2. Patient registry with transfusion cycle history
3. Transfusion date prediction
4. Matching engine (compatibility, proximity, eligibility, reliability)
5. Primary plus standby lineup for scheduled cases
6. Time based auto escalation scheduler
7. Parallel emergency broadcast with atomic slot allocation
8. Bilingual outbound voice agent with keypad confirmation
9. Inbound emergency intake line
10. Donation code issuance and hospital side verification
11. Family confirmation and case closure
12. Reliability scoring and auto share qualification
13. Radius expansion and blood bank fallback
14. Release notification for surplus donors
15. Audit log and operations console

---

## 3. How each feature is implemented

### 3.1 Donor registry and eligibility

Postgres table with PostGIS geography column for location. Phone numbers encrypted at rest, indexed on a keyed hash so lookup works without decrypting the whole table.

```
donors(
  id, phone_hash, phone_enc, first_name,
  blood_group, rh, phenotype_json nullable,
  home_location geography(Point,4326),
  last_donation_at, next_eligible_at,
  reliability_score int default 50,
  status enum(active, paused, opted_out, blocked),
  language enum(ur, en), channel_pref enum(call, whatsapp),
  quiet_hours_start, quiet_hours_end,
  consent_at, consent_version
)
```

`next_eligible_at` is a stored column set to `last_donation_at + 90 days` for whole blood. It is written once at donation confirmation rather than computed at query time, so the matching query stays a simple index scan under load.

Eligibility is a boolean gate evaluated in SQL, not by a model: status is active, `next_eligible_at <= now`, not currently holding an open offer on another case, and current time is outside quiet hours unless the case is emergency.

Registration happens through a short inbound IVR or a one page web form. Consent is explicit, versioned, and revocable by replying STOP on WhatsApp or pressing 9 on any call.

### 3.2 Patient registry and prediction

```
patients(
  id, guardian_phone_enc, blood_group, rh, phenotype_json,
  condition enum(thalassemia_major, other),
  home_hospital_id, interval_days_estimate,
  last_transfusion_at, predicted_next_at
)
transfusions(id, patient_id, occurred_at, units, hospital_id, source enum(redvyn, external))
```

Prediction is deliberately a statistical estimator, not machine learning. With five to fifteen historical points per patient there is nothing for a model to learn that a robust average does not capture, and an interpretable number is easier for a clinician to override.

```
interval = median(last 6 observed gaps)
if fewer than 3 observations: use clinician-entered interval, default 21 days
predicted_next = last_transfusion_at + interval
clamp to [14, 35] days
```

A nightly job recomputes `predicted_next_at` for all active patients. Any prediction that moves by more than 4 days from the previous estimate raises a flag on the operations console rather than silently changing, because a shortening interval is clinically meaningful.

Upgrade path if hemoglobin values are ever captured: fit a per patient linear decline of Hb against days since transfusion and solve for the date the trigger threshold is crossed. Still not ML, still explainable.

### 3.3 Matching engine

A single ranked SQL query, executed inside the case creation transaction.

Compatibility is a lookup table, not an equality check. For red cells, an A+ recipient can receive A+, A-, O+ or O-. Emergency cases use the full compatibility set. Scheduled thalassemia cases prefer exact ABO and Rh match, and extended phenotype match where records exist, because repeated mismatched transfusion drives alloimmunization. That preference is expressed as a ranking weight, not a hard filter, so the system degrades to compatible rather than failing to find anyone.

```sql
SELECT d.id,
       ST_Distance(d.home_location, :hospital_loc) AS meters
FROM donors d
WHERE d.status = 'active'
  AND d.next_eligible_at <= now()
  AND d.blood_group = ANY(:compatible_groups)
  AND ST_DWithin(d.home_location, :hospital_loc, :radius_m)
  AND NOT EXISTS (SELECT 1 FROM offers o
                  WHERE o.donor_id = d.id AND o.state IN ('pending','accepted'))
ORDER BY (d.blood_group = :exact_group) DESC,
         d.reliability_score DESC,
         meters ASC
LIMIT :n;
```

The `NOT EXISTS` clause is the important one. Without it the same high reliability donor gets recruited onto three cases in the same hour and shows up for none of them.

### 3.4 Primary and standby lineup

At case creation for scheduled mode, the top three matches are written as offers with roles `primary`, `standby_1`, `standby_2` in one transaction.

The information asymmetry is enforced at the serialization layer, not by convention. There are two DTOs:

```
PrimaryOfferPayload  -> hospital name, desk, date, time window,
                        blood group, units, donation code
StandbyOfferPayload  -> date, city, blood group, "stay available"
```

Standby payloads have no field for hospital or code, so they cannot leak them even if a template is misconfigured. Promotion from standby to primary triggers issuance of a code and a switch to the primary payload.

### 3.5 Escalation scheduler

Durable delayed jobs, not in-process timers. BullMQ on Redis, or RocketMQ scheduled messages if staying entirely inside Alibaba Cloud.

Scheduled case timeline:

| Offset | Action |
| --- | --- |
| T-72h | Case created, lineup built, primary contacted, standbys notified |
| T-24h | Reminder to primary. No confirmation, promote standby_1 |
| T-2h | Final check call to current primary. No response, activate standby_1 |
| T-0 | Still unfilled, activate standby_2 and open emergency broadcast |

Three rules make this survivable in production:

**Jobs are idempotent by construction.** Job id is `case:{case_id}:t-24`. Enqueuing twice is a no-op at the queue level.

**Jobs are triggers, not decisions.** Every job reloads current case and offer state on execution and exits silently if the state has already moved past the point where the job was relevant. A T-24h reminder that fires after the primary already confirmed does nothing.

**A sweeper backs up the scheduler.** A cron running every five minutes selects cases where `expires_at < now()` and state is not terminal, and forces them into the next escalation step. If Redis loses a job, the case still progresses, just later.

### 3.6 Emergency broadcast and atomic allocation

Emergency mode contacts 5 to 8 donors simultaneously. This creates a real race: if 4 units are needed and 8 donors accept within the same second, naive code recruits 8 people and wastes 4 of them.

Allocation goes through a Redis atomic counter initialized to `units_required + 1`, the extra unit being the safety margin for emergency no-shows.

```
slots = DECR case:{id}:slots
if slots >= 0:   accept, issue code, send details
if slots < 0:    INCR back, send release message, mark offer released
```

DECR is atomic, so exactly `units_required + 1` acceptances win regardless of arrival order. The counter is mirrored into Postgres in the same transaction that writes the offer state, and Redis is treated as the fast path with Postgres as the record of truth. On Redis loss, the counter is rebuilt from `SELECT count(*) FROM offers WHERE case_id = ? AND state = 'accepted'`.

Every inbound response carries an idempotency key of `{case_id}:{donor_id}:{response}`, checked before the DECR. A donor who presses 1 twice, or whose telephony webhook is retried by the provider, does not consume two slots.

When the counter hits zero, a `case.units_met` event fans out release messages to every remaining pending donor. The release message wording matters for retention: it thanks them and records the response as positive in their reliability history, because they did say yes.

### 3.7 Radius expansion and fallback

If no acceptance within 15 minutes, radius goes 5km, then 15km, then 30km, each expansion running a fresh match query that excludes donors already contacted. At the 30km step, registered blood banks and Alkhidmat blood services are alerted through their own channel, which realistically is an operations console notification and a call to a desk contact rather than an API in the first version.

### 3.8 Donation code and hospital verification

Code format is `{blood_group}{4 digits}`, for example `B+4821`. Blood group is in the code so the family and the desk can eyeball a mismatch instantly.

Generated at acceptance, unique across all currently open cases (retry on collision, the active set is small enough that collisions are rare), expires at case close plus 24 hours.

Verification is a human process supported by software. The donor arrives and states the code. The family, holding the same code on their phone or having heard it on a call, matches it. No match, no entry. This is deliberately low tech: it works with no hospital integration, no scanner, and no connectivity at the desk.

The donor never receives the patient's name or ID. Their payload is hospital, desk, time window, blood group, units, and code.

### 3.9 Confirmation and closure

Only the requester side can confirm completion. This is the anti fraud control: a donor who confirms their own donation would otherwise be able to farm reliability score without ever donating.

Confirmation arrives through an app button, a WhatsApp quick reply, or an outbound AI call to the registered guardian number asking whether the donation for code B+4821 was completed. The guardian number is verified at registration, so possession of that number is the authentication.

On confirmation, one transaction writes: donation row, donor `last_donation_at` and `next_eligible_at` reset, reliability score increment, patient `last_transfusion_at` update and prediction recompute, case state to closed, and all remaining offers to released.

If no confirmation arrives within 24 hours, the case goes to `pending_review` on the operations console rather than auto closing. An unconfirmed case is either a no-show or a data gap, and both need a human to look.

### 3.10 Reliability scoring

Deterministic and published, so donors understand it.

```
start 50, range 0-100
completed donation        +5
no-show                   -15
cancelled >6h in advance    0
cancelled <2h before       -5
release (need met)          0
unreachable on 2 attempts  -2

Events older than 12 months carry half weight.
```

Cancelling in advance is explicitly not penalized. A donor who tells you they cannot come at T-20h is giving you 20 hours to find someone else, which is the behavior you want to encourage.

Auto share qualification, meaning the donor's contact details are released without requester approval, requires score above 80 and at least 5 confirmed donations. It is revoked immediately on any no-show.

---

## 4. How information is passed

### 4.1 Event bus

Services communicate through published events rather than direct calls, so escalation, notification and scoring can evolve independently. RocketMQ or EventBridge on Alibaba Cloud.

```
case.created            {case_id, type, blood_group, units, hospital_id, expires_at}
offer.created           {offer_id, case_id, donor_id, role}
outreach.dispatched     {offer_id, channel, provider_ref}
call.completed          {offer_id, outcome, duration, transcript_ref}
offer.accepted          {offer_id, case_id, donor_id, code}
offer.declined          {offer_id, reason}
offer.timed_out         {offer_id}
offer.promoted          {offer_id, from_role, to_role}
case.units_met          {case_id, secured}
offer.released          {offer_id, reason}
case.escalated          {case_id, from_step, to_step, new_radius}
donation.confirmed      {donation_id, case_id, donor_id, confirmed_by}
case.closed             {case_id, outcome}
```

Events carry ids, never PII. A consumer that needs a phone number fetches it through the service that owns decryption, which logs the access. This keeps the message bus and its retention free of personal data.

### 4.2 Channel routing

Channel choice is a cost and reliability decision made per situation, not a fixed rule.

| Situation | Channel |
| --- | --- |
| Scheduled T-72h lineup | WhatsApp template with quick reply buttons, call if no WhatsApp |
| Scheduled T-24h reminder | WhatsApp, escalate to call after 2h silence |
| Scheduled T-2h final check | Call always |
| Emergency broadcast | Call always, WhatsApp sent in parallel |
| Code and hospital details | WhatsApp, SMS fallback |
| Family confirmation | App button, then WhatsApp, then call |

Calls interrupt and WhatsApp does not, so calls are reserved for moments where an interruption is warranted. A WhatsApp first policy on scheduled cases removes most of the telephony cost from the system, since scheduled cases are the high volume path.

WhatsApp business initiated messages require pre approved templates. Templates needed: standby notice, primary offer, code delivery, reminder, release, confirmation request. Get these approved early, approval is slow and blocks end to end testing.

### 4.3 Privacy boundary

One rule, enforced in code: any payload addressed to a donor is built by a function whose input type has no patient identity fields. It is a compile time or schema level guarantee rather than a review checklist.

The donation code is the only shared join key between donor and family, and it is meaningless outside the case.

---

## 5. How handling is done

### 5.1 Case state machine

```
draft -> matching -> awaiting_response -> partially_filled -> filled
                          |                                    |
                          v                                    v
                     escalating                            in_progress
                          |                                    |
                          v                                    v
                     broadcasting                          confirmed -> closed
                          |
                          v
                   fallback_bloodbank -> unfilled
```

Transitions are guarded. `filled` requires `units_secured >= units_required`. `confirmed` requires a donation row created by the requester side. Illegal transitions raise and alert rather than being silently ignored, because a silent state bug here means someone does not get blood.

### 5.2 Offer state machine

```
pending -> accepted -> code_issued -> completed
   |          |
   |          v
   |      no_show
   v
declined | timed_out | released | promoted
```

### 5.3 Call handling loop

```
Telephony provider webhook
  -> media stream opened
  -> greeting plays (pre-recorded audio)
  -> two input paths run concurrently:
       DTMF keypress  -> deterministic handler, short-circuits everything
       Speech         -> ASR -> Qwen turn -> tool call or reply
  -> tool call executes against backend
  -> response rendered (pre-recorded segment + TTS for dynamic values)
  -> loop, max 4 turns
  -> on exhaustion: "we are sending you a message" -> WhatsApp handoff
```

DTMF is the primary confirmation path and speech is the convenience layer. On a life critical call, a keypress is unambiguous and works with poor line quality, background hospital noise, accented speech and any dialect. Speech recognition in Urdu is the least reliable component in the whole system, and it should never be the only way to say yes.

### 5.4 Failure handling

| Failure | Handling |
| --- | --- |
| Call not answered | Retry twice at 5 and 15 minutes, then switch channel |
| ASR returns low confidence | Read back and request keypress confirmation |
| LLM timeout or error | Fall back to pure IVR script, "press 1 to accept, 2 to decline" |
| Telephony provider down | Queue outreach, switch to WhatsApp and SMS, alert operations |
| WhatsApp template rejected | SMS fallback with truncated content |
| Redis unavailable | Rebuild counters from Postgres, accept degraded latency |
| Scheduler job lost | Sweeper cron picks it up within 5 minutes |
| Duplicate webhook | Idempotency key blocks second effect |
| Donor accepts after slots filled | Release message, no penalty, positive score event |
| No confirmation after 24h | Case to pending_review, human follows up |
| Patient prediction drifts sharply | Flag to operations, do not auto apply |

### 5.5 Operational guards

Rate limit outreach per donor to at most one contact per 24 hours for scheduled cases, unlimited for emergency but capped at three per week overall, otherwise the network burns out its best donors.

Quiet hours apply to scheduled outreach only. Emergency overrides them, and donors are told this at registration.

Every outbound message, call and state transition is written to an append only audit table. In a system that touches medical coordination, being able to reconstruct exactly what was said to whom and when is not optional.

---

## 6. AI integration

### 6.1 Where AI is used and where it is not

Used for conversation, language understanding and readback. Not used for matching, allocation, escalation, eligibility, scoring or prediction. A hallucinated field in a conversation is recoverable through readback. A hallucinated allocation decision is not.

### 6.2 Dialogue agent

**Model:** Qwen (qwen-plus for the balance of latency and instruction following, qwen-turbo for the simplest confirm or decline flows) through Alibaba Cloud Model Studio.

**Configuration:** temperature 0.2, max output tokens capped low, hard limit of 4 turns, function calling enabled with a small tool set.

**What it actually does:** it converts free speech into one of a handful of structured intents, and renders a fixed set of facts into natural Urdu or English. That is the whole job. The system prompt states the case facts, the allowed tools, and an explicit instruction to never invent hospital names, times, quantities or medical guidance.

**Tools exposed:**

```
accept_offer(offer_id)
decline_offer(offer_id, reason)
request_reschedule(offer_id, available_from)
repeat_details(offer_id)
mark_ineligible(donor_id, reason)
escalate_to_human(case_id)
```

Every tool call returns a result the model must read back before the turn ends. On `accept_offer`, the model says the hospital and time and asks for a keypress to confirm. The keypress, not the model's inference, commits the state change.

**Inbound emergency intake** is the one place the model extracts rather than confirms. It captures hospital, blood group, units and contact number from a distressed caller. Every extracted field is read back and keypress confirmed before the case is created, and blood group is confirmed twice. An intake error here sends the wrong blood type to a bleeding patient, so the readback is not a nicety.

### 6.3 Speech

**Text to speech:** the honest constraint is that Urdu TTS quality is inconsistent across providers and mispronounced hospital names erode trust fast. The approach that works is hybrid: roughly 90 percent of any call is a fixed script, so record those segments with a professional Urdu voice once, and use CosyVoice or an equivalent TTS only for the dynamic slots such as hospital name, time and blood group. This cuts latency, cuts cost, and removes most of the pronunciation risk.

**Speech to text:** this is the highest risk component. Alibaba's Paraformer and SenseVoice have limited Urdu coverage. Realistic options are Whisper large-v3, which has usable Urdu, or Azure Speech. Whatever is chosen, the architecture must not depend on it, which is why DTMF carries the load bearing confirmations.

Code switching between Urdu and English is normal in Pakistani speech and every ASR handles it badly. Constrain the recognition vocabulary to the expected response space for each prompt rather than running open transcription.

### 6.4 Non-AI intelligence

Prediction, scoring and matching are statistics and SQL. Calling them AI in a pitch is tempting and it is also the thing a technical reviewer will probe first. They are better defended as deliberate choices: small per patient sample sizes, a need for clinician override, and a requirement that a nurse can understand why a date was chosen.

### 6.5 Optional later additions

Post call summarization of transcripts for the operations console. Anomaly detection over no-show patterns. Demand forecasting per hospital per blood group per week, which becomes possible only after several months of data and is the point at which the system stops being reactive at the network level rather than just the case level.

---

## 7. End to end flow

### 7.1 Thalassemia family, scheduled path

Ayesha's son Hamza has thalassemia major and needs B+ blood roughly every 21 days. His last transfusion was on the 1st.

**Day 19, 03:00.** The nightly prediction job sets Hamza's next transfusion to the 22nd. A case is created 72 hours ahead.

**Day 19, 09:00.** The matching engine ranks eligible B+ donors within 5km of the hospital. Three offers are written: Bilal as primary, Faisal as standby_1, Nadia as standby_2.

Bilal receives a WhatsApp message: a patient in his area needs B+ blood on the 22nd between 10am and 1pm, with quick reply buttons. He taps Yes. A code `B+4821` is issued and the hospital name and desk are sent. Ayesha receives the same code and Bilal's first name.

Faisal and Nadia receive standby notices: stay available on the 22nd, B+ needed in Lahore. No hospital, no code.

**Day 21, 10:00, T-24h.** Reminder to Bilal. He does not respond within two hours, so an AI call goes out. It rings out twice. Bilal's offer times out.

Faisal is promoted. He gets a call: the agent explains the need, he presses 1, a new code `B+7309` is issued, and Ayesha's code is updated. Bilal's original code is invalidated.

**Day 22, 08:00, T-2h.** Final check call to Faisal. He confirms with a keypress. Case state moves to `filled`.

**Day 22, 10:40.** Faisal arrives, says `B+7309` at the blood bank desk. Ayesha matches it on her phone. He donates. He never learns Hamza's name.

**Day 22, 12:15.** Ayesha receives a WhatsApp message asking whether donation `B+7309` was completed. She taps Yes.

The system resets Faisal's eligibility to Day 112, raises his reliability score by 5, records Hamza's transfusion, recomputes his next date, and closes the case. Nadia receives a thank you and a note that she was not needed.

### 7.2 Donor, first contact

Faisal registered three months ago after an inbound IVR call. He gave his blood group, his area, and consent. He gets contacted at most once a day for scheduled cases, never between 10pm and 7am unless it is an emergency, which he was told about at signup. He can press 9 on any call or reply STOP to leave permanently.

He has never been asked for money, never been given a patient's name, and never had to install anything.

### 7.3 Emergency path

A woman arrives at a district hospital with postpartum hemorrhage. She needs 3 units of O-. A hospital worker calls the RedVyn line.

**T+0:00.** The intake agent asks for hospital, blood group and units. It reads back: three units of O negative at this hospital, press 1 if correct. The worker presses 1. Case created as emergency, `units_required = 3`, slot counter set to 4.

**T+0:30.** Match query returns O- and compatible donors within 5km, ordered by reliability then distance. Eight are called simultaneously. WhatsApp goes out in parallel.

**T+1:10.** Three donors press 1. The counter decrements to 1. Each gets a code and hospital details instantly.

**T+2:40.** A fourth accepts. Counter hits 0. Case moves to `filled`. The remaining four donors receive a release message thanking them and noting the need was met. Their responses are recorded neutrally or positively.

**Counterfactual.** Had nobody accepted by T+15:00, the radius would have expanded to 15km with a fresh set of donors, then 30km, then blood bank contacts would have been alerted on the operations console with a desk call.

**T+45:00.** Three donors arrive and are verified by code at the desk. The fourth is stood down on arrival and recorded as attended.

**T+2:30:00.** The hospital contact confirms completion. Cases closes, eligibility resets, scores update.

---

## 8. Open decisions and risks worth naming

**Telephony in Pakistan.** PTA rules on VoIP termination are restrictive. Confirm whether the plan is a local operator SIP trunk, a Twilio or Vonage Pakistan number, or a partnership with an operator. This is a regulatory question that can block launch and it is worth resolving before writing call handling code.

**Urdu ASR.** Accept that this will be the weakest component and design so that nothing critical depends on it. DTMF first is the mitigation.

**WhatsApp template approval.** Six templates, slow approval, blocks end to end testing. Submit in week one.

**Donor supply, not software.** The hardest problem is having enough registered eligible donors in each area. The matching engine is worthless against an empty registry. Realistically this needs a partnership with an existing network such as Alkhidmat, Fatimid, Sundas or a university blood drive programme, which also solves credibility at the hospital desk.

**Liability boundary.** Publish clearly that RedVyn coordinates people and does not screen, test, store or transport blood. All screening and crossmatching remain with the licensed blood bank.

**Data protection.** Phone numbers and health condition data are sensitive. Encrypt at rest, log all access, drop call audio after a short retention window and keep only transcripts, and write a retention policy before collecting the first record rather than after.

---

## 9. Suggested build order

1. Registries, consent flow, and the operations console. Nothing works without data.
2. Matching query and case creation, exercised manually through the console.
3. WhatsApp outreach with quick reply buttons. Cheaper and faster to build than voice, and it proves the whole coordination loop.
4. Codes, verification, and family confirmation.
5. Escalation scheduler with the sweeper.
6. Voice agent, DTMF path first, then Qwen dialogue on top.
7. Emergency mode with atomic allocation.
8. Prediction and reliability scoring.

Steps 1 through 4 are a working product. Everything after that makes it better rather than making it exist.
