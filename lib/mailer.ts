export type ReminderEmail = {
  to: string;
  name: string;
  matchLabel: string;
  kickoffAt: string;
  predictionUrl: string;
};

export async function sendPredictionReminder(input: ReminderEmail) {
  console.log("[MAIL:disabled-whatsapp-only]", input);
  return { id: "mail-disabled", channel: "whatsapp" };
}
