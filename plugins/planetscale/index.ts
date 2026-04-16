import type { WorkflowPluginManifest } from "../types";

const dataAccent = "from-sky-500 via-blue-500 to-indigo-500";

export const plugin: WorkflowPluginManifest = {
  id: "planetscale",
  title: "PlanetScale",
  description:
    "Query PlanetScale MySQL databases via the serverless HTTP driver.",
  connections: [
    {
      provider: "planetscale",
      title: "PlanetScale",
      description:
        "MySQL-compatible serverless database. Use your PlanetScale connection string (mysql://user:pass@host/db).",
      monogram: "PS",
      docsUrl: "https://planetscale.com/docs/concepts/serverless-driver",
      fields: [
        {
          key: "connectionString",
          label: "Connection string",
          kind: "password",
          placeholder:
            "mysql://user:pass@aws.connect.psdb.cloud/db?sslaccept=strict",
          required: true,
          secret: true,
          description:
            "Standard PlanetScale MySQL connection string. Host, username and password are parsed from this URL.",
        },
      ],
    },
  ],
  nodes: [
    {
      kind: "queryPlanetscale",
      family: "data",
      title: "Query PlanetScale",
      subtitle: "Run parameterized SQL against PlanetScale over HTTP.",
      accent: dataAccent,
      defaultConfig: {
        connectionAlias: "",
        sql: "select 1 as ok",
        params: "[]",
      },
      stepId: "query-planetscale",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "planetscale",
        },
        {
          key: "sql",
          label: "SQL",
          kind: "textarea",
          required: true,
          allowTemplates: true,
        },
        {
          key: "params",
          label: "Parameters (JSON array)",
          kind: "json",
          allowTemplates: true,
          placeholder: "[]",
        },
      ],
    },
  ],
};
