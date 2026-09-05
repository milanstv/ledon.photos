export type Language = "sk" | "en";

export const translations = {
  sk: {
    galleriesNav: "Galérie",
    contactNav: "Kontakt",
    testNotice: "SPORT PHOTOGRAPHY - WEB je v testovacej prevádzke.",
    galleryTitle: "Galéria",
    contactTitle: "Kontakt.",
    contactSubtitle: "Ozvite sa.",
    adminLabel: "Administrácia objednávok",
  },

  en: {
    galleriesNav: "Galleries",
    contactNav: "Contact",
    testNotice: "SPORT PHOTOGRAPHY - WEBSITE IN TEST MODE.",
    galleryTitle: "Gallery",
    contactTitle: "Contact.",
    contactSubtitle: "Get in touch.",
    adminLabel: "Order administration",
  },
} satisfies Record<
  Language,
  Record<string, string>
>;