import { describe, expect, it } from "vitest";
import { slugify, toLocaleLowerTr, toLocaleUpperTr } from "./slugify";

describe("slugify", () => {
  it("converts Turkish diacritics to plain ASCII", () => {
    expect(slugify("Aşk Zamanı")).toBe("ask-zamani");
    expect(slugify("Kış Uykusu")).toBe("kis-uykusu");
    expect(slugify("Çöl Güneşi Üşür")).toBe("col-gunesi-usur");
  });

  it("collapses whitespace/punctuation into single dashes and trims edges", () => {
    expect(slugify("  İki   Nokta: Bir!! ")).toBe("iki-nokta-bir");
  });

  it("produces the same slug for the same film regardless of case", () => {
    expect(slugify("AŞK ZAMANI")).toBe(slugify("aşk zamanı"));
  });
});

describe("tr-TR locale casing", () => {
  it("uppercases dotless/dotted i correctly", () => {
    expect(toLocaleUpperTr("istanbul")).toBe("İSTANBUL");
    expect(toLocaleUpperTr("ışık")).toBe("IŞIK");
  });

  it("lowercases dotless/dotted i correctly", () => {
    expect(toLocaleLowerTr("İSTANBUL")).toBe("istanbul");
    expect(toLocaleLowerTr("IŞIK")).toBe("ışık");
  });
});
