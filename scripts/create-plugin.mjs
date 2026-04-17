#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rootDir = process.cwd();
const pluginsDir = join(rootDir, "plugins");
const templateDir = join(pluginsDir, "_template");

const leadingUppercasePattern = /^[A-Z]/;
const validIdentifierPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const unsafePathPattern = /[/\\]|\.\./;

function toKebabCase(value) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toCamelCase(value) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_match, group) =>
      group ? group.toUpperCase() : "",
    )
    .replace(leadingUppercasePattern, (character) => character.toLowerCase());
}

function toPascalCase(value) {
  const camelCase = toCamelCase(value);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

function toTitleCase(value) {
  return toKebabCase(value)
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function toMonogram(value) {
  const segments = toKebabCase(value).split("-").filter(Boolean);
  const letters =
    segments.length > 1
      ? segments.slice(0, 2).map((segment) => segment.charAt(0))
      : [segments[0]?.charAt(0) ?? "", segments[0]?.charAt(1) ?? ""];
  return letters.join("").toUpperCase() || "PL";
}

function escapeTemplateLiteral(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");
}

function isValidIdentifier(value) {
  return validIdentifierPattern.test(value);
}

function replacePlaceholders(content, config) {
  const pluginKebab = toKebabCase(config.pluginName);
  const pluginCamel = toCamelCase(config.pluginName);
  const pluginPascal = toPascalCase(config.pluginName);
  const pluginTitle = toTitleCase(config.pluginName);
  const pluginMonogram = toMonogram(config.pluginName);

  const actionKebab = toKebabCase(config.actionName);
  const actionCamel = toCamelCase(config.actionName);
  const actionPascal = toPascalCase(config.actionName);
  const actionTitle = toTitleCase(config.actionName);

  return content
    .replaceAll("[plugin-kebab]", pluginKebab)
    .replaceAll("[plugin-camel]", pluginCamel)
    .replaceAll("[PluginPascal]", pluginPascal)
    .replaceAll("[Plugin Title]", pluginTitle)
    .replaceAll("[PLUGIN_MONOGRAM]", pluginMonogram)
    .replaceAll(
      "[Plugin Description]",
      escapeTemplateLiteral(config.pluginDescription.trim()),
    )
    .replaceAll("[action-kebab]", actionKebab)
    .replaceAll("[action-camel]", actionCamel)
    .replaceAll("[ActionPascal]", actionPascal)
    .replaceAll("[Action Title]", actionTitle)
    .replaceAll(
      "[Action Description]",
      escapeTemplateLiteral(config.actionDescription.trim()),
    );
}

function getTemplateFiles(actionSlug) {
  return [
    ["index.template.ts", "index.ts"],
    ["icon.template.tsx", "icon.tsx"],
    ["credentials.template.ts", "credentials.ts"],
    ["test.template.ts", "test.ts"],
    ["steps/action.template.ts", `steps/${actionSlug}.ts`],
  ];
}

async function promptUntilValid(rl, message, validate) {
  while (true) {
    const value = (await rl.question(message)).trim();
    const validation = validate(value);
    if (validation === true) {
      return value;
    }
    stdout.write(`${validation}\n`);
  }
}

async function main() {
  stdout.write("\nCreate New Plugin\n\n");

  if (!existsSync(templateDir)) {
    throw new Error("Template directory not found at plugins/_template.");
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const pluginName = await promptUntilValid(rl, "Plugin name: ", (value) => {
      if (!value) {
        return "Plugin name is required.";
      }
      if (unsafePathPattern.test(value)) {
        return "Plugin name cannot contain path separators or '..'.";
      }
      const pluginKebab = toKebabCase(value);
      const pluginCamel = toCamelCase(value);
      const pluginPascal = toPascalCase(value);
      if (!pluginKebab) {
        return "Plugin name must contain letters or numbers.";
      }
      if (!isValidIdentifier(pluginCamel) || !isValidIdentifier(pluginPascal)) {
        return "Plugin name must convert into valid TypeScript identifiers.";
      }
      if (existsSync(join(pluginsDir, pluginKebab))) {
        return `Plugin already exists at plugins/${pluginKebab}/.`;
      }
      return true;
    });

    const pluginDescription = await promptUntilValid(
      rl,
      "Plugin description: ",
      (value) => (value ? true : "Plugin description is required."),
    );

    const actionName = await promptUntilValid(rl, "Action name: ", (value) => {
      if (!value) {
        return "Action name is required.";
      }
      if (unsafePathPattern.test(value)) {
        return "Action name cannot contain path separators or '..'.";
      }
      const actionCamel = toCamelCase(value);
      const actionPascal = toPascalCase(value);
      if (!isValidIdentifier(actionCamel) || !isValidIdentifier(actionPascal)) {
        return "Action name must convert into valid TypeScript identifiers.";
      }
      return true;
    });

    const actionDescription = await promptUntilValid(
      rl,
      "Action description: ",
      (value) => (value ? true : "Action description is required."),
    );

    const pluginSlug = toKebabCase(pluginName);
    const actionSlug = toKebabCase(actionName);
    const pluginDir = join(pluginsDir, pluginSlug);

    mkdirSync(join(pluginDir, "steps"), { recursive: true });

    const createdFiles = [];
    for (const [templateName, destination] of getTemplateFiles(actionSlug)) {
      const templatePath = join(templateDir, templateName);
      const destinationPath = join(pluginDir, destination);

      if (!existsSync(templatePath)) {
        throw new Error(
          `Missing template file: plugins/_template/${templateName}`,
        );
      }

      const content = replacePlaceholders(readFileSync(templatePath, "utf8"), {
        pluginName,
        pluginDescription,
        actionName,
        actionDescription,
      });

      writeFileSync(destinationPath, content, "utf8");
      createdFiles.push(`plugins/${pluginSlug}/${destination}`);
    }

    stdout.write(`\nCreated plugin at plugins/${pluginSlug}/\n`);
    for (const file of createdFiles) {
      stdout.write(`- ${file}\n`);
    }

    stdout.write("\nRefreshing plugins/index.ts...\n");
    execFileSync("pnpm", ["discover-plugins"], {
      cwd: rootDir,
      stdio: "inherit",
    });

    stdout.write(
      `\nPlugin "${toTitleCase(pluginName)}" is ready for customization.\n`,
    );
    stdout.write(
      `Next: implement plugins/${pluginSlug}/steps/${actionSlug}.ts\n\n`,
    );
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
