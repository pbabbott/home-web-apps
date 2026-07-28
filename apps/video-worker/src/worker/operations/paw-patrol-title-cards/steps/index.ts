import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';

/**
 * Ordered pipeline for the paw_patrol_title_cards operation. Empty until
 * the processing steps (locate season files, detect title cards, extract
 * screenshots, ...) are added — one step per file in this directory.
 */
export const steps: Step<PawPatrolTitleCardsContext>[] = [];
