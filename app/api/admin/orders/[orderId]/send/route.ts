import crypto from "node:crypto";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

type Order = {
  id: string;
  status: string;
  gallerySlug: string;
  galleryTitle: string;
  galleryDate: string;
  photoId: string;
  filename: string;
  email: string;
  price: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  sentAt: string | null;
  downloadedAt: string | null;
  downloadTokenHash?: string | null;
  downloadExpiresAt?: string | null;
  resendEmailId?: string | null;
};

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY;

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey
  ) {
    throw new Error(
      "Chýbajú prihlasovacie údaje Cloudflare R2.",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint:
      `https://${accountId}` +
      ".r2.cloudflarestorage.com",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function createTokenHash(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { orderId } = await context.params;

    if (!orderId) {
      return NextResponse.json(
        {
          error: "Chýba číslo objednávky.",
        },
        {
          status: 400,
        },
      );
    }

    const bucket =
      process.env.R2_ORIGINALS_BUCKET;

    const resendApiKey =
      process.env.RESEND_API_KEY;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL;

    if (!bucket) {
      throw new Error(
        "Chýba R2_ORIGINALS_BUCKET.",
      );
    }

    if (!resendApiKey) {
      throw new Error(
        "Chýba RESEND_API_KEY.",
      );
    }

    if (!fromEmail) {
      throw new Error(
        "Chýba RESEND_FROM_EMAIL.",
      );
    }

    const r2Client = getR2Client();
    const orderKey =
      `_orders/${orderId}.json`;

    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: orderKey,
      }),
    );

    if (!response.Body) {
      return NextResponse.json(
        {
          error: "Objednávka sa nenašla.",
        },
        {
          status: 404,
        },
      );
    }

    const content =
      await response.Body.transformToString();

    const order = JSON.parse(
      content,
    ) as Order;

    if (
      order.status !== "paid" &&
      order.status !== "sent" &&
      order.status !== "downloaded"
    ) {
      return NextResponse.json(
        {
          error:
            "Najskôr musíš potvrdiť prijatie platby.",
        },
        {
          status: 400,
        },
      );
    }

    const token =
      crypto.randomBytes(32).toString("hex");

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() +
        24 * 60 * 60 * 1000,
    ).toISOString();

    const origin =
      new URL(request.url).origin;

    const downloadUrl =
      `${origin}/api/download` +
      `?orderId=${encodeURIComponent(orderId)}` +
      `&token=${encodeURIComponent(token)}`;

    const safePhotoId =
      escapeHtml(order.photoId);

    const safeGalleryTitle =
      escapeHtml(order.galleryTitle);

    const safeDownloadUrl =
      escapeHtml(downloadUrl);

    const resend = new Resend(
      resendApiKey,
    );

    const {
      data: emailData,
      error: emailError,
    } = await resend.emails.send({
      from: `LEDON. <${fromEmail}>`,
      to: [order.email],
      replyTo: fromEmail,
      subject:
        `Vaša fotografia ${order.photoId} je pripravená`,
      text: [
        "Dobrý deň,",
        "",
        "ďakujeme za zakúpenie fotografie.",
        "",
        `Fotografia: ${order.photoId}`,
        `Galéria: ${order.galleryTitle}`,
        "",
        "Originál v plnom rozlíšení si stiahnete tu:",
        downloadUrl,
        "",
        "Odkaz je platný 24 hodín.",
        "",
        "LEDON.",
        "https://ledon.photos",
      ].join("\n"),
      html: `
        <!doctype html>
        <html lang="sk">
          <body style="margin:0;padding:0;background:#080808;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080808;">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#111111;border:1px solid #303030;">
                    <tr>
                      <td style="padding:42px 38px 20px;">
                        <div style="font-size:30px;font-weight:700;letter-spacing:5px;">
                          LEDON.
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:18px 38px 38px;">
                        <p style="margin:0 0 14px;color:#999999;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                          Fotografia je pripravená
                        </p>

                        <h1 style="margin:0 0 26px;font-size:30px;font-weight:400;line-height:1.25;">
                          Ďakujeme za váš nákup.
                        </h1>

                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:30px;border-top:1px solid #303030;border-bottom:1px solid #303030;">
                          <tr>
                            <td style="padding:18px 0;color:#888888;font-size:13px;">
                              Fotografia
                            </td>
                            <td align="right" style="padding:18px 0;color:#ffffff;font-size:15px;">
                              ${safePhotoId}
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:0 0 18px;color:#888888;font-size:13px;">
                              Galéria
                            </td>
                            <td align="right" style="padding:0 0 18px;color:#ffffff;font-size:15px;">
                              ${safeGalleryTitle}
                            </td>
                          </tr>
                        </table>

                        <a
                          href="${safeDownloadUrl}"
                          style="display:block;background:#ffffff;color:#000000;text-decoration:none;text-align:center;padding:18px 24px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;"
                        >
                          Stiahnuť originál
                        </a>

                        <p style="margin:22px 0 0;color:#777777;font-size:12px;line-height:1.7;">
                          Odkaz je platný 24 hodín. Ak tlačidlo nefunguje, odpovedzte na tento e-mail.
                        </p>
                      </td>
                    </tr>

                    <tr>
  <td style="padding:28px 38px;border-top:1px solid #303030;color:#777777;font-size:13px;line-height:1.8;">
    <p style="margin:0 0 14px;color:#aaaaaa;">
      Ďakujeme za podporu.
    </p>

    <p style="margin:0;color:#ffffff;font-size:17px;font-weight:700;letter-spacing:3px;">
      LEDON.
    </p>

    <p style="margin:8px 0 0;">
      <a
        href="https://ledon.photos"
        style="color:#aaaaaa;text-decoration:none;"
      >
        ledon.photos
      </a>
    </p>

    <p style="margin:3px 0 0;">
      <a
        href="mailto:moto@ledon.photos"
        style="color:#aaaaaa;text-decoration:none;"
      >
        moto@ledon.photos
      </a>
    </p>
  </td>
</tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error(
        "Resend chyba:",
        emailError,
      );

      return NextResponse.json(
        {
          error:
            emailError.message ||
            "E-mail sa nepodarilo odoslať.",
        },
        {
          status: 500,
        },
      );
    }

    const updatedOrder: Order = {
      ...order,
      status: "sent",
      sentAt: now.toISOString(),
      downloadedAt: null,
      downloadTokenHash:
        createTokenHash(token),
      downloadExpiresAt: expiresAt,
      resendEmailId:
        emailData?.id ?? null,
    };

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: orderKey,
        Body: JSON.stringify(
          updatedOrder,
          null,
          2,
        ),
        ContentType:
          "application/json; charset=utf-8",
        CacheControl: "no-store",
      }),
    );

    return NextResponse.json({
      success: true,
      message:
        `E-mail bol odoslaný na ${order.email}.`,
    });
  } catch (error) {
    console.error(
      "Chyba pri odoslaní originálu:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Originál sa nepodarilo odoslať.",
      },
      {
        status: 500,
      },
    );
  }
}