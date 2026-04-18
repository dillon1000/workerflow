import type { WorkflowNode } from "../../../src/lib/workflow/types";
import { readProperty, templateContext } from "./template";

type ExpressionToken = {
  type: "identifier" | "number" | "string" | "boolean" | "null" | "operator";
  value: string;
};

function tokenizeExpression(expression: string) {
  const tokens: ExpressionToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const threeCharOperator = expression.slice(index, index + 3);
    if (threeCharOperator === "===" || threeCharOperator === "!==") {
      tokens.push({ type: "operator", value: threeCharOperator });
      index += 3;
      continue;
    }

    const twoCharOperator = expression.slice(index, index + 2);
    if (["&&", "||", "==", "!=", ">=", "<=", "?."].includes(twoCharOperator)) {
      tokens.push({ type: "operator", value: twoCharOperator });
      index += 2;
      continue;
    }

    if (["(", ")", "!", ".", ">", "<"].includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      let value = "";
      const quote = char;
      index += 1;
      while (index < expression.length) {
        const next = expression[index];
        if (next === "\\") {
          const escaped = expression[index + 1];
          if (escaped == null) {
            throw new Error("Unterminated string in condition expression.");
          }
          value += escaped;
          index += 2;
          continue;
        }
        if (next === quote) {
          index += 1;
          break;
        }
        value += next;
        index += 1;
      }
      tokens.push({ type: "string", value });
      continue;
    }

    if (/\d/.test(char)) {
      const match = expression.slice(index).match(/^\d+(\.\d+)?/);
      if (!match) {
        throw new Error("Invalid numeric literal in condition expression.");
      }
      tokens.push({ type: "number", value: match[0] });
      index += match[0].length;
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      const match = expression.slice(index).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
      if (!match) {
        throw new Error("Invalid identifier in condition expression.");
      }
      const value = match[0];
      if (value === "true" || value === "false") {
        tokens.push({ type: "boolean", value });
      } else if (value === "null" || value === "undefined") {
        tokens.push({ type: "null", value });
      } else {
        tokens.push({ type: "identifier", value });
      }
      index += value.length;
      continue;
    }

    throw new Error(`Unsupported token "${char}" in condition expression.`);
  }

  return tokens;
}

function coerceBoolean(value: unknown) {
  return Boolean(value);
}

function isEqual(left: unknown, right: unknown, strict: boolean) {
  return strict ? left === right : left == right;
}

function compareValues(left: unknown, right: unknown, operator: string) {
  const comparableLeft = left as string | number | bigint | boolean | Date;
  const comparableRight = right as string | number | bigint | boolean | Date;
  switch (operator) {
    case ">":
      return comparableLeft > comparableRight;
    case "<":
      return comparableLeft < comparableRight;
    case ">=":
      return comparableLeft >= comparableRight;
    case "<=":
      return comparableLeft <= comparableRight;
    default:
      throw new Error(`Unsupported comparison operator "${operator}".`);
  }
}

function parseExpressionValue(
  tokens: ExpressionToken[],
  context: Record<string, unknown>,
) {
  let index = 0;

  const peek = () => tokens[index];
  const consume = (expected?: string) => {
    const token = tokens[index];
    if (!token) {
      throw new Error("Unexpected end of condition expression.");
    }
    if (expected && token.value !== expected) {
      throw new Error(`Expected "${expected}" but found "${token.value}".`);
    }
    index += 1;
    return token;
  };

  const parsePrimary = (): unknown => {
    const token = peek();
    if (!token) {
      throw new Error("Unexpected end of condition expression.");
    }

    if (token.value === "(") {
      consume("(");
      const value = parseOr();
      consume(")");
      return value;
    }

    if (token.value === "!") {
      consume("!");
      return !coerceBoolean(parsePrimary());
    }

    if (token.type === "string") {
      consume();
      return token.value;
    }

    if (token.type === "number") {
      consume();
      return Number(token.value);
    }

    if (token.type === "boolean") {
      consume();
      return token.value === "true";
    }

    if (token.type === "null") {
      consume();
      return null;
    }

    if (token.type === "identifier") {
      if (token.value === "Boolean" && tokens[index + 1]?.value === "(") {
        consume();
        consume("(");
        const value = parseOr();
        consume(")");
        return coerceBoolean(value);
      }

      let value = context[token.value];
      consume();

      while (peek()?.value === "." || peek()?.value === "?.") {
        const optional = consume().value === "?.";
        const property = consume();
        if (property.type !== "identifier") {
          throw new Error("Expected property name in condition expression.");
        }
        if (value == null) {
          if (optional) {
            value = undefined;
            continue;
          }
          throw new Error(
            `Cannot read property "${property.value}" from empty value.`,
          );
        }
        value = readProperty(value, property.value);
      }

      return value;
    }

    throw new Error(`Unsupported token "${token.value}" in condition.`);
  };

  const parseComparison = (): unknown => {
    let left = parsePrimary();
    while (
      peek() &&
      ["===", "!==", "==", "!=", ">", "<", ">=", "<="].includes(peek()!.value)
    ) {
      const operator = consume().value;
      const right = parsePrimary();
      switch (operator) {
        case "===":
          left = isEqual(left, right, true);
          break;
        case "!==":
          left = !isEqual(left, right, true);
          break;
        case "==":
          left = isEqual(left, right, false);
          break;
        case "!=":
          left = !isEqual(left, right, false);
          break;
        default:
          left = compareValues(left, right, operator);
      }
    }
    return left;
  };

  const parseAnd = (): unknown => {
    let left = parseComparison();
    while (peek()?.value === "&&") {
      consume("&&");
      const right = parseComparison();
      left = coerceBoolean(left) && coerceBoolean(right);
    }
    return left;
  };

  const parseOr = (): unknown => {
    let left = parseAnd();
    while (peek()?.value === "||") {
      consume("||");
      const right = parseAnd();
      left = coerceBoolean(left) || coerceBoolean(right);
    }
    return left;
  };

  const result = parseOr();
  if (index < tokens.length) {
    throw new Error(
      `Unexpected token "${tokens[index]?.value}" in condition expression.`,
    );
  }
  return result;
}

export function evaluateExpression(
  expression: string,
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
  nodes: WorkflowNode[],
) {
  const context = templateContext(payload, outputs, nodes);
  const tokens = tokenizeExpression(expression);
  return coerceBoolean(parseExpressionValue(tokens, context));
}
