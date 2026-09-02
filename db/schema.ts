export const entriesTable = {
  name: "entries",
  columns: {
    id: "TEXT PRIMARY KEY",
    text: "TEXT NOT NULL",
    urlsJson: "TEXT NOT NULL",
    normalizedUrlsJson: "TEXT NOT NULL",
    updatedAt: "INTEGER NOT NULL",
  },
} as const;

export const linksTable = {
  name: "entry_links",
  columns: {
    normalizedUrl: "TEXT PRIMARY KEY",
    entryId: "TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE",
  },
} as const;
