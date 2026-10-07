import { NextResponse } from "next/server";

/**
 * App Links iskeleti (PRD 19, Faz 10). SHA256 imza parmak izi yer tutucudur —
 * gerçek bir Google Play Console kaydından/imzalama anahtarından gelmeden bu
 * dosya işlevsel değildir (bkz. ADR-0020).
 */
export function GET() {
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "app.movieholix.mobile",
          sha256_cert_fingerprints: [
            "TODO_REPLACE_WITH_REAL_SHA256_FINGERPRINT",
          ],
        },
      },
    ],
    { headers: { "Content-Type": "application/json" } },
  );
}
