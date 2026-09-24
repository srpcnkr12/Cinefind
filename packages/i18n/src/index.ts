import tr from "./tr.json";
import en from "./en.json";

export const messages = { tr, en } as const;
export type Locale = keyof typeof messages;
export type Messages = (typeof messages)["tr"];

export * from "./slugify";
