# Women's Safety Insights

Live app: <https://aindrila2412.github.io/womens-safety-insights/>

I built this as a personal portfolio project to see what India's public crime statistics can and can't tell us about
women's safety. It's a small dashboard that works offline once you've opened it. It's not an official product and it
has nothing to do with NCRB, the government or any employer.

It shows registered crimes-against-women cases by state and union territory from 2015 to 2024, survey figures from
NFHS-6 next to each state, a world comparison from the UN SDG database, a "recent updates" tab, and a list of official
helplines. It relates to UN SDG 5 (gender equality) and SDG 11 (safe cities and communities).

One thing to keep in mind when you use it: these are cases that police *registered*. A high number can mean more
reporting, not a less safe place. The app says this on the ranking screens, but it's worth repeating here.

## Installing it on your phone

It's a PWA, so you can put it on your home screen.

On Android (Chrome), open the link, then use the Install app button on the About tab, or the browser menu and
"Install app" / "Add to Home screen".

On iPhone or iPad, open it in Safari, tap Share, then "Add to Home Screen". iOS doesn't show an install prompt, so
that's the only way.

After the first visit it should open without a connection.

## Where the data comes from

- **Cases and rates (2015 to 2024):** NCRB, *Crime in India*. NCRB data is published under the Government Open Data
  Licence - India (GODL-India). I took 2015 to 2022 from a public MIT-licensed compilation of the NCRB tables
  ([batman-in/project-durga](https://github.com/batman-in/project-durga)) and checked 2022 to 2024 against NCRB's own
  Table 3A.1 from the 2024 edition. The earlier years I did not re-check against the original reports.
- **Female population (for the rates):** Census of India 2011 and the MoHFW population projections (July 2020).
- **NFHS-6 spousal violence by state:** National Family Health Survey 2023-24 fact sheets (MoHFW, IIPS), released
  29 May 2026. Results are provisional and Manipur wasn't surveyed. Some changes since NFHS-5 are very large, so
  I'd treat them as a caution rather than a trend.
- **World tab:** UN SDG Global Database (series VC_VAW_MARR and SG_LGL_GENEQVAW), estimates by WHO and the UN
  inter-agency group. UNdata terms apply (free to use, cite UNdata, no modification), and the WHO report is
  CC BY-NC-SA 3.0 IGO. So the world numbers in this app are for non-commercial use, share-alike.
- **Recent updates tab:** press releases, parliament replies and news articles, each linked with its date. It's a
  hand-picked reading list, not an official record, and it never feeds a chart.
- **Helplines:** taken from the official pages linked in the app, checked on 3 October 2026.

Latest year per source is 2024 for NCRB, NFHS-6 (2023-24), and 2023 for the UN estimates. I didn't estimate anything
newer. District and city data exist in the NCRB files but I left them out on purpose, because small counts in a
sensitive topic can point at real people.

The app doesn't collect anything from you and there's no login.

## Licence

The app code is MIT (see `LICENSE`). Chart.js 4.4.7 is bundled unmodified in `vendor/` and is also MIT. The data
keeps the terms of the sources above.

## What I'd improve

I'd re-check the 2015 to 2021 numbers against the original NCRB reports, add NFHS help-seeking figures if they ever
show up in the NFHS-6 tables.
