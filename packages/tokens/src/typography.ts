import { typography, radius } from "./raw.cjs";

export { typography, radius };

export type TypeScaleStep = (typeof typography.scale)[number];

/** Web'de akış içi metin için önerilen azami satır uzunluğu (bkz. PRD 15.3). */
export const maxProseCharacters = 72;
