import type { PageSet } from "./types";

// Default Albanian copy. Words in {{double braces}} are filled from admin settings.
export const sq: PageSet = {
  "services/emergency-towing": {
    title: "Tërheqje urgjente 24/7",
    description: "Aksident, defekt motori apo vetura nuk ndizet? Vijmë ditë e natë në gjithë Kosovën.",
    body: `
## Kur të na thërrisni

- Pas një aksidenti, kur vetura nuk mund të vazhdojë rrugën
- Kur motori ose kambio dështon gjatë rrugës
- Kur vetura nuk ndizet në shtëpi, në parking ose në garazh
- Kur vetura ka mbetur në kanal, në borë ose në baltë

## Si funksionon

1. **Na thërrisni ose dërgoni lokacionin në WhatsApp.** Butoni "Dërgo lokacionin" e bën këtë me një prekje.
2. **Ju tregojmë çmimin dhe kohën e mbërritjes** para se të nisemi.
3. **Shoferi ynë vjen me platformë** dhe e ngarkon veturën me kujdes.
4. **E dërgojmë veturën** te servisi, në shtëpi ose ku të doni.

## Pse ne

- Zakonisht arrijmë brenda 30 minutave
- Platforma me vinç për vetura që nuk lëvizin
- Çmim i qartë para nisjes, pa kosto të fshehura
- Faturë me TVSH për kompani dhe sigurime

Në rast aksidenti me të lënduar, thirrni fillimisht **112**.
`,
  },
  "services/roadside-assistance": {
    title: "Ndihmë në rrugë",
    description: "Bateri e zbrazët, gomë e shpuar, pa karburant ose çelësat brenda? Ju ndihmojmë në vend.",
    body: `
## Çfarë rregullojmë në vend

- **Ndezje me kabllo** kur bateria është zbrazur
- **Ndërrim gome** me rezervën tuaj
- **Karburant** kur keni mbetur pa naftë ose benzinë
- **Hapje e veturës** kur çelësat kanë mbetur brenda
- **Nxjerrje me vinç** nga kanali, bora ose balta

Nëse vetura nuk mund të rregullohet në vend, e tërheqim menjëherë te servisi që zgjidhni.

## Si funksionon

1. Na thërrisni ose dërgoni lokacionin.
2. Ju themi çmimin dhe kur arrijmë.
3. Paguani vetëm pasi problemi është zgjidhur.
`,
  },
  "services/car-transport": {
    title: "Transport veturash brenda Kosovës",
    description: "Nga qyteti në qytet, te servisi ose te pronari i ri. Transport i planifikuar me platformë.",
    body: `
## Për kë është

- Keni blerë veturë në një qytet tjetër
- Vetura duhet të shkojë te servisi ose te kontrolli teknik
- Vetura nuk ka regjistrim ose sigurim për të qarkulluar
- Keni nevojë të lëvizni disa vetura njëherësh (kemi bartës deri në 4 vende)

## Si funksionon

1. **Llogaritni çmimin online** me adresat e marrjes dhe të dorëzimit.
2. **Rezervoni datën dhe orën** që ju përshtatet.
3. **Merrni konfirmim me SMS ose WhatsApp** dhe njoftim kur shoferi niset.
4. **Vetura dorëzohet** me fotografi para dhe pas ngarkimit.

Çdo veturë është e siguruar nga ngarkimi deri në dorëzim.
`,
  },
  "services/car-import": {
    title: "Import veturash nga Evropa",
    description: "Transport veturash nga Gjermania, Zvicra dhe Austria në Kosovë, me ndihmë për doganë dhe targa eksporti.",
    body: `
## Nga ku sjellim

Gjermani, Zvicër, Austri, Itali, Francë, Belgjikë, Holandë, Suedi dhe vende të tjera të BE-së, me marrje direkt te shitësi ose te pronari.

## Çfarë përfshihet

- Marrja e veturës te adresa e shitësit
- Transport me bartës të mbyllur ose të hapur
- Ndihmë me targat e eksportit dhe dokumentet
- Ndihmë me procedurat doganore në Kosovë
- Dorëzimi në adresën tuaj ose te zyra doganore

## Si funksionon

1. Na tregoni ku është vetura dhe çfarë veture është.
2. Ju dërgojmë çmimin dhe kohën e përafërt të transportit.
3. Ne e marrim veturën dhe ju njoftojmë në çdo hap.
4. Vetura mbërrin në Kosovë dhe ju ndihmojmë me doganën.

Lexoni [udhëzuesin për import](/import-guide) për dokumentet që duhen.
`,
  },
  "import-guide": {
    title: "Udhëzues për importin e veturës",
    description: "Hap pas hapi: dokumentet, targat e eksportit, dogana dhe regjistrimi i veturës së importuar në Kosovë.",
    body: `
## 1. Para blerjes

- Kontrolloni historinë e veturës dhe kilometrat
- Sigurohuni që shitësi ka dokumentet origjinale të pronësisë
- Pyesni nëse vetura ka dëmtime ose është "Unfallwagen"

## 2. Dokumentet që duhen

- Kontrata e shitblerjes ose fatura
- Leja e qarkullimit (në Gjermani: Zulassungsbescheinigung Teil I dhe II)
- Certifikata e konformitetit (COC), nëse e keni
- Kopje e letërnjoftimit ose pasaportës së blerësit

## 3. Targat e eksportit

Vetura duhet të ketë targa eksporti ose targa të përkohshme për të dalë nga vendi. Ne mund të ndihmojmë me rregullimin e tyre në Gjermani, Austri dhe Zvicër.

## 4. Transporti

Vetura transportohet me bartës. Koha e përafërt nga Gjermania në Kosovë është 3 deri në 7 ditë, varësisht nga vendi i marrjes.

## 5. Dogana në Kosovë

Në mbërritje paguhen dogana, akcizat dhe TVSH sipas rregullave të Doganës së Kosovës. Shuma varet nga vlera, viti dhe motori i veturës. Ju ndihmojmë me dokumentet që kërkon dogana.

## 6. Regjistrimi

Pas zhdoganimit, vetura kalon kontrollin teknik dhe regjistrohet në qendrën e regjistrimit të automjeteve.

Keni pyetje? Na thërrisni ose [kërkoni një ofertë](/quote?service=INTERNATIONAL_TRANSPORT).
`,
  },
  about: {
    title: "Rreth nesh",
    description: "{{brand.name}} është kompani tërheqjeje dhe transporti veturash në Kosovë, në shërbim 24 orë në ditë.",
    body: `
**{{brand.name}}** është kompani familjare për tërheqje dhe transport veturash në Kosovë.

Ditë e natë ndihmojmë shoferët pas aksidenteve dhe defekteve, lëvizim vetura brenda Kosovës dhe sjellim vetura nga Evropa.

## Si punojmë

- **Shpejt:** zakonisht arrijmë brenda 30 minutave
- **Qartë:** e dini çmimin para se të nisemi
- **Me kujdes:** fotografojmë veturën para dhe pas ngarkimit, dhe çdo transport është i siguruar
- **Me faturë:** lëshojmë faturë me TVSH për persona privatë, kompani dhe sigurime

## Kontakt

- Telefon: {{contact.phone}}
- Email: {{contact.email}}
`,
  },
  "legal/terms": {
    title: "Kushtet e përdorimit",
    description: "Kushtet për përdorimin e faqes dhe për shërbimet e tërheqjes dhe transportit.",
    body: `
Këto kushte vlejnë për përdorimin e kësaj faqeje dhe për shërbimet që ofron **{{company.legalName}}** ("ne"), {{company.address}} {{company.city}}, Kosovë.

## 1. Ofertat dhe çmimet

- Çmimi që shfaqet online është **çmim i përafërt** dhe përfshin TVSH-në.
- Çmimi përfundimtar konfirmohet nga operatori para fillimit të shërbimit.
- Kostot shtesë (pritje, vinç, rrugë të vështira, taksa rrugore) ju tregohen para se të ndodhin.

## 2. Rezervimi

- Rezervimi bëhet i detyrueshëm kur e konfirmojmë me telefon, SMS, WhatsApp ose email.
- Ju jeni përgjegjës që të dhënat për veturën, adresat dhe kontaktin të jenë të sakta.

## 3. Anulimi

- Mund ta anuloni falas një transport të planifikuar deri në 24 orë para orës së marrjes.
- Nëse anuloni më vonë, ose nëse shoferi ynë ka arritur në vend, mund të faturojmë kostot e daljes.

## 4. Gjatë transportit

- Para ngarkimit e fotografojmë veturën dhe shënojmë dëmtimet ekzistuese.
- Mos lini sende me vlerë në veturë. Nuk përgjigjemi për sende të lëna në veturë.
- Vetura është e siguruar nga ngarkimi deri në dorëzim.

## 5. Pagesa

- Pagesa bëhet me para në dorë ose me transfer bankar sipas faturës.
- Faturat duhet të paguhen brenda afatit të shënuar në faturë.

## 6. Ankesat

Dëmtimet duhet të na lajmërohen në momentin e dorëzimit dhe të shënohen në fletën e dorëzimit. Ankesat e tjera na i dërgoni në {{contact.email}}.

## 7. Ligji

Për këto kushte vlen ligji i Republikës së Kosovës.
`,
  },
  "legal/privacy": {
    title: "Politika e privatësisë",
    description: "Si i mbledhim, i përdorim dhe i mbrojmë të dhënat tuaja personale.",
    body: `
Kjo politikë shpjegon si **{{company.legalName}}**, {{company.address}} {{company.city}}, Kosovë ("ne") i përpunon të dhënat personale sipas Ligjit Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale.

## Çfarë të dhënash mbledhim

- **Kontakti:** emri, numri i telefonit, email-i dhe kanali i preferuar
- **Shërbimi:** adresat e marrjes dhe të dorëzimit, lokacioni GPS nëse e dërgoni, data dhe ora
- **Vetura:** marka, modeli, viti, targat, VIN dhe fotografitë që ngarkoni
- **Faturimi:** emri i kompanisë, NUI dhe adresa, nëse kërkoni faturë
- **Teknike:** adresa IP dhe të dhëna bazë të shfletuesit, për siguri

## Pse i përdorim

- Për të llogaritur çmimin dhe për të kryer shërbimin që kërkoni
- Për t'ju njoftuar me SMS, WhatsApp ose email për porosinë
- Për faturim dhe për detyrimet ligjore e tatimore
- Për marketing, vetëm nëse jeni pajtuar

## Me kë i ndajmë

- Me shoferët tanë që kryejnë shërbimin
- Me ofruesit e SMS dhe email-it që dërgojnë njoftimet
- Me ofruesin e hostimit dhe të ruajtjes së fotografive në BE
- Me autoritetet, kur ligji e kërkon

Nuk i shesim të dhënat tuaja.

## Sa kohë i ruajmë

- Ofertat pa rezervim: {{retention.draftsDays}} ditë
- Fotografitë e inspektimit: {{retention.inspectionPhotosDays}} ditë
- Rruga që kamioni ynë bëri për porosinë tuaj (GPS): {{retention.gpsDays}} ditë
- Dokumentet e tjera të porosisë: {{retention.documentsDays}} ditë
- Faturat: aq sa kërkon ligji tatimor

## Të drejtat tuaja

Keni të drejtë të kërkoni qasje, korrigjim ose fshirje të të dhënave, kufizim të përpunimit, dhe të tërhiqni pëlqimin për marketing në çdo kohë. Na shkruani në {{contact.email}}.

Keni të drejtë të ankoheni edhe te Agjencia për Informim dhe Privatësi (AIP).
`,
  },
  "legal/cookies": {
    title: "Politika e cookies",
    description: "Cilat cookies përdorim dhe si mund t'i ndryshoni zgjedhjet tuaja.",
    body: `
## Të domosdoshme

Këto nevojiten që faqja të funksionojë dhe nuk mund të çaktivizohen.

| Emri | Qëllimi | Kohëzgjatja |
| --- | --- | --- |
| ab_consent | Ruan zgjedhjen tuaj për cookies | 6 muaj |
| NEXT_LOCALE | Ruan gjuhën e zgjedhur | Sesioni |

Formulari i rezervimit përdor Cloudflare Turnstile për t'u mbrojtur nga robotët.

Në shfletues ruajmë gjithashtu (në localStorage) rezervimin e papërfunduar dhe zgjedhjen e temës së errët. Këto nuk dërgohen te ne.

## Analitikë

Vetëm nëse pajtoheni: Google Analytics, për të kuptuar si përdoret faqja.

## Marketing

Vetëm nëse pajtoheni: Google Ads, për të matur reklamat.

## Ndryshimi i zgjedhjes

Zgjedhjen mund ta ndryshoni kurdo me lidhjen "Cilësimet e cookies" në fund të faqes.
`,
  },
};
