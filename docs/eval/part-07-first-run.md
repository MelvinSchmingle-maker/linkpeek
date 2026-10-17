# Part 07 evaluation: the headline check

Made by `npm run eval` on 2026-10-17 on 81 labelled headlines (`eval/headlines.json`). Labels follow `build-plan/07-clickbait-check.md`. Free: no AI, no network.

The cross numbers are the ones that matter. A false cross is worse than a missed one, so precision comes first. Recall is what the check misses.

## Crosses

| | Precision | Recall | True | False | Missed |
|---|---|---|---|---|---|
| All items | 95% | 80% | 20 | 1 | 5 |
| With the article (full evidence) | 100% | 86% | 12 | 0 | 2 |
| Headline only | 89% | 73% | 8 | 1 | 3 |

## Ticks and neutrals

| | Precision | Recall |
|---|---|---|
| Tick | 100% | 62% |
| Neutral | 81% | 98% |

## Confusion matrix (rows: label, columns: prediction)

| Label | cross | tick | neutral |
|---|---|---|---|
| cross | 20 | 0 | 5 |
| tick | 0 | 8 | 5 |
| neutral | 1 | 0 | 42 |

## Crosses that went wrong, and misses

| Id | Headline | Label | Predicted | Reason given | Note |
|---|---|---|---|---|---|
| c08 | This is the one thing doctors wish you knew about sleep | cross | neutral |  |  |
| c09 | What the minister said next left the room silent | cross | neutral |  | Withheld result, but not a listed pattern. Expected miss. |
| c10 | She opened the box. What she found inside changed everything | cross | neutral |  | Withheld result, not a listed pattern. Expected miss. |
| c14 | Tesla profits soar 40% in third quarter | cross | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. |  |
| c23 | Oil firm hit by 25% profit fall | cross | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. |  |
| n25 | Timeline: what happened next in the Ellis case | neutral | cross | The headline holds back its main point to make you click. | A plain timeline headline. Tests the withheld-fact rule for false crosses. |

## Every item

| Id | Headline | Label | Predicted | Reason given | Article |
|---|---|---|---|---|---|
| c01 | You won't believe what this council found in its bin lorries | cross | cross | The headline holds back its main point to make you click. | no |
| c02 | This one simple trick cuts your energy bill in half | cross | cross | The headline holds back its main point to make you click. | no |
| c03 | What happened next will change how you pay your pension | cross | cross | The headline holds back its main point to make you click. | no |
| c04 | You'll never guess which high street chain is closing next | cross | cross | The headline holds back its main point to make you click. | no |
| c05 | The shocking truth about your morning coffee | cross | cross | The headline holds back its main point to make you click. | no |
| c06 | Wait until you see what this dog does with a tennis ball | cross | cross | The headline holds back its main point to make you click. | no |
| c07 | You won't believe the final score of the Millbrook derby | cross | cross | The headline holds back its main point to make you click. | no |
| c08 | This is the one thing doctors wish you knew about sleep | cross | neutral |  | no |
| c09 | What the minister said next left the room silent | cross | neutral |  | no |
| c10 | She opened the box. What she found inside changed everything | cross | neutral |  | no |
| c25 | You won't believe how much the council spent on paint | cross | cross | The headline holds back its main point to make you click. | no |
| c11 | Common painkiller cures blood cancer, study finds | cross | cross | The headline says "cures", but the article describes a study in animals. | yes |
| c12 | Coffee cures memory loss, says new study | cross | cross | The headline says "cures", but the article describes a small study. | yes |
| c13 | New nasal spray stops flu in its tracks | cross | cross | The headline says "stops flu", but the article describes a study in animals. | yes |
| c14 | Tesla profits soar 40% in third quarter | cross | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| c15 | Council to pay £5m to bus company | cross | cross | The headline gives £5m, but none of the article's figures match it. | yes |
| c16 | Breaking: council approves new bus lanes | cross | cross | The headline presents this as happening now, but the article is dated 10 March 2021. | yes |
| c17 | Happening now: the motorway is closed after a crash | cross | cross | The headline presents this as happening now, but the article is dated 2 July 2019. | yes |
| c18 | Study proves music makes you live longer | cross | cross | The headline says "proves", but the article describes an observational study. | yes |
| c19 | Eating nuts cuts heart attack risk, proven | cross | cross | The headline says "proven", but the article describes early results. | yes |
| c20 | Vitamin D kills off Covid, researchers confirm | cross | cross | The headline says "kills", but the article describes lab tests. | yes |
| c23 | Oil firm hit by 25% profit fall | cross | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| c24 | Charity raised £3m in one day | cross | cross | The headline gives £3m, but none of the article's figures match it. | yes |
| c28 | Green tea reverses ageing, lab study shows | cross | cross | The headline says "reverses", but the article describes lab tests. | yes |
| c29 | Sugar free drinks guarantee weight loss, study finds | cross | cross | The headline says "guarantee", but the article describes an observational study. | yes |
| t05 | Valley Foods profits fall 18% to £42m | tick | tick | The headline's figure, £42m, appears in the article. | yes |
| t06 | Council cuts bus fares to £1 for under-25s | tick | tick | The headline's figure, £1, appears in the article. | yes |
| t07 | Sales at Greenfield Bakery rise 9% to £310m | tick | tick | The headline's figure, £310m, appears in the article. | yes |
| t08 | Single fares up 20p from January | tick | tick | The headline's figure, 20p, appears in the article. | yes |
| t09 | Hospital waiting times fall for third month | tick | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| t10 | Heavy rain warning for the valley on Thursday | tick | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| t11 | Plotcell launches £249 solar battery for allotments | tick | tick | The headline's figure, £249, appears in the article. | yes |
| t12 | Council agrees to pay £5m to bus company | tick | tick | The headline's figure, £5m, appears in the article. | yes |
| n23 | Rents up 3% in a year | tick | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| t14 | Museum attendance tops 500,000 for first time | tick | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| t15 | Waste collections move to fortnightly from May | tick | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| t16 | Museum to reopen after £2m refurbishment | tick | tick | The headline's figure, £2m, appears in the article. | yes |
| t17 | Hospital car park charges rise to £4 a day | tick | tick | The headline's figure, £4, appears in the article. | yes |
| n01 | Families flee as wildfire reaches the edge of Mendocino | neutral | neutral |  | no |
| n02 | Heartbreak as town loses its last bank | neutral | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
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
| n17 | Coffee may help memory, early study suggests | neutral | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| n18 | Coffee cures memory loss | neutral | neutral |  | no |
| n25 | Timeline: what happened next in the Ellis case | neutral | cross | The headline holds back its main point to make you click. | no |
| n26 | This is why the pound is falling | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n27 | Here's what the Prime Minister said about housing | neutral | neutral | The headline appears vague. The article could not be retrieved, so the content comparison is unavailable. | no |
| n28 | Breaking: council approves new bus lanes | neutral | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| n29 | Hillside Primary rated good by inspectors | neutral | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| n30 | Margaret Ellis, who founded the food bank, has died aged 84 | neutral | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
| n22 | Council to pay £5m to bus company | neutral | neutral | We found no clickbait pattern we can confirm. That doesn't mean the story is true. | yes |
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
