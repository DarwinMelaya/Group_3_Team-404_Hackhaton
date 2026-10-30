export const sections = {
  dashboard: { title: "Dashboard", description: "" },
  "harvest-exchange": {
    title: "Harvest Exchange",
    description:
      "Search and filter surplus crop listings across Marinduque, with Admin verification, quality grades, inventory accounting, and spoilage urgency.",
  },
  "supply-pooling": {
    title: "Supply Pooling",
    description:
      "Distribute farmer harvests across multiple market demands (e.g., 100 kg Banana → 40 kg + 35 kg + 25 kg) and accept or reject supply offers.",
  },
  "processor-requests": {
    title: "Processor Requests",
    description:
      "Post and manage crop demands from verified Markets (Public Markets, Cooperatives, Food Processors, and Retail Buyers) across Marinduque.",
  },
  "ai-value-add": {
    title: "AI Value-Add Analysis",
    description:
      "Compare illustrative raw selling revenue against value-added processing pathways using transparent conversion assumptions.",
  },
  transactions: {
    title: "Transactions",
    description:
      "Confirm actual delivered quantities, verify Market accounts as Admin, resolve disputes/cancellations, and inspect immutable audit logs.",
  },
} as const;

export type Section = keyof typeof sections;
