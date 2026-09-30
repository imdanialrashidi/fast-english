---
name: no-ai-slop
description: Write or edit product copy, documentation, release notes, and drafts in a concrete, natural voice; audit formulaic writing when asked. Use for substantive prose work, not routine coding or every status update.
---

# No AI Slop

Adapted for Pi from [Peter Yang's no-ai-slop](https://github.com/petergyang/no-ai-slop/tree/000650b156983f5159695b441477f4e63b25dc85/skills/no-ai-slop), MIT; see LICENSE. This compact adaptation keeps the editing and detection workflow, with technical and multilingual exceptions below.

## Scope and workflow

1. Read the draft or the relevant product facts. Identify the audience, purpose, and voice from available context. Ask only if missing information materially changes the result; for an edit with no draft or file, request it.
2. **Write/edit:** make the minimum effective changes. Preserve meaning, distinctive vocabulary, cadence, humor, opinions, uncertainty, and useful detail. Leave clear sentences alone. When drafting new copy, use only supported product facts.
3. **Detect only:** quote the offending passage, name its pattern, and suggest a brief fix. Do not rewrite the whole draft, assign an authorship probability, or claim to detect AI authorship.
4. Check the result once against the rules below and correct remaining concrete problems. Return the requested text or edit the requested file. Add a short change note only when useful; respect requests for copy-only output.

## Make the prose useful

- Lead with the reader's point when a setup adds nothing. Keep stories or asides that provide context or personality.
- Prefer direct verbs, concrete mechanisms, and specific supported details. Never invent statistics, citations, examples presented as facts, testimonials, capabilities, or stronger certainty to make copy persuasive.
- Cut sentences that could move unchanged to an unrelated product. Replace them with known specifics, or remove them when none exist.
- Untangle genuinely difficult sentences without forcing uniform sentence lengths, punchy fragments, or identical paragraph structures.
- Preserve the writer's tone and language, including Persian phrasing and technical English terms when appropriate. Do not impose English punctuation or idioms on another language.
- Preserve code, identifiers, commands, quotations, legal wording, exact technical terms, and required report formats. A technical term such as “harness” or “leverage” is not automatically filler; judge its use, not a blacklist.

## Patterns to remove when they add no meaning

- **Binary contrasts:** “It's not X. It's Y.” State the intended point directly; retain real comparisons that explain a technical distinction.
- **Throat-clearing:** “Here's the thing,” “Let me be clear,” “In today's world.”
- **Faux insight:** “What nobody tells you,” “The part everyone misses.”
- **Dramatic colon reveals:** “The best part: it learns.” Keep ordinary labels, lists, and quotations.
- **Superficial analysis:** trailing “highlighting,” “underscoring,” or “showcasing” clauses without an actual mechanism or consequence.
- **Importance puffery:** “a pivotal moment,” “a testament to,” “game-changing.” State the supported fact.
- **Interpretive commentary:** “That matters more than it sounds,” “As you can see.” Supply missing evidence or cut the aside.
- **Weasel attribution:** “Experts agree,” “Studies show.” Use an available named source; otherwise flag the unsupported claim.
- **Fake-strong verbs:** “serves as,” “boasts,” “has the ability to.” Use “is,” “has,” or the actual action where clearer.
- **Synonym cycling:** changing the name of the same concept merely for variety. Keep terminology consistent.
- **Negative listing:** “Not an X. Not a Y. A Z.” Say what it is.
- **Dramatic fragments:** “That's it. That's the whole thing.”
- **Robotic rhythm:** repeated sentence shapes, stacked fragments, and mechanically symmetrical paragraphs.
- **Rhetorical setups:** “What if I told you,” “Plot twist,” or self-answered question/answer pairs.
- **Fake-profound endings:** metaphors and mic-drop lines that add no concrete point. Delete rather than polish them.
- **Redundant recaps:** a closing paragraph that only repeats the preceding text. Keep a useful takeaway or next action.
- **Decorative formatting:** emoji headings, scattered bold, tiny sections, or bullets that obscure simple connected prose. Retain lists and tables when they aid comparison or action.
- **Dash overuse:** clusters of em dashes as a rhythm crutch. Choose punctuation appropriate to the language and sentence.
- **Inflated vocabulary:** “delve,” “transformative,” “cutting-edge,” “empower,” and similar words used instead of explaining the actual behavior.
- **Empty qualifiers:** “truly,” “fundamentally,” “it's worth noting.” Preserve qualifiers expressing real uncertainty or the writer's voice.

## Final check

Is the meaning unchanged and every factual claim supported? Are the voice, precise terms, and useful structure preserved? Does each remaining sentence help this reader? Does the response match edit, write, or detect mode? Fix identified defects; do not rewrite good prose just to look different.
