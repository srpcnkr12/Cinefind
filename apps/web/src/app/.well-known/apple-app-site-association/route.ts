import { NextResponse } from "next/server";

/**
 * Universal Links iskeleti (PRD 19, Faz 10). `TEAMID`/bundle id yer
 * tutucudur — gerçek bir Apple Developer hesabından gelen Team ID
 * doğrulanmadan bu dosya işlevsel değildir (bkz. ADR-0020).
 */
export function GET() {
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: ["TEAMID.app.reelmate.mobile"],
            components: [
              { "/": "/film/*", comment: "Film detay sayfaları" },
              { "/": "/user/*", comment: "Kullanıcı profil sayfaları" },
            ],
          },
        ],
      },
    },
    { headers: { "Content-Type": "application/json" } },
  );
}
