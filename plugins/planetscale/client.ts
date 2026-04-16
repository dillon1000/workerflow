export interface PlanetscaleConnectionParts {
  host: string;
  username: string;
  password: string;
  database?: string;
}

export function parseConnectionString(
  connectionString: string,
): PlanetscaleConnectionParts {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      "Invalid PlanetScale connection string. Expected mysql://user:pass@host/db.",
    );
  }
  if (!url.hostname) {
    throw new Error("PlanetScale connection string is missing a host.");
  }
  if (!url.username || !url.password) {
    throw new Error(
      "PlanetScale connection string must include a username and password.",
    );
  }
  return {
    host: url.hostname,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || undefined,
  };
}

interface PlanetscaleField {
  name: string;
  type: string;
}

interface PlanetscaleRow {
  lengths: string[];
  values?: string;
}

interface PlanetscaleExecuteResponse {
  session: unknown;
  result?: {
    fields?: PlanetscaleField[];
    rows?: PlanetscaleRow[];
    rowsAffected?: string;
    insertId?: string;
  };
  error?: { message: string; code?: string };
}

function decodeRowValues(row: PlanetscaleRow): string[] {
  if (!row.values) {
    return row.lengths.map(() => "");
  }
  const decoded = atob(row.values);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  const decoder = new TextDecoder("utf-8");
  const values: string[] = [];
  let offset = 0;
  for (const rawLength of row.lengths) {
    const length = Number(rawLength);
    if (length < 0) {
      values.push("");
      continue;
    }
    values.push(decoder.decode(bytes.subarray(offset, offset + length)));
    offset += length;
  }
  return values;
}

function coerceValue(raw: string, type: string): unknown {
  switch (type) {
    case "INT8":
    case "UINT8":
    case "INT16":
    case "UINT16":
    case "INT24":
    case "UINT24":
    case "INT32":
    case "UINT32":
      return Number(raw);
    case "INT64":
    case "UINT64":
      return raw;
    case "FLOAT32":
    case "FLOAT64":
    case "DECIMAL":
      return Number(raw);
    case "NULL":
      return null;
    case "JSON":
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    default:
      return raw;
  }
}

function quoteIdentifierValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  const escaped = String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${escaped}'`;
}

function interpolate(sql: string, params: unknown[]): string {
  if (params.length === 0) return sql;
  let index = 0;
  return sql.replace(/\?/g, () => {
    if (index >= params.length) {
      throw new Error("Not enough parameters supplied for query.");
    }
    const value = params[index];
    index += 1;
    return quoteIdentifierValue(value);
  });
}

export interface ExecutePlanetscaleQueryInput {
  host: string;
  username: string;
  password: string;
  sql: string;
  params: unknown[];
}

export async function executePlanetscaleQuery({
  host,
  username,
  password,
  sql,
  params,
}: ExecutePlanetscaleQueryInput): Promise<Record<string, unknown>[]> {
  const query = interpolate(sql, params);
  const authorization = `Basic ${btoa(`${username}:${password}`)}`;
  const response = await fetch(
    `https://${host}/psdb.v1alpha1.Database/Execute`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/json",
        "User-Agent": "workerflow",
      },
      body: JSON.stringify({ query, session: null }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `PlanetScale query failed with ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const body = (await response.json()) as PlanetscaleExecuteResponse;
  if (body.error) {
    throw new Error(`PlanetScale error: ${body.error.message}`);
  }

  const fields = body.result?.fields ?? [];
  const rawRows = body.result?.rows ?? [];
  return rawRows.map((row) => {
    const values = decodeRowValues(row);
    const entry: Record<string, unknown> = {};
    fields.forEach((field, index) => {
      entry[field.name] = coerceValue(values[index] ?? "", field.type);
    });
    return entry;
  });
}
