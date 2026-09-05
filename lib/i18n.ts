export type Language = "sk" | "en";

export const translations = {
  sk: {
    galleriesNav: "Galérie",
    contactNav: "Kontakt",
    testNotice:
      "SPORT PHOTOGRAPHY - WEB je v testovacej prevádzke.",
    galleryTitle: "Galéria",
    contactTitle: "Kontakt.",
    contactSubtitle: "Ozvite sa.",
    adminLabel: "Administrácia objednávok",

    backToGalleries: "Späť na galérie",
    ledonGallery: "LEDON.GALÉRIA",
    photoCount: "Počet fotografií",

    infoText1Before:
      "Všetky fotografie v galérii sú po základnej úprave. Ak máte záujem o",
    infoText1Strong:
      "individuálnu úpravu konkrétnej fotografie",
    infoText1After:
      ", kontaktujte ma e-mailom.",

    infoText2Before:
      "Ak vám nevyhovuje platba cez",
    infoText2Strong: "Revolut",
    infoText2After:
      ", kontaktujte ma a dohodneme sa na inom spôsobe platby.",

    infoText3Before:
      "V prípade akýchkoľvek otázok alebo problémov mi neváhajte napísať.",
    infoText3Strong: "Rád vám pomôžem.",

    emailLabel: "E-mail:",

    findPhotosByTime: "Nájsť fotky podľa času",
    timeSearchHelp:
      "Zadajte približný čas, kedy ste prechádzali okolo fotografa.",
    fromLabel: "Od",
    toLabel: "Do",
    searchButton: "Vyhľadať",
    foundPhotos: "Nájdených",
    photosWord: "fotografií",
    showAllPhotos: "Zobraziť všetky fotografie",
    viewPhoto: "Zobraziť fotografiu",
    noPhotosFound:
      "V zadanom čase sa nenašli žiadne fotografie.",
    backToGallery: "Späť do galérie",
    closePhoto: "Zatvoriť fotografiu",
    previousPhoto: "Predchádzajúca fotografia",
    nextPhoto: "Nasledujúca fotografia",
    photoTime: "Čas fotografie:",
    originalWithoutWatermark: "Originál bez vodoznaku",
    fullResolution: "Plné rozlíšenie fotografie",
    deliveryAfterPayment:
      "Doručenie po potvrdení platby",
    paymentInfo:
      "Platba prebehne cez Revolut Pro. Originál vám odošleme na zadaný e-mail.",

    addToCart: "Pridať do košíka",
    removeFromCart: "Odobrať z košíka",

    cartTitle: "Košík",
    selectedPhotos: "Vybrané fotografie",
    cartEmpty: "Košík je prázdny.",
    showGalleries: "Zobraziť galérie",
    remove: "Odobrať",
    continueSelecting: "Pokračovať vo výbere",
    clearCart: "Vyprázdniť košík",
    summary: "Súhrn",
    totalPrice: "Celková cena",
    deliveryEmail: "E-mail na doručenie",
    emailConsent:
      "Súhlasím so spracovaním e-mailu na vybavenie a doručenie objednávky.",
    enterEmail: "Zadajte e-mail.",
    emailConsentError:
      "Potvrďte súhlas so spracovaním e-mailu.",
    orderCreateError:
      "Objednávku sa nepodarilo vytvoriť.",
    paymentLinkError:
      "Platobný odkaz sa nepodarilo pripraviť.",
    creatingOrder: "Vytváram objednávku...",
    pay: "Zaplatiť",
    viaRevolut: "cez Revolut",
    revolutPayment: "Platba cez Revolut Pro",
  },

  en: {
    galleriesNav: "Galleries",
    contactNav: "Contact",
    testNotice:
      "SPORT PHOTOGRAPHY - WEBSITE IN TEST MODE.",
    galleryTitle: "Gallery",
    contactTitle: "Contact.",
    contactSubtitle: "Get in touch.",
    adminLabel: "Order administration",

    backToGalleries: "Back to galleries",
    ledonGallery: "LEDON.GALLERY",
    photoCount: "Number of photos",

    infoText1Before:
      "All photos in the gallery have received basic editing. If you are interested in",
    infoText1Strong:
      "individual editing of a specific photo",
    infoText1After:
      ", please contact me by email.",

    infoText2Before:
      "If Revolut payment is not suitable for you,",
    infoText2Strong: "contact me",
    infoText2After:
      " and we can arrange another payment method.",

    infoText3Before:
      "If you have any questions or problems, feel free to contact me.",
    infoText3Strong: "I’ll be happy to help.",

    emailLabel: "Email:",

    findPhotosByTime: "Find photos by time",
    timeSearchHelp:
      "Enter the approximate time when you passed the photographer.",
    fromLabel: "From",
    toLabel: "To",
    searchButton: "Search",
    foundPhotos: "Found",
    photosWord: "photos",
    showAllPhotos: "Show all photos",
    viewPhoto: "View photo",
    noPhotosFound:
      "No photos were found in the selected time range.",
    backToGallery: "Back to gallery",
    closePhoto: "Close photo",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    photoTime: "Photo time:",
    originalWithoutWatermark: "Original without watermark",
    fullResolution: "Full-resolution photo",
    deliveryAfterPayment:
      "Delivery after payment confirmation",
    paymentInfo:
      "Payment is made via Revolut Pro. The original photo will be sent to your email address.",

    addToCart: "Add to cart",
    removeFromCart: "Remove from cart",

    cartTitle: "Cart",
    selectedPhotos: "Selected photos",
    cartEmpty: "Your cart is empty.",
    showGalleries: "View galleries",
    remove: "Remove",
    continueSelecting: "Continue selecting",
    clearCart: "Empty cart",
    summary: "Summary",
    totalPrice: "Total price",
    deliveryEmail: "Delivery email",
    emailConsent:
      "I agree to the processing of my email address for processing and delivering the order.",
    enterEmail: "Enter your email address.",
    emailConsentError:
      "Please confirm your consent to the processing of your email address.",
    orderCreateError:
      "The order could not be created.",
    paymentLinkError:
      "The payment link could not be prepared.",
    creatingOrder: "Creating order...",
    pay: "Pay",
    viaRevolut: "via Revolut",
    revolutPayment: "Payment via Revolut Pro",
  },
} satisfies Record<
  Language,
  Record<string, string>
>;