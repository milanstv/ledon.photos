function FullScreenSection({
  id,
  image,
  align,
  title,
  subtitle,
  text,
  linkText,
  href,
}: {
  id?: string;
  image: string;
  align: "left" | "right";
  title: string;
  subtitle?: string;
  text?: string;
  linkText?: string;
  href?: string;
}) {
  return (
    <section id={id} className="relative h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />

      <div className="absolute inset-0 bg-black/5" />

      <div
        className={`relative z-10 flex h-full items-center px-8 md:px-10 ${
          align === "right" ? "justify-end text-right" : "justify-start text-left"
        }`}
      >
        <div className="max-w-xl">
          <h2 className="mb-6 text-5xl font-light tracking-tight md:text-6xl">
            {title}
          </h2>

          {subtitle && (
            <p className="text-lg uppercase tracking-[0.28em] text-white/80 md:text-xl">
              {subtitle}
            </p>
          )}

          {text && <p className="mt-4 text-lg text-white/70 md:text-xl">{text}</p>}

          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 inline-block text-xs uppercase tracking-[0.35em] text-white/75 transition hover:text-white"
            >
              {linkText ?? "View Gallery →"}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}