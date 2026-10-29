export const CROPS = [
  "Banana",
  "Arrowroot (uraro)",
  "Cassava",
  "Camote",
  "Coconut",
  "Vegetables",
] as const;
export const MUNICIPALITIES = [
  "Boac",
  "Mogpog",
  "Santa Cruz",
  "Torrijos",
  "Buenavista",
  "Gasan",
] as const;
export const STORAGE = [
  "Shaded and ventilated",
  "Ambient / open air",
  "Refrigerated",
  "Other / unknown",
] as const;
export type Harvest = {
  id: string;
  farmerId?: string;
  crop: string;
  quantity: number;
  price: number;
  harvestDate: string;
  municipality: string;
  barangay: string;
  storage: string;
  priority: "Standard" | "Priority";
  status?: "draft" | "pending_verification" | "available" | "rejected" | "closed";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string;
  createdAt?: string;
};
export type HarvestInput = {
  crop: string;
  quantity: string;
  price: string;
  harvestDate: string;
  municipality: string;
  barangay: string;
  storage: string;
  priority: "Standard" | "Priority";
};

export function todayInMarinduque(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function validateHarvest(
  input: HarvestInput,
  today = todayInMarinduque(),
): string | null {
  if (!(CROPS as readonly string[]).includes(input.crop))
    return "Choose a crop.";
  if (
    !input.quantity.trim() ||
    !Number.isFinite(Number(input.quantity)) ||
    Number(input.quantity) <= 0 ||
    Number(input.quantity) > 1000000
  )
    return "Enter a quantity greater than 0 and no more than 1,000,000 kg.";
  if (
    !input.price.trim() ||
    !Number.isFinite(Number(input.price)) ||
    Number(input.price) < 0 ||
    Number(input.price) > 1000000
  )
    return "Enter an asking price from 0 to 1,000,000 pesos per kg.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.harvestDate))
    return "Use YYYY-MM-DD for the harvest date.";
  const date = new Date(`${input.harvestDate}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.harvestDate
  )
    return "Enter a valid calendar date.";
  if (input.harvestDate > today) return "Harvest date cannot be in the future.";
  if (!(MUNICIPALITIES as readonly string[]).includes(input.municipality))
    return "Choose a municipality in Marinduque.";
  if (!input.barangay.trim() || input.barangay.trim().length > 100)
    return "Enter a barangay (1–100 characters).";
  if (!(STORAGE as readonly string[]).includes(input.storage))
    return "Choose a storage condition.";
  if (!["Standard", "Priority"].includes(input.priority))
    return "Choose a listing priority.";
  return null;
}

export function isHarvest(value: unknown): value is Harvest {
  if (typeof value !== "object" || value === null) return false;
  const h = value as Harvest;
  return (
    typeof h.id === "string" &&
    typeof h.quantity === "number" &&
    typeof h.price === "number" &&
    [
      "crop",
      "harvestDate",
      "municipality",
      "barangay",
      "storage",
      "priority",
    ].every((key) => typeof h[key as keyof Harvest] === "string") &&
    validateHarvest({
      ...h,
      quantity: String(h.quantity),
      price: String(h.price),
    }) === null
  );
}

export function initialHarvests(): Harvest[] {
  const harvestDate = todayInMarinduque();
  return [
    {
      id: "demo-banana",
      crop: "Banana",
      quantity: 180,
      price: 25,
      harvestDate,
      municipality: "Boac",
      barangay: "Demo barangay",
      storage: STORAGE[0],
      priority: "Priority",
    },
    {
      id: "demo-cassava",
      crop: "Cassava",
      quantity: 320,
      price: 18,
      harvestDate,
      municipality: "Boac",
      barangay: "Demo barangay",
      storage: STORAGE[0],
      priority: "Standard",
    },
  ];
}
