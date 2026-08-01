import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return new NextResponse(
      "Chýba ADMIN_USERNAME alebo ADMIN_PASSWORD.",
      {
        status: 500,
      },
    );
  }

  const authorization =
    request.headers.get("authorization");

  if (authorization) {
    const [type, encodedCredentials] =
      authorization.split(" ");

    if (
      type === "Basic" &&
      encodedCredentials
    ) {
      const credentials = atob(
        encodedCredentials,
      );

      const separatorIndex =
        credentials.indexOf(":");

      if (separatorIndex !== -1) {
        const enteredUsername =
          credentials.slice(
            0,
            separatorIndex,
          );

        const enteredPassword =
          credentials.slice(
            separatorIndex + 1,
          );

        if (
          enteredUsername === username &&
          enteredPassword === password
        ) {
          return NextResponse.next();
        }
      }
    }
  }

  return new NextResponse(
    "Prihlásenie je potrebné.",
    {
      status: 401,
      headers: {
        "WWW-Authenticate":
          'Basic realm="LEDON administrácia"',
      },
    },
  );
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};