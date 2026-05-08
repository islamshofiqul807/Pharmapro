export const APP_NAME = "PharmaPro";
export const APP_NAME_BN = "\u09AB\u09BE\u09B0\u09CD\u09AE\u09BE \u09AA\u09CD\u09B0\u09CB";
export const FREE_MEDICINE_LIMIT = parseInt(process.env.NEXT_PUBLIC_FREE_MEDICINE_LIMIT ?? "100", 10);

export const MEDICINE_CATEGORIES = [
  { value: "tablet", label: "Tablet", label_bn: "\u099F\u09CD\u09AF\u09BE\u09AC\u09B2\u09C7\u099F" },
  { value: "capsule", label: "Capsule", label_bn: "\u0995\u09CD\u09AF\u09BE\u09AA\u09B8\u09C1\u09B2" },
  { value: "syrup", label: "Syrup", label_bn: "\u09B8\u09BF\u09B0\u09BE\u09AA" },
  { value: "injection", label: "Injection", label_bn: "\u0987\u09A8\u099C\u09C7\u0995\u09B6\u09A8" },
  { value: "drop", label: "Drop", label_bn: "\u09A1\u09CD\u09B0\u09AA" },
  { value: "cream", label: "Cream/Ointment", label_bn: "\u0995\u09CD\u09B0\u09BF\u09AE/\u09AE\u09B2\u09AE" },
  { value: "inhaler", label: "Inhaler", label_bn: "\u0987\u09A8\u09B9\u09C7\u09B2\u09BE\u09B0" },
  { value: "powder", label: "Powder", label_bn: "\u09AA\u09BE\u0989\u09A1\u09BE\u09B0" },
  { value: "other", label: "Other", label_bn: "\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF" },
];

export const MEDICINE_UNITS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "strip", label: "Strip" },
  { value: "box", label: "Box" },
  { value: "bottle", label: "Bottle" },
  { value: "vial", label: "Vial" },
  { value: "tube", label: "Tube" },
  { value: "sachet", label: "Sachet" },
];
