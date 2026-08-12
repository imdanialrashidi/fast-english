// app/src/features/episode/index.ts
// Slice 7 — Episode surface (Record Jacket) feature barrel.

export type { EditionRailProps } from './components/EditionRail';
export { EditionRail } from './components/EditionRail';
export type { EpisodeJacketProps } from './components/EpisodeJacket';
export { EpisodeJacket } from './components/EpisodeJacket';
export type { PrevNextFooterProps } from './components/PrevNextFooter';
export { PrevNextFooter } from './components/PrevNextFooter';
export type { VariantDeckProps } from './components/VariantDeck';
export { VariantDeck } from './components/VariantDeck';
export type { VocabularyListProps } from './components/VocabularyList';
export { VocabularyList } from './components/VocabularyList';
export type { DeckCtaKind, DeckCtaState, EditionRailEntry } from './logic';
export {
  buildEditionRail,
  canUseTts,
  deriveDeckCta,
  nextOpenId,
  pickEnglishVoice,
  railEntryForVariant,
  vocabularyHeading,
} from './logic';
