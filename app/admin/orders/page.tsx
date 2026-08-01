import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import OrderActions from "@/components/OrderActions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead className="border-b border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.22em] text-white/40">
                <tr>
                  <th className="px-5 py-4">
                    Stav
                  </th>

                  <th className="px-5 py-4">
                    Fotografia
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
                    Vytvorené
                  </th>

                  <th className="px-5 py-4">
                    Akcia
                  </th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
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

                    <td className="px-5 py-5">
                      <p className="font-medium tracking-[0.1em]">
                        {order.photoId}
                      </p>

                      <p className="mt-2 text-xs text-white/35">
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

                    <td className="px-5 py-5 text-lg">
                      {order.price} €
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
                        photoId={order.photoId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}