# Part 07 evaluation: the headline check

Made by `npm run eval` on 2026-10-17. Labels follow `build-plan/07-clickbait-check.md`. Free: no AI, no network.

A false cross is worse than a missed one, so precision comes first. Recall is what the check misses. The first run, before any tuning, is kept in `docs/eval/part-07-first-run.md`.

## Labelled set (the rules were tuned on this)

File: `eval/headlines.json`, 81 headlines.

### Crosses

| | Precision | Recall | True | False | Missed |
|---|---|---|---|---|---|
| All items | 100% | 92% | 23 | 0 | 2 |
| With the article (full evidence) | 100% | 100% | 14 | 0 | 0 |
| Headline only | 100% | 82% | 9 | 0 | 2 |

### Ticks and neutrals

| | Precision | Recall |
|---|---|---|
| Tick | 100% | 69% |
| Neutral | 88% | 100% |

### Confusion matrix (rows: label, columns: prediction)

| Label | cross | tick | neutral |
|---|---|---|---|
| cross | 23 | 0 | 2 |
| tick | 0 | 9 | 4 |
| neutral | 0 | 0 | 43 |

### Every item it got wrong

| Id | Headline | Label | Predicted | Reason given | Note |
|---|---|---|---|---|---|
| c09 | What the minister said next left the room silent | cross | neutral |  | Withheld result, but not a listed pattern. Expected miss. |
| c10 | She opened the box. What she found inside changed everything | cross | neutral |  | Withheld result, not a listed pattern. Expected miss. |
| t09 | Hospital waiting times fall for third month | tick | neutral |  | The article backs it up, but the headline has no figure to match. Expected miss. |
| t10 | Heavy rain warning for the valley on Thursday | tick | neutral |  | No figure in the headline. Expected miss. |
| t14 | Museum attendance tops 500,000 for first time | tick | neutral |  | The article supports the headline, but the figure is a count, not money or a percentage. Expected miss. |
| t15 | Waste collections move to fortnightly from May | tick | neutral |  | The article backs it up, but there's no figure. Expected miss. |

### Every item

| Id | Headline | Label | Predicted | Reason given | Article |
|---|---|---|---|---|---|
| c01 | You won't believe what this council found in its bin lorries | cross | cross | The headline holds back its main point to make you click. | no |
| c02 | This one simple trick cuts your energy bill in half | cross | cross | The headline holds back its main point to make you click. | no |
| c03 | What happened next will change how you pay your pension | cross | cross | The headline holds back its main point to make you click. | no |
| c04 | You'll never guess which high street chain is closing next | cross | cross | The headline holds back its main point to make you click. | no |
| c05 | The shocking truth about your morning coffee | cross | cross | The headline holds back its main point to make you click. | no |
| c06 | Wait until you see what this dog does with a tennis ball | cross | cross | The headline holds back its main point to make you click. | no |
| c07 | You won't believe the final score of the Millbrook derby | cross | cross | The headline holds back its main point to make you click. | no |
| c08 | This is the one thing doctors wish you knew about sleep | cross | cross | The headline holds back its main point to make you click. | no |
| c09 | What the minister said next left the room silent | cross | neutral |  | no |
| c10 | She opened the box. What she found inside changed everything | cross | neutral |  | no |
| c25 | You won't believe how much the council spent on paint | cross | cross | The headline holds back its main point to make you click. | no |
| c11 | Common painkiller cures blood cancer, study finds | cross | cross | The headline says "cures", but the article describes a study in animals. | yes |
| c12 | Coffee cures memory loss, says new study | cross | cross | The headline says "cures", but the article describes a small study. | yes |
| c13 | New nasal spray stops flu in its tracks | cross | cross | The headline says "stops flu", but the article describes a study in animals. | yes |
| c14 | Tesla profits soar 40% in third quarter | cross | cross | The headline gives 40%, but none of the article's figures match it. | yes |
| c15 | Council to pay £5m to bus company | cross | cross | The headline gives £5m, but none of the article's figures match it. | yes |
| c16 | Breaking: council approves new bus lanes | cross | cross | The headline presents this as happening now, but the article is dated 10 March 2021. | yes |
| c17 | Happening now: the motorway is closed after a crash | cross | cross | The headline presents this as happening now, but the article is dated 2 July 2019. | yes |
| c18 | Study proves music makes you live longer | cross | cross | The headline says "proves", but the article describes an observational study. | yes |
| c19 | Eating nuts cuts heart attack risk, proven | cross | cross | The headline says "proven", but the article describes early results. | yes |
| c20 | Vitamin D kills off Covid, researchers confirm | cross | cross | The headline says "kills", but the article describes lab tests. | yes |
| c23 | Oil firm hit by 25% profit fall | cross | cross | The headline gives 25%, but none of the article's figures match it. | yes |
| c24 | Charity raised £3m in one day | cross | cross | The headline gives £3m, but none of the article's figures match it. | yes |
| c28 | Green tea reverses ageing, lab study shows | cross | cross | The headline says "reverses", but the article describes lab tests. | yes |
| c29 | Sugar free drinks guarantee weight loss, study finds | cross | cross | The headline says "guarantee", but the article describes an observational study. | yes |
| t05 | Valley Foods profits fall 18% to £42m | tick | tick | The headline's figure, £42m, appears in the article. | yes |
| t06 | Council cuts bus fares to £1 for under-25s | tick | tick | The headline's figure, £1, appears in the article. | yes |
| t07 | Sales at Greenfield Bakery rise 9% to £310m | tick | tick | The headline's figure, £310m, appears in the article. | yes |
| t08 | Single fares up 20p from January | tick | tick | The headline's figure, 20p, appears in the article. | yes |
| t09 | Hospital waiting times fall for third month | tick | neutral |  | yes |
| t10 | Heavy rain warning for the valley on Thursday | tick | neutral |  | yes |
| t11 | Plotcell launches £249 solar battery for allotments | tick | tick | The headline's figure, £249, appears in the article. | yes |
| t12 | Council agrees to pay £5m to bus company | tick | tick | The headline's figure, £5m, appears in the article. | yes |
| n23 | Rents up 3% in a year | tick | tick | The headline's figure, 3%, appears in the article. | yes |
| t14 | Museum attendance tops 500,000 for first time | tick | neutral |  | yes |
| t15 | Waste collections move to fortnightly from May | tick | neutral |  | yes |
| t16 | Museum to reopen after £2m refurbishment | tick | tick | The headline's figure, £2m, appears in the article. | yes |
| t17 | Hospital car park charges rise to £4 a day | tick | tick | The headline's figure, £4, appears in the article. | yes |
| n01 | Families flee as wildfire reaches the edge of Mendocino | neutral | neutral |  | no |
| n02 | Heartbreak as town loses its last bank | neutral | neutral |  | yes |
| n03 | Is it safe to eat raw cookie dough? | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n04 | Could this be the end of the Millbrook library? | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n05 | 7 things to check before you buy a used car | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n06 | 17 reasons your cat is judging you | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n07 | Here's how the council plans to spend £2m on parks | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n08 | The most important election result in 30 years | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n09 | Stop what you're doing and read this council report | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n11 | Council leader resigns after row over budget | neutral | neutral |  | no |
| n12 | Millbrook Rovers beat Ashford 3-2 in a replay | neutral | neutral |  | no |
| n13 | Rail strike to close Valley line on 4 and 11 November | neutral | neutral |  | no |
| n14 | Hospital trust cancels 300 operations after flood damage | neutral | neutral |  | no |
| n15 | Bus fares rise by 20p in January | neutral | neutral |  | no |
| n16 | Council to build new cycle lanes on High Street from March | neutral | neutral |  | no |
| n17 | Coffee may help memory, early study suggests | neutral | neutral |  | yes |
| n18 | Coffee cures memory loss | neutral | neutral |  | no |
| n25 | Timeline: what happened next in the Ellis case | neutral | neutral |  | no |
| n26 | This is why the pound is falling | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n27 | Here's what the Prime Minister said about housing | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n28 | Breaking: council approves new bus lanes | neutral | neutral |  | yes |
| n29 | Hillside Primary rated good by inspectors | neutral | neutral |  | yes |
| n30 | Margaret Ellis, who founded the food bank, has died aged 84 | neutral | neutral |  | yes |
| n22 | Council to pay £5m to bus company | neutral | neutral |  | yes |
| n31 | Local MP to stand down at next election | neutral | neutral |  | no |
| n32 | School to close for two days after storm damage | neutral | neutral |  | no |
| n33 | Ferry operator adds Sunday sailings | neutral | neutral |  | no |
| n34 | Charity launches winter appeal for food banks | neutral | neutral |  | no |
| n35 | Man charged over Mill Road fire | neutral | neutral |  | no |
| n38 | Council warns of rise in fly-tipping | neutral | neutral |  | no |
| n39 | Village pub named best in county | neutral | neutral |  | no |
| n40 | Scientists find new species of frog in Borneo | neutral | neutral |  | no |
| n41 | Town centre to get new benches | neutral | neutral |  | no |
| n42 | Residents react to new bus timetable | neutral | neutral |  | no |
| n43 | Bakery reports strong year | neutral | neutral |  | no |
| n44 | A guide to council tax bands | neutral | neutral |  | no |
| n45 | Families of the crash victims ask for answers | neutral | neutral |  | no |
| n46 | Why the high street is struggling | neutral | neutral |  | no |
| n47 | The reason the Harbour Ferries timetable changed | neutral | neutral |  | no |
| n48 | Plant nursery closes after 40 years | neutral | neutral |  | no |
| n49 | A new report on library funding is due this week | neutral | neutral |  | no |
| n50 | Power cut hits thousands across the south | neutral | neutral |  | no |
| n51 | Waterfront plans go out to consultation | neutral | neutral |  | no |

## Held-out set (not used for tuning)

File: `eval/headlines-holdout.json`, 30 headlines.

### Crosses

| | Precision | Recall | True | False | Missed |
|---|---|---|---|---|---|
| All items | 100% | 90% | 9 | 0 | 1 |
| With the article (full evidence) | 100% | 100% | 5 | 0 | 0 |
| Headline only | 100% | 80% | 4 | 0 | 1 |

### Ticks and neutrals

| | Precision | Recall |
|---|---|---|
| Tick | 100% | 67% |
| Neutral | 89% | 100% |

### Confusion matrix (rows: label, columns: prediction)

| Label | cross | tick | neutral |
|---|---|---|---|
| cross | 9 | 0 | 1 |
| tick | 0 | 2 | 1 |
| neutral | 0 | 0 | 17 |

### Every item it got wrong

| Id | Headline | Label | Predicted | Reason given | Note |
|---|---|---|---|---|---|
| h02 | Doctors hate this one weird trick for better sleep | cross | neutral |  | Bait, but 'weird' isn't in the pattern list. Expected miss. |
| h25 | Hospital opens new cancer unit | tick | neutral |  | The article backs the headline, but there's no figure in the headline. Expected miss. |

### Every item

| Id | Headline | Label | Predicted | Reason given | Article |
|---|---|---|---|---|---|
| h01 | You'll never believe what the bride's dad did at the altar | cross | cross | The headline holds back its main point to make you click. | no |
| h02 | Doctors hate this one weird trick for better sleep | cross | neutral |  | no |
| h03 | What happened next will shock the village | cross | cross | The headline holds back its main point to make you click. | no |
| h04 | The moment the tram driver saw the child, nobody expected this | neutral | neutral |  | no |
| h05 | Wait until you hear what this council did with the reserve fund | cross | cross | The headline holds back its main point to make you click. | no |
| h06 | This is the one trick to save on your gas bill | cross | cross | The headline holds back its main point to make you click. | no |
| h07 | Honey heals burns, scientists prove | cross | cross | The headline says "prove", but the article describes a study in animals. | yes |
| h08 | Honey may heal burns, early tests suggest | neutral | neutral |  | yes |
| h09 | Football club makes £20m loss last season | cross | cross | The headline gives £20m, but none of the article's figures match it. | yes |
| h10 | Ticket sales raised £6.1m for the club | tick | tick | The headline's figure, £6.1m, appears in the article. | yes |
| h11 | Happening today: rail line reopens after repairs | cross | cross | The headline presents this as happening now, but the article is dated 15 January 2020. | yes |
| h12 | Breaking: rail line reopens after repairs | neutral | neutral |  | yes |
| h13 | Council agrees new recycling targets | neutral | neutral |  | yes |
| h14 | Garden compost is linked to healthier tomatoes | neutral | neutral |  | yes |
| h15 | Should you rent or buy in 2026? | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| h16 | 10 surprising facts about the Thames | neutral | neutral |  | no |
| h17 | Mother's heartbreak as the last ferry leaves the island | neutral | neutral |  | no |
| h18 | The best ever result for the Millbrook under-12s | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| h19 | Mayor defends decision to close two parks | neutral | neutral |  | no |
| h20 | Here's the council's full plan for the old mill | neutral | neutral |  | no |
| h21 | You won't believe the results of the council's bin survey | cross | cross | The headline holds back its main point to make you click. | yes |
| h22 | Schools to get £2m for new roofs | tick | tick | The headline's figure, £2m, appears in the article. | yes |
| h23 | Man, 34, arrested after bus station disturbance | neutral | neutral |  | no |
| h24 | The secret ingredient in your breakfast cereal | neutral | neutral |  | no |
| h25 | Hospital opens new cancer unit | tick | neutral |  | yes |
| h26 | Green coffee guarantees fat loss, trial shows | cross | cross | The headline says "guarantees", but the article describes results that still need more testing. | yes |
| h27 | Fire crews tackle blaze at Harbour Road warehouse | neutral | neutral |  | no |
| h28 | Trust apologises after patients left in corridor | neutral | neutral |  | no |
| h29 | Breaking: museum to close early on Fridays | neutral | neutral |  | yes |
| h30 | Council fines firm £50,000 | neutral | neutral |  | yes |
