import { fingerprint, newKidId, newTxId, todayYmd } from "./ids"
import { enrichTransactions } from "./ledger"
import type {
  BankData,
  Kid,
  TagRow,
  ThemeFamily,
  Transaction,
  TxType,
} from "./types"

const REQUIRED_TABS = ["Summary", "Transactions", "Kids", "Tags"] as const

async function sheetsFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`https://sheets.googleapis.com/v4/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
  return res
}

async function sheetsJson<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await sheetsFetch(token, path, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets ${res.status}: ${text.slice(0, 280)}`)
  }
  return (await res.json()) as T
}

export function sheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
}

export async function validateFamilyBankSheet(
  token: string,
  spreadsheetId: string,
): Promise<{ ok: true; title: string } | { ok: false; reason: string }> {
  try {
    const meta = await sheetsJson<{
      properties?: { title?: string }
      sheets?: { properties?: { title?: string } }[]
    }>(
      token,
      `spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    )
    const titles = (meta.sheets || [])
      .map((s) => s.properties?.title || "")
      .filter(Boolean)
    for (const need of REQUIRED_TABS) {
      if (!titles.includes(need)) {
        return {
          ok: false,
          reason: "This doesn't look like a Family Bank sheet.",
        }
      }
    }
    return { ok: true, title: meta.properties?.title || "Family Bank" }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Can't open sheet"
    if (msg.includes("404") || msg.includes("403")) {
      return { ok: false, reason: "Can't open the Family Bank sheet." }
    }
    return { ok: false, reason: msg }
  }
}

function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw
  const s = String(raw ?? "")
    .replace(/[$,]/g, "")
    .trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

function cell(row: string[], i: number): string {
  return (row[i] ?? "").toString()
}

export async function readBankData(
  token: string,
  spreadsheetId: string,
): Promise<BankData> {
  const meta = await sheetsJson<{
    properties?: { title?: string }
    spreadsheetUrl?: string
  }>(
    token,
    `spreadsheets/${spreadsheetId}?fields=properties.title,spreadsheetUrl`,
  )

  const multi = await sheetsJson<{
    valueRanges?: { range?: string; values?: string[][] }[]
  }>(
    token,
    `spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?ranges=${encodeURIComponent("Kids!A:F")}&ranges=${encodeURIComponent("Tags!A:B")}&ranges=${encodeURIComponent("Transactions!A:M")}`,
  )

  const kidsRange = multi.valueRanges?.[0]?.values || []
  const tagsRange = multi.valueRanges?.[1]?.values || []
  const txRange = multi.valueRanges?.[2]?.values || []

  const kids: Kid[] = []
  for (let i = 1; i < kidsRange.length; i++) {
    const row = kidsRange[i] || []
    if (!cell(row, 0) && !cell(row, 1)) continue
    const themeRaw = cell(row, 3)
    const theme: ThemeFamily =
      themeRaw === "Bright" || themeRaw === "Bold" ? themeRaw : "Bold"
    kids.push({
      kidId: cell(row, 0),
      name: cell(row, 1),
      color: cell(row, 2) || "#D0021B",
      theme,
      added: cell(row, 4),
      addedBy: cell(row, 5),
      rowIndex: i + 1,
    })
  }

  const tags: TagRow[] = []
  for (let i = 1; i < tagsRange.length; i++) {
    const row = tagsRange[i] || []
    if (!cell(row, 0) && !cell(row, 1)) continue
    tags.push({ type: cell(row, 0), tag: cell(row, 1) })
  }

  const transactions: Transaction[] = []
  for (let i = 1; i < txRange.length; i++) {
    const row = txRange[i] || []
    if (!cell(row, 1) && !cell(row, 4) && !cell(row, 6)) continue
    const typeRaw = cell(row, 4)
    transactions.push({
      id: cell(row, 0),
      date: cell(row, 1),
      kidId: cell(row, 2),
      kidName: cell(row, 3),
      type: typeRaw as TxType,
      tag: cell(row, 5),
      amount: parseAmount(cell(row, 6)),
      note: cell(row, 7),
      reverses: cell(row, 8),
      corrects: cell(row, 9),
      enteredBy: cell(row, 10),
      enteredAt: cell(row, 11),
      check: cell(row, 12),
      rowIndex: i + 1,
    })
  }

  const { issues } = enrichTransactions(transactions, kids)

  return {
    kids,
    transactions,
    tags,
    issues,
    spreadsheetUrl: meta.spreadsheetUrl || sheetUrl(spreadsheetId),
    title: meta.properties?.title || "Family Bank",
  }
}

const TX_HEADERS = [
  "ID",
  "Date",
  "Kid ID",
  "Kid",
  "Type",
  "Tag",
  "Amount",
  "Note",
  "Reverses",
  "Corrects",
  "Entered By",
  "Entered At",
  "Check",
]

const KIDS_HEADERS = ["Kid ID", "Name", "Color", "Theme", "Added", "Added By"]
const TAGS_HEADERS = ["Type", "Tag"]

const SEED_TAGS: [string, string][] = [
  ["Deposit", "Cash"],
  ["Deposit", "Pay Day"],
  ["Deposit", "Gift"],
  ["Deposit", "Other"],
  ["Deposit", "Correction"],
  ["Expense", "Correction"],
]

export async function createFamilyBankSheet(
  token: string,
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const created = await sheetsJson<{
    spreadsheetId: string
    spreadsheetUrl?: string
    sheets: { properties: { sheetId: number; title: string } }[]
  }>(token, "spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title: "Family Bank" },
      sheets: [
        { properties: { title: "Summary", index: 0 } },
        { properties: { title: "Transactions", index: 1 } },
        { properties: { title: "Kids", index: 2 } },
        { properties: { title: "Tags", index: 3 } },
      ],
    }),
  })

  const id = created.spreadsheetId
  const sheetIds: Record<string, number> = {}
  for (const s of created.sheets) {
    sheetIds[s.properties.title] = s.properties.sheetId
  }

  const balLambda =
    'LAMBDA(id,name,SUMIFS(Transactions!G:G,Transactions!C:C,id,Transactions!E:E,"Deposit")' +
    '+SUMIFS(Transactions!G:G,Transactions!C:C,"",Transactions!D:D,name,Transactions!E:E,"Deposit")' +
    '-SUMIFS(Transactions!G:G,Transactions!C:C,id,Transactions!E:E,"Expense")' +
    '-SUMIFS(Transactions!G:G,Transactions!C:C,"",Transactions!D:D,name,Transactions!E:E,"Expense"))'

  const inLambda =
    'LAMBDA(id,name,SUMIFS(Transactions!G:G,Transactions!C:C,id,Transactions!E:E,"Deposit",Transactions!B:B,">="&EOMONTH(TODAY(),-1)+1,Transactions!F:F,"<>Correction")' +
    '+SUMIFS(Transactions!G:G,Transactions!C:C,"",Transactions!D:D,name,Transactions!E:E,"Deposit",Transactions!B:B,">="&EOMONTH(TODAY(),-1)+1,Transactions!F:F,"<>Correction"))'

  const outLambda =
    'LAMBDA(id,name,SUMIFS(Transactions!G:G,Transactions!C:C,id,Transactions!E:E,"Expense",Transactions!B:B,">="&EOMONTH(TODAY(),-1)+1,Transactions!F:F,"<>Correction")' +
    '+SUMIFS(Transactions!G:G,Transactions!C:C,"",Transactions!D:D,name,Transactions!E:E,"Expense",Transactions!B:B,">="&EOMONTH(TODAY(),-1)+1,Transactions!F:F,"<>Correction"))'

  const lastLambda =
    'LAMBDA(id,name,IFERROR(MAX(FILTER(Transactions!B:B,(Transactions!C:C=id)+((Transactions!C:C="")*(Transactions!D:D=name)))),""))'

  // Seed values
  await sheetsJson(token, `spreadsheets/${id}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: "Summary!A1",
          values: [
            ["Family Bank"],
            ['="Updated "&TEXT(NOW(),"yyyy-mm-dd h:mm am/pm")'],
            [
              "Kid ID",
              "Kid",
              "Balance",
              "In this month",
              "Out this month",
              "Last entry",
            ],
            [
              '=IFERROR(FILTER(Kids!A2:A,Kids!A2:A<>""),"")',
              '=IFERROR(MAP(A4:A,LAMBDA(id,IF(id="","",XLOOKUP(id,Kids!A:A,Kids!B:B)))),"")',
              `=IFERROR(MAP(A4:A,B4:B,${balLambda}),"")`,
              `=IFERROR(MAP(A4:A,B4:B,${inLambda}),"")`,
              `=IFERROR(MAP(A4:A,B4:B,${outLambda}),"")`,
              `=IFERROR(MAP(A4:A,B4:B,${lastLambda}),"")`,
            ],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            ["Recent activity"],
            [
              '=IFERROR(QUERY(Transactions!A:L,"select B,D,E,F,G,H where B is not null order by L desc limit 15",1),"")',
            ],
          ],
        },
        {
          range: "Transactions!A1:M1",
          values: [TX_HEADERS],
        },
        {
          range: "Kids!A1:F1",
          values: [KIDS_HEADERS],
        },
        {
          range: "Tags!A1:B1",
          values: [TAGS_HEADERS],
        },
        {
          range: "Tags!A2:B7",
          values: SEED_TAGS,
        },
      ],
    }),
  })

  // Formatting / freeze / validation (best-effort)
  const summaryId = sheetIds["Summary"]!
  const txId = sheetIds["Transactions"]!
  const kidsId = sheetIds["Kids"]!
  const tagsId = sheetIds["Tags"]!

  await sheetsJson(token, `spreadsheets/${id}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: summaryId,
              gridProperties: { hideGridlines: true },
            },
            fields: "gridProperties.hideGridlines",
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId: txId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: summaryId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 18 },
              },
            },
            fields: "userEnteredFormat.textFormat",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: summaryId,
              startRowIndex: 2,
              endRowIndex: 3,
              startColumnIndex: 0,
              endColumnIndex: 6,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 0.82, green: 0.01, blue: 0.11 } },
              },
            },
            fields: "userEnteredFormat.textFormat",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: summaryId,
              startRowIndex: 3,
              endRowIndex: 4,
              startColumnIndex: 2,
              endColumnIndex: 3,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: "CURRENCY",
                  pattern: "$#,##0.00;[Red]-$#,##0.00",
                },
                textFormat: { fontSize: 24, bold: true },
              },
            },
            fields:
              "userEnteredFormat.numberFormat,userEnteredFormat.textFormat",
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId: txId,
              startRowIndex: 1,
              endRowIndex: 1000,
              startColumnIndex: 4,
              endColumnIndex: 5,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: [
                  { userEnteredValue: "Deposit" },
                  { userEnteredValue: "Expense" },
                ],
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId: txId,
              startRowIndex: 1,
              endRowIndex: 1000,
              startColumnIndex: 5,
              endColumnIndex: 6,
            },
            rule: {
              condition: {
                type: "ONE_OF_RANGE",
                values: [{ userEnteredValue: "=Tags!B2:B" }],
              },
              strict: false,
              showCustomUi: true,
            },
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId: kidsId,
              startRowIndex: 1,
              endRowIndex: 100,
              startColumnIndex: 3,
              endColumnIndex: 4,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: [
                  { userEnteredValue: "Bright" },
                  { userEnteredValue: "Bold" },
                ],
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId: txId,
              dimension: "COLUMNS",
              startIndex: 7,
              endIndex: 8,
            },
            properties: { pixelSize: 220 },
            fields: "pixelSize",
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId: txId,
              dimension: "COLUMNS",
              startIndex: 2,
              endIndex: 3,
            },
            properties: { pixelSize: 70 },
            fields: "pixelSize",
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId: txId,
              dimension: "COLUMNS",
              startIndex: 12,
              endIndex: 13,
            },
            properties: { pixelSize: 70 },
            fields: "pixelSize",
          },
        },
        // protect Summary with warning only
        {
          addProtectedRange: {
            protectedRange: {
              range: { sheetId: summaryId },
              description: "Summary formulas — edit with care",
              warningOnly: true,
            },
          },
        },
        // touch tags sheet id to avoid unused lint
        {
          updateSheetProperties: {
            properties: { sheetId: tagsId, title: "Tags" },
            fields: "title",
          },
        },
      ],
    }),
  })

  return {
    spreadsheetId: id,
    spreadsheetUrl: created.spreadsheetUrl || sheetUrl(id),
  }
}

export async function appendKid(
  token: string,
  spreadsheetId: string,
  kid: {
    name: string
    color: string
    theme: ThemeFamily
    email: string
  },
): Promise<string> {
  const kidId = newKidId()
  const row = [
    kidId,
    kid.name.trim(),
    kid.color,
    kid.theme,
    todayYmd(),
    kid.email,
  ]
  await sheetsJson(
    token,
    `spreadsheets/${spreadsheetId}/values/Kids!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [row] }) },
  )
  return kidId
}

export async function updateKidDisplay(
  token: string,
  spreadsheetId: string,
  rowIndex: number,
  fields: { name: string; color: string; theme: ThemeFamily },
): Promise<void> {
  // In-place B–D only
  await sheetsJson(
    token,
    `spreadsheets/${spreadsheetId}/values/Kids!B${rowIndex}:D${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [[fields.name.trim(), fields.color, fields.theme]],
      }),
    },
  )
}

export async function fixKidId(
  token: string,
  spreadsheetId: string,
  rowIndex: number,
): Promise<string> {
  const kidId = newKidId()
  await sheetsJson(
    token,
    `spreadsheets/${spreadsheetId}/values/Kids!A${rowIndex}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: JSON.stringify({ values: [[kidId]] }) },
  )
  return kidId
}

export async function appendTag(
  token: string,
  spreadsheetId: string,
  tag: string,
): Promise<void> {
  await sheetsJson(
    token,
    `spreadsheets/${spreadsheetId}/values/Tags!A:B:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [["Deposit", tag.trim()]] }),
    },
  )
}

export type NewEntry = {
  date: string
  kidId: string
  kidName: string
  type: TxType
  tag: string
  amount: number
  note: string
  reverses?: string
  corrects?: string
  email: string
}

export async function appendTransaction(
  token: string,
  spreadsheetId: string,
  entry: NewEntry,
): Promise<string> {
  const id = newTxId()
  const reverses = entry.reverses || ""
  const corrects = entry.corrects || ""
  const check = fingerprint({
    date: entry.date,
    kidId: entry.kidId,
    type: entry.type,
    tag: entry.tag,
    amount: entry.amount,
    note: entry.note,
    reverses,
    corrects,
  })
  const enteredAt = new Date().toISOString()
  const row = [
    id,
    entry.date,
    entry.kidId,
    entry.kidName,
    entry.type,
    entry.tag,
    entry.amount,
    entry.note,
    reverses,
    corrects,
    entry.email,
    enteredAt,
    check,
  ]
  await sheetsJson(
    token,
    `spreadsheets/${spreadsheetId}/values/Transactions!A:M:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [row] }) },
  )
  return id
}
