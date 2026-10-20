// Set to false after Revolut payment links have been verified.
export const REVOLUT_PAYMENTS_PAUSED = true;

export function paymentOutageMessage(language: string): string {
  return language === "en"
    ? "Online payment is temporarily unavailable due to a Revolut outage. Please choose bank transfer."
    : "Online platba je dočasne nedostupná pre výpadok Revolutu. Prosím, zvoľte bankový prevod.";
}
