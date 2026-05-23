export type ContactUsRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string;
  service: string;
  other_service: string | null;
  seen_at: string | null;
  created_at: string;
};

const SERVICE_LABELS: Record<string, string> = {
  residential: "Residential Construction",
  commercial: "Commercial Projects",
  renovation: "Renovation & Remodeling",
  others: "Others",
};

export function formatContactService(row: ContactUsRow): string {
  const label = SERVICE_LABELS[row.service] ?? row.service;
  if (row.service === "others" && row.other_service) {
    return `${label}: ${row.other_service}`;
  }
  return label;
}

export function isContactUnseen(row: ContactUsRow): boolean {
  return row.seen_at == null;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportContactUsToExcel(rows: ContactUsRow[], filename: string) {
  const headers = ["Submitted", "Name", "Phone", "Email", "City", "Service", "Status"];
  const lines = rows.map((row) => {
    const cells = [
      new Date(row.created_at).toLocaleString(),
      row.name,
      row.phone,
      row.email ?? "",
      row.city,
      formatContactService(row),
      row.seen_at ? "Seen" : "New",
    ];
    return cells.map(escapeCsvCell).join(",");
  });

  const bom = "\uFEFF";
  const csv = bom + [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
