import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Return the Farcaster manifest as JSON
  const manifest = {
    frame: {
      name: "Zunno",
      homeUrl: "https://zunno.xyz",
      iconUrl: "https://zunno.xyz/images/logo.png",
      version: "1",
      subtitle: "Blockchain's 1st Uno game",
      description:
        "Zunno is a cutting-edge, multiplayer digital adaptation of the classic UNO game",
      splashImageUrl: "https://zunno.xyz/images/logo.png",
      primaryCategory: "games",
      splashBackgroundColor: "#0000a8",
      screenshotUrls: [
        "https://zunno.xyz/images/screenshot_1.png",
        "https://zunno.xyz/images/screenshot_2.png",
        "https://zunno.xyz/images/screenshot_3.png",
      ],
      tags: ["UNO", "mini-app", "base-app"],
      heroImageUrl: "https://zunno.xyz/images/hero-1.png",
      tagline: "UNO game on Blockchain",
      ogTitle: "Zunno",
      ogDescription:
        "Zunno is a cutting-edge, multiplayer digital adaptation of the classic UNO game",
      ogImageUrl: "https://zunno.xyz/images/hero-1.png",
    },

    accountAssociation: {
      header:
        "eyJmaWQiOjExNjkwMjQsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg1YTM4N2IwOTM1MDZDYjQzQjk2NWU4MTNmY0QyQzc4MTYwODUwMTQ0In0",
      payload: "eyJkb21haW4iOiJ6dW5uby54eXoifQ",
      signature:
        "MHg1OTdjYzRmYWNjZjA5ZGI2MzJiZTBiYzBmZGJjZTE0NTIzZjQyMGIwZTIzNmEyOTAzODU1ZDlhNDg5NGE1OTcxMjY2MzUyYzNmODE0ZTYxNGQwZWMwZTI2NDI0NTdlZjdiZDI0ODlhMGU3YmZmMGQ1MWUyYTEzMWE5ZmNhNDAzYjFj",
    },

    "baseBuilder":{
      "allowedAddresses": ["0x1F7983B8F6Df20C9AA3503339ec359fDe789219D" ]
      }
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
