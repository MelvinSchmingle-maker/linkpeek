"""python3 scripts/make-eval-articles.py eval

Writes the Part 05 evaluation set: 20 fictional, self-written articles
(eval/articles/*.html) and hand-written expected summaries (eval/expected.json).
Nothing here is real news; every name and place is made up."""
import json, os, sys, html

out = sys.argv[1]
os.makedirs(os.path.join(out, 'articles'), exist_ok=True)

A = []
def add(slug, headline, site, kind, expected, paras, lang='en', standfirst=None, byline=None):
    A.append(dict(slug=slug, headline=headline, site=site, kind=kind, expected=expected, paras=paras, lang=lang, standfirst=standfirst, byline=byline))

add('01-cycle-lanes', 'Council approves protected cycle lanes for High Street', 'The Millbrook Gazette', 'news, long opening sentence',
    'Millbrook council approved two kilometres of protected cycle lanes on High Street after a narrow vote.',
    ['Millbrook council has approved two kilometres of protected cycle lanes on High Street, with work due to start in March after a narrow vote on Tuesday evening.',
     'Councillors voted seven to five in favour after a debate that ran for more than three hours. Shop owners on the street had asked for a delay until after the Christmas trading period.',
     'The lanes will be separated from traffic by low kerbs and planters. Twelve parking spaces will be removed, and four loading bays will move to side streets.',
     'The scheme is paid for by a regional transport grant of 1.8 million pounds, which the council says it would have lost if the vote had been delayed again.',
     'A petition against the plan gathered 640 signatures. Its organiser said traders would keep campaigning for changes to the loading arrangements.',
     'Work is expected to take eleven weeks. The council says buses will keep running throughout, with temporary stops near the library.'],
    byline='By Sam Jones')

add('02-bridge', 'Old Mill footbridge reopens after summer repairs', 'The Millbrook Gazette', 'news, short opening sentence',
    'The Old Mill footbridge reopened after fourteen weeks of repairs costing the council 410,000 pounds.',
    ['The Old Mill footbridge reopened on Tuesday after fourteen weeks of repairs costing 410,000 pounds.',
     'Engineers replaced the deck, which had been patched so often that nobody could say how much original timber was left.',
     'The work ran three weeks late after a delivery of steel brackets arrived in the wrong size and had to be sent back.',
     'Shopkeepers on Mill Lane said trade fell by about a third while the crossing was shut, because people from the estate stopped walking into town.',
     'The council said it would not pay compensation but would waive market stall fees for traders on the lane until the end of the year.',
     'A second phase, adding lighting and a ramp at the eastern end, is planned for spring if a funding bid succeeds.'])

add('03-quote-opening', 'Swimming pool to close for a year as roof fails safety check', 'The Millbrook Gazette', 'news that opens on a quote',
    'Millbrook Leisure Centre pool will close for about a year after its roof failed a safety inspection.',
    ['"We had no choice," said the centre manager, standing beside a fence that now blocks the entrance to the pool.',
     'Millbrook Leisure Centre will close its swimming pool for about a year after an inspection found corrosion in the steel frame of the roof.',
     'Engineers found that several beams had lost more than a fifth of their thickness, mostly where condensation collects above the shallow end.',
     'The gym and sports hall will stay open, but swimming lessons for about 900 children will move to a school pool eight miles away.',
     'The council has set aside 2.3 million pounds for a new roof. It says the work cannot start until a full survey is finished in January.',
     'Swimming clubs said they had warned for years that the building needed money, and asked for free buses to the replacement pool.'])

add('04-question-opening', 'Bus fares to rise by 20p on most routes from January', 'The Millbrook Gazette', 'news that opens on a question',
    'Bus fares on most Millbrook routes will rise by 20p in January when a government fare cap ends.',
    ['Why are bus fares going up again?',
     'Single fares on most Millbrook bus routes will rise by 20p from January, when a government cap on fares comes to an end.',
     'The operator, Valley Buses, said fuel and wages had risen faster than passenger numbers since the cap was introduced two years ago.',
     'Weekly tickets will go up by 1.50 pounds. Fares for under-19s and holders of concessionary passes will not change.',
     'The council said it had asked the operator to keep the Sunday service on route 7, which had been at risk, and that this had been agreed.',
     'Passenger groups said the rise would hit shift workers hardest, because early and late buses are already the least frequent.'])

add('05-dateline', 'Fire crews tackle blaze at disused mill', 'The Millbrook Gazette', 'byline and update line before the story',
    'Firefighters spent the night tackling a large fire at the disused Weaver Street mill; nobody was hurt.',
    ['By Priya Shah.',
     'Updated 3 hours ago.',
     'Firefighters spent the night tackling a large fire at the disused Weaver Street mill, which has stood empty for more than twenty years.',
     'Eight crews were called at about ten in the evening after residents reported flames coming through the roof. Nobody was hurt.',
     'Nearby homes were told to keep windows and doors closed because of the smoke, and the road will stay shut while the building is made safe.',
     'The fire service said it was too early to say how the fire started. The building has been the subject of several complaints about trespassing.',
     'The owner, a property company based in Leeds, had planning permission to turn the mill into flats but had not started work.'])

add('06-science-hedged', 'Garden compost may cut tomato blight, small study suggests', 'Millbrook Science Weekly', 'science with a hedged finding',
    'A small university study suggests garden compost may reduce tomato blight, but the results need repeating at larger scale.',
    ['A small study by researchers at Millbrook University suggests that adding garden compost to soil may reduce blight in tomato plants.',
     'The team grew 120 plants in two greenhouses, half in soil mixed with compost and half without, and recorded signs of the disease over one summer.',
     'Plants in the compost mix showed fewer blighted leaves on average, although the difference was smaller in the second greenhouse.',
     'The researchers stress that the study was small and covered only one variety and one season, so the result needs repeating before anyone draws firm conclusions.',
     'They think microbes in the compost may compete with the fungus that causes blight, but they did not test that directly.',
     'Gardeners should still remove infected leaves and avoid watering foliage, the team said, because those are the steps with the strongest evidence.'])

add('07-court', 'Former councillor denies fraud over grant payments', 'The Millbrook Gazette', 'court report with allegations',
    'A former Millbrook councillor denies fraud charges over community grants allegedly paid to firms he controlled.',
    ['A former Millbrook councillor has denied fraud charges over community grants that prosecutors say were paid to companies he secretly controlled.',
     'Martin Hale, 58, is accused of approving four grants worth a total of 96,000 pounds between 2022 and 2024 without declaring his interest.',
     'Prosecutors told the court that the money was meant for youth clubs and repair cafes, but some of it paid for work that was never done.',
     'Mr Hale pleaded not guilty to all four counts. His lawyer said he would argue that the grants were approved properly by a committee.',
     'The trial is expected to last two weeks. The council said it had changed its rules so that every grant over 5,000 pounds now needs two signatures.'])

add('08-sport', 'Millbrook Rovers beat Ashford in cup replay', 'Millbrook Sport', 'sports result',
    'Millbrook Rovers beat Ashford 3-2 in an FA Trophy replay and will play Dunmore in the next round.',
    ['Millbrook Rovers reached the next round of the FA Trophy with a 3-2 win over Ashford in a replay at the Mill Ground on Tuesday night.',
     'Ashford led twice in the first half, but goals from Kemi Adeyemi and Tom Price brought Rovers level before half-time.',
     'The winner came eight minutes from the end, when substitute Joel Hart headed in a corner at the near post.',
     'The crowd of 1,940 was the biggest at the ground for six seasons. The club said it would put on extra trains for the next home tie.',
     'Rovers will play Dunmore Town away in the next round. The manager said the squad had two injuries but expected both players to be fit.'])

add('09-business', 'Valley Foods profits fall as costs rise', 'Millbrook Business', 'business results with numbers',
    'Valley Foods profits fell 18% to £42m as energy and packaging costs rose, though sales grew 6%.',
    ['Valley Foods, the Millbrook-based maker of ready meals, said profits fell by 18% to £42m last year as energy and packaging costs rose.',
     'Sales grew by 6% to £610m, helped by new supermarket contracts, but the company said it had not been able to pass all its costs on to customers.',
     'Its chief executive said energy bills at the two factories had more than doubled in three years.',
     'The company will keep its dividend unchanged and says it has no plans to cut jobs. It employs about 2,300 people in the region.',
     'Shares fell by 4% in early trading before recovering most of the loss by the afternoon.'])

add('10-weather', 'Yellow warning for heavy rain across the valley', 'Millbrook Weather', 'weather warning',
    'Forecasters issued a yellow warning for heavy rain across the valley on Thursday, with flooding possible near rivers.',
    ['Forecasters have issued a yellow warning for heavy rain across the valley on Thursday, with up to 50 millimetres possible on high ground.',
     'The warning runs from six in the morning until midnight. Flooding is possible on roads near the river and in low-lying parts of the town.',
     'The Environment Agency said river levels were already high after a wet week, and it would open the flood barrier at Weir Lane if needed.',
     'Drivers are advised to allow extra time and not to drive through flood water. Schools are expected to open as normal.',
     'Drier weather is forecast from Friday, although showers may return at the weekend.'])

add('11-explainer', "What we know about the new town centre car parking charges", 'The Millbrook Gazette', 'explainer with a filler-style opening',
    'Millbrook town centre car parks will charge 1.20 pounds an hour from April, with the first 30 minutes free.',
    ["Here's what you need to know about the changes.",
     'Car parks in Millbrook town centre will charge 1.20 pounds an hour from April, but the first 30 minutes will stay free.',
     'The council says the charges will raise about 300,000 pounds a year, which will pay for repairs to the multi-storey car park.',
     'Blue badge holders will still park for free. Residents with permits will see no change.',
     'Traders worry that shoppers will go to the retail park on the bypass instead, where parking is free.',
     'The council says it will review the charges after a year and publish the figures for how many people use each car park.'])

add('12-opinion', 'Our high street needs fewer plans and more open shops', 'The Millbrook Gazette', 'first-person opinion',
    'A columnist argues Millbrook should cut business rates for small shops instead of producing more high street plans.',
    ['I have lived in Millbrook for thirty years, and I have read five plans for saving the high street in that time.',
     'Each one promised a market square, better signs and more trees. Each one ended with the same empty shops.',
     'The council should stop commissioning reports and cut business rates for small independent shops for three years instead.',
     'The cost would be about 400,000 pounds a year, roughly what the last two consultancy reports cost together.',
     'People do not visit a town for its signs. They visit for a baker, a bike shop and somewhere to sit down.'])

add('13-review', 'Review: The Granary is the best new restaurant in town', 'Millbrook Eats', 'restaurant review',
    'The Granary on Mill Lane serves excellent seasonal cooking at fair prices, though service can be slow.',
    ['The Granary, which opened on Mill Lane in September, serves some of the best cooking in Millbrook at prices that feel fair.',
     'The menu changes every week and leans on vegetables from farms in the valley. A starter of roasted beetroot with goat cheese was the highlight.',
     'Mains are around 16 pounds. The slow-cooked lamb was generous, though the fish of the day was slightly overcooked.',
     'Service was friendly but slow on a busy Friday, with a 25-minute wait between courses.',
     'The dining room is small, so booking is a good idea, especially at weekends.'])

add('14-obituary', 'Margaret Ellis, founder of the Millbrook Food Bank, has died aged 84', 'The Millbrook Gazette', 'obituary',
    'Margaret Ellis, who founded the Millbrook Food Bank in her garage in 2009, has died aged 84.',
    ['Margaret Ellis, who started the Millbrook Food Bank in her garage in 2009, has died aged 84.',
     'A retired school secretary, she began collecting tins after a parent at her old school told her they were skipping meals.',
     'The food bank now runs from a warehouse on the industrial estate and helps about 600 households a month, with more than 80 volunteers.',
     'She was made an MBE in 2018 but said the honour belonged to the volunteers.',
     'She is survived by her two sons and five grandchildren. Her family asked for donations to the food bank instead of flowers.'])

add('15-strike', 'Rail staff to strike on two days next month', 'The Millbrook Gazette', 'transport strike',
    'Rail staff will strike on 4 and 11 November in a pay dispute, with no trains expected through Millbrook.',
    ['Rail staff on the valley line will strike on 4 and 11 November in a dispute over pay and working hours, their union has announced.',
     'No trains are expected to run through Millbrook on either day. Replacement buses will run between Millbrook and the city every hour.',
     'The union says its members have been offered a 3% pay rise, which it calls a cut once rising prices are taken into account.',
     'The rail company says the offer is fair and that it wants talks to continue.',
     'Passengers with tickets for the strike days can use them the day before or up to two days after, or claim a refund.'])

add('16-schools', 'Inspectors praise reading at Hillside Primary', 'The Millbrook Gazette', 'education report',
    'Inspectors rated Hillside Primary good, praising its reading teaching after two years of improvement.',
    ['Hillside Primary School has been rated good by inspectors, who praised the way it teaches reading, two years after it was told it needed to improve.',
     'The report says pupils now read widely and often, and that staff quickly spot children who fall behind.',
     'Inspectors said maths teaching was still uneven between classes, and that some older pupils were not stretched enough.',
     'The head teacher said the change came from daily reading sessions and a new library paid for by parents.',
     'The school has 310 pupils. Its previous inspection, in 2024, found weaknesses in leadership and reading.'])

add('17-health', 'Waiting times at Millbrook hospital A&E fall for third month', 'Millbrook Health News', 'health statistics',
    'Accident and emergency waiting times at Millbrook General fell for a third month, with 71% seen within four hours.',
    ['Waiting times in the accident and emergency department at Millbrook General Hospital have fallen for a third month in a row, new figures show.',
     'In September, 71% of patients were seen within four hours, up from 64% in June. The national target is 78%.',
     'The hospital says a new urgent treatment centre next to the department has taken pressure off staff by treating minor injuries.',
     'Patients waiting more than twelve hours fell from 410 in June to 260 in September.',
     'Health managers warned that winter usually brings longer waits and said they were recruiting extra nurses.'])

add('18-tech', 'Millbrook startup launches solar battery for allotments', 'Millbrook Business', 'product launch',
    'Millbrook startup Plotcell launched a 249-pound solar battery that powers allotment tools and lights for a week.',
    ['A Millbrook startup has launched a small solar battery designed for allotments, where most plots have no electricity.',
     'The battery, made by Plotcell, costs 249 pounds and can power a water pump, lights and phone chargers for about a week on one charge.',
     'The company was founded by two engineers who met on a plot at the Green Lane allotments and grew tired of carrying car batteries.',
     'It has sold 300 units in pre-orders and plans to make the batteries in a unit on the industrial estate, creating six jobs.',
     'Independent tests have not yet been published, and the company says it will share results from a trial with the allotment society in the spring.'])

add('19-french', 'Le conseil approuve de nouvelles pistes cyclables', 'La Gazette de Millbrook', 'French-language news',
    'Le conseil de Millbrook a approuvé deux kilomètres de pistes cyclables protégées sur la Grand-Rue.',
    ['Le conseil municipal de Millbrook a approuvé deux kilomètres de pistes cyclables protégées sur la Grand-Rue, avec des travaux qui commenceront en mars.',
     'Les élus ont voté à sept voix contre cinq après un débat de plus de trois heures. Les commerçants avaient demandé un report après les fêtes.',
     'Les pistes seront séparées de la circulation par des bordures basses et des jardinières. Douze places de stationnement seront supprimées.',
     'Le projet est financé par une subvention régionale de 1,8 million de livres, que la commune aurait perdue en cas de nouveau report.',
     'Une pétition contre le projet a recueilli 640 signatures. Les travaux devraient durer onze semaines.'],
    lang='fr')

add('20-spanish', 'La biblioteca de Millbrook ampliará su horario', 'El Diario de Millbrook', 'Spanish-language news',
    'La biblioteca de Millbrook abrirá los domingos desde enero tras una revisión del servicio.',
    ['La biblioteca central de Millbrook abrirá también los domingos a partir de enero, según ha anunciado el ayuntamiento tras una revisión del servicio.',
     'El nuevo horario añade seis horas semanales y se financia con una partida de 85.000 libras del presupuesto de cultura.',
     'La revisión recomendó además un autobús biblioteca para los pueblos al norte del río, que empezará a funcionar en primavera.',
     'Los usuarios habían reunido casi mil firmas para pedir más horas de apertura durante el fin de semana.',
     'El ayuntamiento revisará el uso del servicio dominical dentro de un año.'],
    lang='es')

# Extra paragraphs so every article is a realistic length (written separately, kept in extra.json).
import json as _json
_extra = _json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'eval-articles-extra.json'), encoding='utf-8'))
for _a in A:
    _a['paras'] = _a['paras'] + _extra.get(_a['slug'], [])

def page(a):
    esc = html.escape
    parts = [f'<!doctype html><html lang="{a["lang"]}"><head><meta charset="utf-8" />',
             f'<title>{esc(a["headline"])} | {esc(a["site"])}</title>',
             f'<meta property="og:title" content="{esc(a["headline"])}" />',
             f'<meta property="og:site_name" content="{esc(a["site"])}" />',
             '<meta property="og:type" content="article" />',
             '<meta property="article:published_time" content="2026-10-15T08:00:00Z" />',
             '</head><body>',
             f'<header><p class="masthead">{esc(a["site"])}</p><nav><a href="/">Home</a> <a href="/news">News</a> <a href="/sport">Sport</a> <a href="/login">Log in</a></nav></header>',
             '<main><article>',
             f'<h1>{esc(a["headline"])}</h1>']
    if a['byline']:
        parts.append(f'<p class="byline">{esc(a["byline"])}</p>')
    for p in a['paras']:
        parts.append(f'<p>{esc(p)}</p>')
    parts.append('</article><aside><h3>Most read</h3><ul><li><a href="/x1">Bus fares frozen</a></li><li><a href="/x2">Market returns</a></li></ul></aside></main>')
    parts.append('<footer><p class="test-notice">LinkPeek evaluation page. Everything here is fictional and written for testing.</p><a href="/about">About</a> <a href="/privacy">Privacy</a></footer>')
    parts.append('</body></html>')
    return ''.join(parts)

expected = {}
for a in A:
    with open(os.path.join(out, 'articles', a['slug'] + '.html'), 'w', encoding='utf-8') as fh:
        fh.write(page(a))
    expected[a['slug']] = {'headline': a['headline'], 'kind': a['kind'], 'lang': a['lang'], 'expected': a['expected']}
with open(os.path.join(out, 'expected.json'), 'w', encoding='utf-8') as fh:
    json.dump(expected, fh, indent=2, ensure_ascii=False)
    fh.write('\n')
words = [len(a['expected'].split()) for a in A]
print(len(A), 'articles; expected summary words max', max(words))
