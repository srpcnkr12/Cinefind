import { describe, expect, it } from "vitest";
import { parseMentions } from "./social";

describe("parseMentions", () => {
  it("boş/null gövdede boş dizi döner", () => {
    expect(parseMentions(null)).toEqual([]);
    expect(parseMentions("")).toEqual([]);
  });

  it("tek bir bahsetmeyi ayıklar", () => {
    expect(parseMentions("Selam @ada, filmini beğendim")).toEqual(["ada"]);
  });

  it("birden fazla bahsetmeyi sırayla ayıklar", () => {
    expect(parseMentions("@ada ve @bora birlikte izlemiş")).toEqual([
      "ada",
      "bora",
    ]);
  });

  it("tekrarlanan bahsetmeleri tekilleştirir", () => {
    expect(parseMentions("@ada @ada tekrar @ada")).toEqual(["ada"]);
  });

  it("büyük/küçük harf duyarsızdır", () => {
    expect(parseMentions("Selam @Ada")).toEqual(["ada"]);
  });

  it("noktalama işaretlerinde durur", () => {
    expect(parseMentions("@ada, merhaba! @bora.")).toEqual(["ada", "bora"]);
  });

  it("geçersiz kısa bahsetmeleri (tek karakter) yakalamaz", () => {
    expect(parseMentions("@a merhaba")).toEqual([]);
  });
});
