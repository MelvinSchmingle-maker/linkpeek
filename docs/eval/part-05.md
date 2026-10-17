# Part 05 evaluation: extractive summaries

Made by `npm run eval` on 2026-10-17. The 20 articles in `eval/articles/` are fictional and self-written; the expected summaries in `eval/expected.json` were written by hand before the engine was run on them.

| Measure | Result |
|---|---|
| Articles with a summary | 20 of 20 |
| 20 words or fewer | 20 of 20 |
| Starting with filler | 0 |
| Trimmed at a clause boundary | 16 |
| Average length | 15.1 words |
| Average key-word overlap with the expected summary | 0.62 (0 to 1) |

Key-word overlap counts shared words of three letters or more. It rewards the right facts and names, and says nothing about whether a summary reads well. An extractive summary is the article's own sentence, so it will never match a hand-written summary closely.

| Article | Kind | Words | Overlap | LinkPeek's summary | Expected |
|---|---|---|---|---|---|
| 01-cycle-lanes | news, long opening sentence | 20 | 0.69 | Millbrook council has approved two kilometres of protected cycle lanes on High Street, with work due to start in March. | Millbrook council approved two kilometres of protected cycle lanes on High Street after a narrow vote. |
| 02-bridge | news, short opening sentence | 15 | 0.90 | The Old Mill footbridge reopened on Tuesday after fourteen weeks of repairs costing 410,000 pounds. | The Old Mill footbridge reopened after fourteen weeks of repairs costing the council 410,000 pounds. |
| 03-quote-opening | news that opens on a quote | 12 | 0.77 | Millbrook Leisure Centre will close its swimming pool for about a year. | Millbrook Leisure Centre pool will close for about a year after its roof failed a safety inspection. |
| 04-question-opening | news that opens on a question | 13 | 0.72 | Single fares on most Millbrook bus routes will rise by 20p from January. | Bus fares on most Millbrook routes will rise by 20p in January when a government fare cap ends. |
| 05-dateline | byline and update line before the story | 14 | 0.89 | Firefighters spent the night tackling a large fire at the disused Weaver Street mill. | Firefighters spent the night tackling a large fire at the disused Weaver Street mill; nobody was hurt. |
| 06-science-hedged | science with a hedged finding | 17 | 0.13 | The team grew 120 plants in two greenhouses, half in soil mixed with compost and half without. | A small university study suggests garden compost may reduce tomato blight, but the results need repeating at larger scale. |
| 07-court | court report with allegations | 11 | 0.78 | A former Millbrook councillor has denied fraud charges over community grants. | A former Millbrook councillor denies fraud charges over community grants allegedly paid to firms he controlled. |
| 08-sport | sports result | 16 | 0.56 | Millbrook Rovers reached the next round of the FA Trophy with a 3-2 win over Ashford. | Millbrook Rovers beat Ashford 3-2 in an FA Trophy replay and will play Dunmore in the next round. |
| 09-business | business results with numbers | 17 | 0.37 | Valley Foods, the Millbrook-based maker of ready meals, said profits fell by 18% to £42m last year. | Valley Foods profits fell 18% to £42m as energy and packaging costs rose, though sales grew 6%. |
| 10-weather | weather warning | 14 | 0.79 | Forecasters have issued a yellow warning for heavy rain across the valley on Thursday. | Forecasters issued a yellow warning for heavy rain across the valley on Thursday, with flooding possible near rivers. |
| 11-explainer | explainer with a filler-style opening | 14 | 0.81 | Car parks in Millbrook town centre will charge 1.20 pounds an hour from April. | Millbrook town centre car parks will charge 1.20 pounds an hour from April, with the first 30 minutes free. |
| 12-opinion | first-person opinion | 8 | 0.18 | I have lived in Millbrook for thirty years. | A columnist argues Millbrook should cut business rates for small shops instead of producing more high street plans. |
| 13-review | restaurant review | 14 | 0.08 | The menu changes every week and leans on vegetables from farms in the valley. | The Granary on Mill Lane serves excellent seasonal cooking at fair prices, though service can be slow. |
| 14-obituary | obituary | 17 | 0.93 | Margaret Ellis, who started the Millbrook Food Bank in her garage in 2009, has died aged 84. | Margaret Ellis, who founded the Millbrook Food Bank in her garage in 2009, has died aged 84. |
| 15-strike | transport strike | 18 | 0.64 | Rail staff on the valley line will strike on 4 and 11 November in a dispute over pay. | Rail staff will strike on 4 and 11 November in a pay dispute, with no trains expected through Millbrook. |
| 16-schools | education report | 16 | 0.59 | Hillside Primary School has been rated good by inspectors, who praised the way it teaches reading. | Inspectors rated Hillside Primary good, praising its reading teaching after two years of improvement. |
| 17-health | health statistics | 18 | 0.65 | Waiting times in the accident and emergency department at Millbrook General Hospital have fallen for a third month. | Accident and emergency waiting times at Millbrook General fell for a third month, with 71% seen within four hours. |
| 18-tech | product launch | 18 | 0.45 | A Millbrook startup has launched a small solar battery designed for allotments, where most plots have no electricity. | Millbrook startup Plotcell launched a 249-pound solar battery that powers allotment tools and lights for a week. |
| 19-french | French-language news | 16 | 0.96 | Le conseil municipal de Millbrook a approuvé deux kilomètres de pistes cyclables protégées sur la Grand-Rue. | Le conseil de Millbrook a approuvé deux kilomètres de pistes cyclables protégées sur la Grand-Rue. |
| 20-spanish | Spanish-language news | 13 | 0.57 | La biblioteca central de Millbrook abrirá también los domingos a partir de enero. | La biblioteca de Millbrook abrirá los domingos desde enero tras una revisión del servicio. |
