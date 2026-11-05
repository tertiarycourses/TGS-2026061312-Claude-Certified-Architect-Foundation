# AI in creative industries: six claims, six sources, no visual arts findings

The evidence is thin. This report rests on six claims from six sources. Music, writing, film/TV and cross-sector each have a few claims or one. Visual arts has none, so it appears below as a coverage gap. Two cross-sector figures on creative SME adoption conflict (41% vs 55%), and the conflict is unresolved. Only the two cross-sector claims went through verify_fact. The other four were not checked.

## Established findings

No finding here is verified beyond a single source. Each rests on one excerpt, and all are medium or low confidence.

- **Music: labels and musicians report AI use.** In the IFPI report, 62% of surveyed record labels used generative tools in production during 2025 [1]. In a Musicians' Union member survey, 48% of members reported using AI tools in composition or mixing [2]. Neither excerpt gives a sample size, region or methodology. The union source does not say which country its members are in, and it measures AI usage, not income or jobs. The IFPI source is about 8 months old as of 2026-11-05. Neither claim was checked with verify_fact.
- **Writing and publishing: a self-reported income drop.** The Authors Guild survey reports a median income effect of AI on freelance writers of -11% year over year [3]. The figure is self-reported and covers freelance writers only. It does not cover book authors. Only a one-line excerpt came back, with no sample size or method. It was not checked with verify_fact.
- **Film and TV: shorter previsualisation, as an association.** The Visual Effects Society note reports that previsualisation time fell by roughly 30% on productions using AI storyboarding [4]. Confidence is low. The finding rests on one short excerpt that could not be checked against the full document. It gives no sample size, method or list of productions. It covers previsualisation only. It is an association and is not shown to be causal. It was not checked with verify_fact.
- **Cross-sector: WIPO's 41% figure is verified.** WIPO reports generative AI adoption among creative SMEs reached 41% in 2025, up from 23% in 2023 (an 18-percentage-point rise) [5]. verify_fact returned verified: true, with recorded value 41%. The excerpt gives no methodology, and only one page was returned. This figure is contested (see below).

## Contested findings

Two sources give different 2025 adoption figures for creative SMEs. The gap is 14 percentage points. Neither source is declared the winner.

| | WIPO Creative Economy 2025 [5] | UNESCO Culture Report 2026 [6] |
|---|---|---|
| Value | 41% in 2025 (up from 23% in 2023), generative AI | 55% in 2025 |
| File and page | WIPO-Creative-Economy-2025.pdf, p. 14 | UNESCO-Culture-Report-2026.pdf, p. 88 |
| Published | 2025-11-30 | 2026-04-01 |
| Method note | Names generative AI specifically. No methodology in the excerpt. Medium confidence. Partial document. | An estimate weighted by firm size. Says "adoption" without specifying generative AI, so the technology scope may differ. Medium confidence. Partial document. |
| Verification | verify_fact: verified true, recorded value 41% | verify_fact: returned false, but the recorded value was the WIPO 41% fact, so the check is inconclusive |

The check on the UNESCO figure neither confirms nor refutes it. The claim is kept and marked unverified. The 2023 UNESCO figure is unavailable, so the trends cannot be compared.

The gap might come from the firm-size weighting in the UNESCO figure. It might also come from a different definition of AI (generative AI only vs adoption in general). The excerpts confirm neither cause. The conflict is unresolved.

## Coverage gaps

### Music: two survey claims, most topics empty

All three queries returned the same two results, so the search corpus looks very small. Nothing came back on:
- copyright disputes and licensing deals (for example labels versus Suno or Udio), so case status and settlement terms cannot be established;
- royalties and streaming payouts;
- musicians' income and employment effects;
- listener adoption of generative music tools, and the share of AI-generated tracks on streaming platforms.

### Writing and publishing: one claim, five blanks

Nothing came back on:
- training-data copyright litigation and settlements;
- publisher licensing deals (books and journalism);
- translation and copywriting market impact;
- journalism and newsroom impacts.

Book authors' income, as distinct from freelance writers, is not covered.

### Film and TV: one low-confidence claim

Nothing was found on:
- union agreements, including SAG-AFTRA or WGA AI terms (valid empty result);
- studio licensing deals and lawsuits (Disney, Midjourney, OpenAI or similar);
- generative video adoption and spend;
- dubbing and localisation;
- employment and production budgets;
- screenwriter and performer impact.

Process deviation: four search_web queries ran, one more than the three allowed. The fourth returned the same single VFX Society result and added no evidence. search_web accepted only a query parameter, so standard or extended mode could not be used. No tool failures occurred.

### Visual arts: no findings, no statistics

This is a coverage gap. The section has no findings and no cited statistics, and the gap was not filled from memory. The searches either timed out or returned valid empty results.

- Artists' income and commissions: no data. Both searches timed out, with empty partial_results both times.
- Style and training-data lawsuits: no data. The first query timed out (2 attempts, empty partial_results). The narrower retry, "Getty Images v Stability AI ruling", returned a valid empty result, so no case status or ruling could be confirmed.
- Art market and auction sales: no data. The query returned a valid empty result, which is not a tool failure.
- Image generators, graphic design, illustration and photography: no data. The only query on these topics timed out (3 attempts on the narrower retry).

Suggested next steps from the research state:
- Retry once with a narrower query.
- Rephrase with named entities, such as Christie's or Sotheby's AI art sales.
- Ask document-analysis to cover visual arts from the WIPO PDF.

### Cross-sector: two partial PDFs

Each PDF load returned one page excerpt only (WIPO p. 14, UNESCO p. 88). Other pages were not retrievable.
- No document titles were returned.
- No WIPO methodology was returned for the 41% figure.
- It could not be established whether the UNESCO 55% covers generative AI only or AI in general.
- The UNESCO 2023 figure could not be established.
- The document excerpts held no sector-level statistics for music, writing and publishing, film and TV, or visual arts.

## Statistics table

| Claim | Value | Source | Published |
|---|---|---|---|
| Surveyed record labels using generative tools in production, 2025 (medium confidence; not verified) | 62% | IFPI Global Music Report 2026, https://example.org/ifpi-2026-ai-music [1] | 2026-03-19 |
| Musicians' Union members reporting AI use in composition or mixing (medium confidence; not verified) | 48% | Musicians' Union member survey, https://example.org/musicians-union-survey [2] | 2025-09-02 |
| Median reported income effect of AI on freelance writers, self-reported, year over year (medium confidence; not verified) | -11% | Authors Guild AI survey, https://example.org/authors-guild-ai-2026 [3] | 2026-01-14 |
| Fall in previsualisation time on productions using AI storyboarding, association only (low confidence; not verified) | roughly 30% | Visual Effects Society workforce note, https://example.org/vfx-society-2026 [4] | 2026-02-07 |
| Generative AI adoption among creative SMEs, 2025; 23% in 2023, +18 points (contested; verified) | 41% | WIPO-Creative-Economy-2025.pdf, p. 14 [5] | 2025-11-30 |
| Adoption among creative SMEs, 2025, weighted by firm size (contested; verification inconclusive) | 55% | UNESCO-Culture-Report-2026.pdf, p. 88 [6] | 2026-04-01 |

## Open questions

- Does the 41% vs 55% gap come from firm-size weighting or from a different AI definition? This is unresolved.
- Can visual arts be covered? Retry with a narrower query, or keep reporting it as a coverage gap.
- Music: what are the facts on copyright disputes, licensing deals, royalties, income and the share of AI-generated tracks?
- Writing and publishing: what are the facts on litigation, licensing deals, translation, copywriting, journalism and book authors' income?
- Film and TV: what are the facts on union agreements, studio deals or lawsuits, generative video, dubbing, jobs and budgets? The single finding rests on one excerpt with no sample size or method.
- Internal PDFs: sector-level statistics, titles and methodology would need full PDFs or specific page ranges.
- Verification: the verify_fact check on the UNESCO 55% claim returned false against a WIPO record, so it is inconclusive. A new lookup would need the coordinator.

## Research limits

- The search corpus looks very small. Several music queries returned the same two results, and the film/TV queries returned the same single result.
- Visual arts searches timed out (empty partial_results) or returned valid empty results.
- Both internal documents loaded only partially, one page excerpt each.
- The film/TV search ran four queries, one over the three allowed.
- Most survey-based findings give no sample size, region or methodology.
- Only two verify_fact checks ran, both on the cross-sector claims. The music, writing and film claims were not checked.
- The IFPI result is about 8 months old as of 2026-11-05.

## References

1. IFPI Global Music Report 2026. https://example.org/ifpi-2026-ai-music. Published 2026-03-19. Page not stated.
2. Musicians' Union member survey. https://example.org/musicians-union-survey. Published 2025-09-02. Page not stated.
3. Authors Guild AI survey. https://example.org/authors-guild-ai-2026. Published 2026-01-14. Page not stated.
4. Visual Effects Society workforce note. https://example.org/vfx-society-2026. Published 2026-02-07. Page not stated.
5. WIPO Creative Economy 2025. WIPO-Creative-Economy-2025.pdf, page 14. Published 2025-11-30.
6. UNESCO Culture Report 2026. UNESCO-Culture-Report-2026.pdf, page 88. Published 2026-04-01.