# Reading lexicon provenance

`lexicon.json` is content data used by the reading surfaces (TED, IELTS,
Inside Reading) to highlight B2+ words and show a short Persian hint.

- CEFR bands: **CEFR-Vocabulary-List** by Stone, MIT licence
  (https://github.com/anig1scur/CEFR-Vocabulary-List). Only the band labels
  were used; the list was reduced with a lowest-level-wins rule and
  lemma/inflection grouping.
- Persian glosses: the project's existing article glossaries first, then the
  Apache-2.0 **EnglishToPersianDictionaries** collection
  (https://github.com/VahidN/EnglishToPersianDictionaries), and a small
  manually reviewed set for technical/idiomatic TED words.
- English definitions and simple synonyms: Princeton **WordNet 3.0**
  (WordNet licence, https://wordnet.princeton.edu).
- `word-audio-keys.json` lists the keys whose pronunciation clip exists on the
  private disk; the readers only show a play button for those keys.

The generated file is product content, not a redistributed dictionary.
Glosses are short learner hints and should be reviewed before a major
content release.
