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

type OrderItem = {
  itemKey?: string;
  gallerySlug?: string;
  galleryTitle?: string;
  galleryDate?: string;
  photoId: string;
  filename: string;
  price: number;
};

type NormalizedOrderItem = {
  itemKey: string;
  gallerySlug: string;
  galleryTitle: string;
  galleryDate: string;
  photoId: string;
  filename: string;
  price: number;
};

type Order = {
  id: string;
  status: string;
  language?: "sk" | "en";
  gallerySlug?: string;
  galleryTitle?: string;
  galleryDate?: string;
  photoId?: string;
  filename?: string;
  items?: OrderItem[];
  count?: number;
  email: string;
  price: number;
  unitPrice?: number;
  currency: string;
  paymentMode?: "fixed" | "manual";
  expectedAmount?: number;
  receivedAmount?: number;
  paidCount?: number;
  paidPhotoIds?: string[];
  paidItemKeys?: string[];
  createdAt: string;
  paidAt: string | null;
  sentAt: string | null;
  downloadedAt: string | null;
  downloadTokenHash?: string | null;
  downloadExpiresAt?: string | null;
  resendEmailId?: string | null;
  downloadedPhotoIds?: string[];
  downloadedItemKeys?: string[];
};

function getR2Client() {
  const accountId =
    process.env.R2_ACCOUNT_ID;

  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID;

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

function createTokenHash(
  token: string,
) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function escapeHtml(
  value: unknown,
) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getOrderItems(
  order: Order,
): NormalizedOrderItem[] {
  if (
    Array.isArray(order.items) &&
    order.items.length > 0
  ) {
    const result:
      NormalizedOrderItem[] = [];

    for (const item of order.items) {
      const gallerySlug =
        item.gallerySlug ??
        order.gallerySlug ??
        "";

      const galleryTitle =
        item.galleryTitle ??
        order.galleryTitle ??
        gallerySlug;

      const galleryDate =
        item.galleryDate ??
        order.galleryDate ??
        "";

      if (
        !gallerySlug ||
        !item.photoId ||
        !item.filename ||
        !Number.isFinite(item.price) ||
        item.price <= 0
      ) {
        continue;
      }

      result.push({
        itemKey:
          item.itemKey ??
          `${gallerySlug}:${item.photoId}`,
        gallerySlug,
        galleryTitle,
        galleryDate,
        photoId:
          item.photoId,
        filename:
          item.filename,
        price:
          item.price,
      });
    }

    return result;
  }

  if (
    order.photoId &&
    order.filename &&
    order.gallerySlug
  ) {
    return [
      {
        itemKey:
          `${order.gallerySlug}:${order.photoId}`,
        gallerySlug:
          order.gallerySlug,
        galleryTitle:
          order.galleryTitle ??
          order.gallerySlug,
        galleryDate:
          order.galleryDate ??
          "",
        photoId:
          order.photoId,
        filename:
          order.filename,
        price:
          order.price,
      },
    ];
  }

  return [];
}

function getPaidItems(
  order: Order,
  items: NormalizedOrderItem[],
): NormalizedOrderItem[] {
  if (
    Array.isArray(
      order.paidItemKeys,
    ) &&
    order.paidItemKeys.length > 0
  ) {
    const paidKeys =
      new Set(
        order.paidItemKeys,
      );

    return items.filter(
      (item) =>
        paidKeys.has(
          item.itemKey,
        ),
    );
  }

  if (
    Array.isArray(
      order.paidPhotoIds,
    ) &&
    order.paidPhotoIds.length > 0
  ) {
    const paidIds =
      new Set(
        order.paidPhotoIds,
      );

    return items.filter(
      (item) =>
        paidIds.has(
          item.photoId,
        ),
    );
  }

  if (
    typeof order.paidCount ===
      "number" &&
    order.paidCount > 0
  ) {
    return items.slice(
      0,
      order.paidCount,
    );
  }

  return items;
}

function getGalleryNames(
  items: NormalizedOrderItem[],
) {
  const names =
    new Set<string>();

  for (const item of items) {
    names.add(
      item.galleryTitle ||
        item.gallerySlug,
    );
  }

  return [
    ...names,
  ];
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { orderId } =
      await context.params;

    if (!orderId) {
      return NextResponse.json(
        {
          error:
            "Chýba číslo objednávky.",
        },
        {
          status: 400,
        },
      );
    }

    const bucket =
      process.env
        .R2_ORIGINALS_BUCKET;

    const resendApiKey =
      process.env
        .RESEND_API_KEY;

    const fromEmail =
      process.env
        .RESEND_FROM_EMAIL;

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

    const r2Client =
      getR2Client();

    const orderKey =
      `_orders/${orderId}.json`;

    const response =
      await r2Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: orderKey,
        }),
      );

    if (!response.Body) {
      return NextResponse.json(
        {
          error:
            "Objednávka sa nenašla.",
        },
        {
          status: 404,
        },
      );
    }

    const content =
      await response.Body
        .transformToString();

    const order =
      JSON.parse(
        content,
      ) as Order;

    const language =
      order.language === "en"
        ? "en"
        : "sk";

    if (
      order.status !== "paid" &&
      order.status !== "sent" &&
      order.status !==
        "downloaded"
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

    if (
      !order.email ||
      typeof order.email !==
        "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Objednávka nemá platný e-mail.",
        },
        {
          status: 400,
        },
      );
    }

    const items =
      getOrderItems(order);

    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "Objednávka neobsahuje žiadne fotografie.",
        },
        {
          status: 400,
        },
      );
    }

    const paidItems =
      getPaidItems(
        order,
        items,
      );

    if (
      paidItems.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Nie je zaplatená ani jedna fotografia.",
        },
        {
          status: 400,
        },
      );
    }

    const token =
      crypto
        .randomBytes(32)
        .toString("hex");

    const now =
      new Date();

    const expiresAt =
      new Date(
        now.getTime() +
          24 *
            60 *
            60 *
            1000,
      ).toISOString();

    const origin =
      new URL(
        request.url,
      ).origin;

    const downloadLinks =
      paidItems.map(
        (item) => {
          const url =
            `${origin}/api/download` +
            `?orderId=${encodeURIComponent(orderId)}` +
            `&itemKey=${encodeURIComponent(item.itemKey)}` +
            `&token=${encodeURIComponent(token)}`;

          return {
            ...item,
            url,
          };
        },
      );

    const textPhotoList =
      downloadLinks
        .map(
          (item) =>
            `${item.galleryTitle} — ${item.photoId}: ${item.url}`,
        )
        .join("\n");

    const htmlPhotoLinks =
      downloadLinks
        .map((item) => {
          const safePhotoId =
            escapeHtml(
              item.photoId,
            );

          const safeGalleryTitle =
            escapeHtml(
              item.galleryTitle,
            );

          const safeUrl =
            escapeHtml(
              item.url,
            );

          const downloadText =
            language === "en"
              ? `Download ${safePhotoId}`
              : `Stiahnuť ${safePhotoId}`;

          return `
            <div style="margin-top:14px;">
              <p
                style="
                  margin:0 0 7px;
                  color:#888888;
                  font-size:11px;
                  line-height:1.5;
                "
              >
                ${safeGalleryTitle}
              </p>

              <a
                href="${safeUrl}"
                style="display:block;background:#ffffff;color:#000000;text-decoration:none;text-align:center;padding:18px 24px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;"
              >
                ${downloadText}
              </a>
            </div>
          `;
        })
        .join("");

    const unpaidCount =
      Math.max(
        0,
        items.length -
          paidItems.length,
      );

    const galleryNames =
      getGalleryNames(
        paidItems,
      );

    const galleryText =
      galleryNames.join(
        ", ",
      );

    const safeGalleryText =
      escapeHtml(
        galleryText,
      );

    const resend =
      new Resend(
        resendApiKey,
      );

    const subject =
      language === "en"
        ? paidItems.length === 1
          ? `Your photo ${paidItems[0].photoId} is ready`
          : `Your ${paidItems.length} photos are ready`
        : paidItems.length === 1
          ? `Vaša fotografia ${paidItems[0].photoId} je pripravená`
          : `Vašich ${paidItems.length} fotografií je pripravených`;

    const text =
      language === "en"
        ? [
            "Hello,",
            "",
            "thank you for your purchase.",
            "",
            `Galleries: ${galleryText}`,
            `Paid photos: ${paidItems.length}`,
            unpaidCount > 0
              ? `Unpaid photos: ${unpaidCount}`
              : "",
            "",
            "Full-resolution originals:",
            "",
            textPhotoList,
            "",
            "The download links are valid for 24 hours.",
            "",
            "Thank you for your support.",
            "",
            "LEDON.",
            "https://ledon.photos",
          ]
            .filter(Boolean)
            .join("\n")
        : [
            "Dobrý deň,",
            "",
            "ďakujeme za váš nákup.",
            "",
            `Galérie: ${galleryText}`,
            `Zaplatených fotografií: ${paidItems.length}`,
            unpaidCount > 0
              ? `Nezaplatených fotografií: ${unpaidCount}`
              : "",
            "",
            "Originály v plnom rozlíšení:",
            "",
            textPhotoList,
            "",
            "Odkazy sú platné 24 hodín.",
            "",
            "Ďakujeme za podporu.",
            "",
            "LEDON.",
            "https://ledon.photos",
          ]
            .filter(Boolean)
            .join("\n");

    const emailLabel =
      language === "en"
        ? {
            htmlLang: "en",
            eyebrow:
              "Photos are ready",
            title:
              "Thank you for your purchase.",
            galleries:
              "Galleries",
            paidPhotos:
              "Paid photos",
            unpaidPhotos:
              "Unpaid photos",
            validity:
              "The download links are valid for 24 hours.",
            support:
              "Thank you for your support.",
          }
        : {
            htmlLang: "sk",
            eyebrow:
              "Fotografie sú pripravené",
            title:
              "Ďakujeme za váš nákup.",
            galleries:
              "Galérie",
            paidPhotos:
              "Zaplatených fotografií",
            unpaidPhotos:
              "Nezaplatených fotografií",
            validity:
              "Odkazy sú platné 24 hodín.",
            support:
              "Ďakujeme za podporu.",
          };

    const {
      data: emailData,
      error: emailError,
    } =
      await resend.emails.send(
        {
          from:
            `LEDON. <${fromEmail}>`,
          to: [
            order.email,
          ],
          replyTo:
            fromEmail,
          subject,
          text,
          html: `
            <!doctype html>
            <html lang="${emailLabel.htmlLang}">
              <body
                style="
                  margin:0;
                  padding:0;
                  background:#080808;
                  color:#ffffff;
                  font-family:Arial,Helvetica,sans-serif;
                "
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  style="background:#080808;"
                >
                  <tr>
                    <td
                      align="center"
                      style="padding:40px 16px;"
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        style="
                          max-width:620px;
                          background:#111111;
                          border:1px solid #303030;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding:42px 38px 20px;
                            "
                          >
                            <div
                              style="
                                font-size:30px;
                                font-weight:700;
                                letter-spacing:5px;
                              "
                            >
                              LEDON.
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td
                            style="
                              padding:18px 38px 38px;
                            "
                          >
                            <p
                              style="
                                margin:0 0 14px;
                                color:#999999;
                                font-size:11px;
                                letter-spacing:3px;
                                text-transform:uppercase;
                              "
                            >
                              ${emailLabel.eyebrow}
                            </p>

                            <h1
                              style="
                                margin:0 0 26px;
                                font-size:30px;
                                font-weight:400;
                                line-height:1.25;
                              "
                            >
                              ${emailLabel.title}
                            </h1>

                            <table
                              role="presentation"
                              width="100%"
                              cellspacing="0"
                              cellpadding="0"
                              style="
                                margin-bottom:30px;
                                border-top:1px solid #303030;
                                border-bottom:1px solid #303030;
                              "
                            >
                              <tr>
                                <td
                                  style="
                                    padding:18px 0;
                                    color:#888888;
                                    font-size:13px;
                                  "
                                >
                                  ${emailLabel.galleries}
                                </td>

                                <td
                                  align="right"
                                  style="
                                    padding:18px 0;
                                    color:#ffffff;
                                    font-size:15px;
                                  "
                                >
                                  ${safeGalleryText}
                                </td>
                              </tr>

                              <tr>
                                <td
                                  style="
                                    padding:0 0 18px;
                                    color:#888888;
                                    font-size:13px;
                                  "
                                >
                                  ${emailLabel.paidPhotos}
                                </td>

                                <td
                                  align="right"
                                  style="
                                    padding:0 0 18px;
                                    color:#ffffff;
                                    font-size:15px;
                                  "
                                >
                                  ${paidItems.length}
                                </td>
                              </tr>

                              ${
                                unpaidCount > 0
                                  ? `
                                    <tr>
                                      <td
                                        style="
                                          padding:0 0 18px;
                                          color:#888888;
                                          font-size:13px;
                                        "
                                      >
                                        ${emailLabel.unpaidPhotos}
                                      </td>

                                      <td
                                        align="right"
                                        style="
                                          padding:0 0 18px;
                                          color:#ff7777;
                                          font-size:15px;
                                        "
                                      >
                                        ${unpaidCount}
                                      </td>
                                    </tr>
                                  `
                                  : ""
                              }
                            </table>

                            ${htmlPhotoLinks}

                            <p
                              style="
                                margin:22px 0 0;
                                color:#777777;
                                font-size:12px;
                                line-height:1.7;
                              "
                            >
                              ${emailLabel.validity}
                            </p>
                          </td>
                        </tr>

                        <tr>
                          <td
                            style="
                              padding:28px 38px;
                              border-top:1px solid #303030;
                              color:#777777;
                              font-size:13px;
                              line-height:1.8;
                            "
                          >
                            <p
                              style="
                                margin:0 0 14px;
                                color:#aaaaaa;
                              "
                            >
                              ${emailLabel.support}
                            </p>

                            <p
                              style="
                                margin:0;
                                color:#ffffff;
                                font-size:17px;
                                font-weight:700;
                                letter-spacing:3px;
                              "
                            >
                              LEDON.
                            </p>

                            <p
                              style="
                                margin:8px 0 0;
                              "
                            >
                              ledon.photos
                            </p>

                            <p
                              style="
                                margin:3px 0 0;
                              "
                            >
                              moto@ledon.photos
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
        },
      );

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
      language,
      status:
        "sent",
      sentAt:
        now.toISOString(),
      downloadedAt:
        null,
      downloadedPhotoIds:
        [],
      downloadedItemKeys:
        [],
      downloadTokenHash:
        createTokenHash(
          token,
        ),
      downloadExpiresAt:
        expiresAt,
      resendEmailId:
        emailData?.id ??
        null,
    };

    await r2Client.send(
      new PutObjectCommand({
        Bucket:
          bucket,
        Key:
          orderKey,
        Body:
          JSON.stringify(
            updatedOrder,
            null,
            2,
          ),
        ContentType:
          "application/json; charset=utf-8",
        CacheControl:
          "no-store",
      }),
    );

    return NextResponse.json({
      success: true,
      message:
        unpaidCount > 0
          ? `E-mail s ${paidItems.length} zaplatenými fotografiami bol odoslaný na ${order.email}.`
          : `E-mail s ${paidItems.length} fotografiami bol odoslaný na ${order.email}.`,
    });
  } catch (error) {
    console.error(
      "Chyba pri odoslaní originálov:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Originály sa nepodarilo odoslať.",
      },
      {
        status: 500,
      },
    );
  }
}