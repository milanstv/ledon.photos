import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import OrderActions from "@/components/OrderActions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderItem = {
  photoId: string;
  filename: string;
  price: number;
};

type Order = {
  id: string;
  status: string;

  gallerySlug: string;
  galleryTitle: string;
  galleryDate: string;

  // Staré objednávky
  photoId?: string;
  filename?: string;

  // BETA 2.0 objednávky
  items?: OrderItem[];
  count?: number;
  unitPrice?: number;
  paymentMode?: "fixed" | "manual";
  expectedAmount?: number;

  email: string;
  price: number;
  currency: string;

  createdAt: string;
  paidAt: string | null;
  sentAt: string | null;
  downloadedAt: string | null;
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

function getOrderItems(
  order: Order,
): OrderItem[] {
  if (
    Array.isArray(order.items) &&
    order.items.length > 0
  ) {
    return order.items;
  }

  if (
    order.photoId &&
    order.filename
  ) {
    return [
      {
        photoId: order.photoId,
        filename: order.filename,
        price: order.price,
      },
    ];
  }

  return [];
}

async function loadOrders() {
  const bucket =
    process.env.R2_ORIGINALS_BUCKET;

  if (!bucket) {
    throw new Error(
      "Chýba R2_ORIGINALS_BUCKET.",
    );
  }

  const r2Client = getR2Client();

  const listResponse =
    await r2Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "_orders/",
      }),
    );

  const orderKeys = (
    listResponse.Contents ?? []
  )
    .map((object) => object.Key)
    .filter(
      (key): key is string =>
        Boolean(
          key &&
            key.endsWith(".json"),
        ),
    );

  const orders = await Promise.all(
    orderKeys.map(async (key) => {
      const response =
        await r2Client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );

      if (!response.Body) {
        return null;
      }

      const content =
        await response.Body.transformToString();

      return JSON.parse(
        content,
      ) as Order;
    }),
  );

  return orders
    .filter(
      (order): order is Order =>
        order !== null,
    )
    .sort((first, second) =>
      second.createdAt.localeCompare(
        first.createdAt,
      ),
    );
}

function getStatusText(status: string) {
  if (status === "paid") {
    return "Zaplatené";
  }

  if (status === "sent") {
    return "Odoslané";
  }

  if (status === "downloaded") {
    return "Stiahnuté";
  }

  return "Čaká na platbu";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "sk-SK",
    {
      dateStyle: "short",
      timeStyle: "short",
      timeZone:
        "Europe/Bratislava",
    },
  ).format(new Date(value));
}

export default async function OrdersPage() {
  const orders = await loadOrders();

  const waitingOrders =
    orders.filter(
      (order) =>
        order.status ===
        "waiting_payment",
    ).length;

  const paidOrders =
    orders.filter(
      (order) =>
        order.status === "paid",
    ).length;

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-8 text-white md:px-10 md:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 border-b border-white/15 pb-8 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">
              LEDON. ADMIN
            </p>

            <h1 className="mt-4 text-4xl font-light md:text-6xl">
              Objednávky
            </h1>
          </div>

          <div className="flex gap-8">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                Všetky
              </p>

              <p className="mt-2 text-3xl font-light">
                {orders.length}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                Čakajú
              </p>

              <p className="mt-2 text-3xl font-light">
                {waitingOrders}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                Zaplatené
              </p>

              <p className="mt-2 text-3xl font-light">
                {paidOrders}
              </p>
            </div>
          </div>
        </header>

        {orders.length === 0 ? (
          <div className="py-24 text-center text-white/40">
            Zatiaľ neexistuje žiadna objednávka.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto border border-white/15">
            <table className="w-full min-w-[1200px] border-collapse text-left">
              <thead className="border-b border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.22em] text-white/40">
                <tr>
                  <th className="px-5 py-4">
                    Stav
                  </th>

                  <th className="px-5 py-4">
                    Fotografie
                  </th>

                  <th className="px-5 py-4">
                    Galéria
                  </th>

                  <th className="px-5 py-4">
                    E-mail
                  </th>

                  <th className="px-5 py-4">
                    Cena
                  </th>

                  <th className="px-5 py-4">
                    Platba
                  </th>

                  <th className="px-5 py-4">
                    Vytvorené
                  </th>

                  <th className="px-5 py-4">
                    Akcia
                  </th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => {
                  const items =
                    getOrderItems(order);

                  const count =
                    items.length;

                  const photoLabel =
                    items
                      .map(
                        (item) =>
                          item.photoId,
                      )
                      .join(", ");

                  return (
                    <tr
                      key={order.id}
                      className="border-b border-white/10 last:border-b-0"
                    >
                      <td className="px-5 py-5">
                        <span className="inline-flex border border-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/70">
                          {getStatusText(
                            order.status,
                          )}
                        </span>
                      </td>

                      <td className="max-w-[320px] px-5 py-5">
                        <p className="font-medium">
                          {count}{" "}
                          {count === 1
                            ? "fotografia"
                            : "fotografií"}
                        </p>

                        <p className="mt-2 break-words text-xs leading-6 text-white/55">
                          {photoLabel}
                        </p>

                        <p className="mt-2 text-xs text-white/25">
                          {order.id}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <p>
                          {order.galleryTitle}
                        </p>

                        <p className="mt-2 text-xs text-white/35">
                          {order.galleryDate}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <a
                          href={`mailto:${order.email}`}
                          className="transition hover:text-white/60"
                        >
                          {order.email}
                        </a>
                      </td>

                      <td className="px-5 py-5">
                        <p className="text-lg">
                          {order.price} €
                        </p>

                        {order.unitPrice ? (
                          <p className="mt-1 text-xs text-white/35">
                            {order.unitPrice} €
                            /ks
                          </p>
                        ) : null}
                      </td>

                      <td className="px-5 py-5">
                        {order.paymentMode ===
                        "manual" ? (
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.15em] text-yellow-300">
                              Manuálna suma
                            </p>

                            <p className="mt-2 text-sm">
                              Očakávané:{" "}
                              {order.expectedAmount ??
                                order.price}{" "}
                              €
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs uppercase tracking-[0.15em] text-white/45">
                            Pevná suma
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-5 text-sm text-white/50">
                        {formatDate(
                          order.createdAt,
                        )}
                      </td>

                      <td className="px-5 py-5">
                        <OrderActions
  orderId={order.id}
  status={order.status}
  email={order.email}
  photoLabel={photoLabel}
  count={count}
  paymentMode={order.paymentMode}
  expectedAmount={
    order.expectedAmount ??
    order.price
  }
  unitPrice={
    order.unitPrice ??
    items[0]?.price
  }
/>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}