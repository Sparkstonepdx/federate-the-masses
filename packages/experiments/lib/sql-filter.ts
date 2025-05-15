export function evaluateFilter(obj: any, filter: string): boolean {
  const operators: Record<string, string> = {
    '=': '===',
    '!=': '!==',
    '>': '>',
    '<': '<',
    '>=': '>=',
    '<=': '<=',
    IN: 'IN',
  };

  const operatorPattern = Object.keys(operators)
    .map(op => op.replace(/([=<>!])/g, '\\$1'))
    .join('|');

  const conditionRegex = new RegExp(
    `^\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s*(${operatorPattern})\\s*(.+?)\\s*$`,
    'i',
  );

  // Case-insensitive AND/OR splitter
  const tokens = filter.split(/\s+(AND|OR)\s+/i);
  const results: boolean[] = [];
  const logic: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      const match = tokens[i].match(conditionRegex);
      if (!match) throw new Error(`Invalid filter expression: "${tokens[i]}"`);

      let [, key, op, valueRaw] = match;
      op = op.toUpperCase();

      let result: boolean;

      if (op === 'IN') {
        const values = valueRaw
          .trim()
          .replace(/^\((.*)\)$/, '$1')
          .split(/\s*,\s*/)
          .map(val => JSON.parse(val.replace(/^'(.*)'$/, '"$1"')));
        result = values.includes(obj[key]);
      } else {
        const jsOp = operators[op];
        const parsedValue = JSON.parse(valueRaw.replace(/^'(.+)'$/, '"$1"'));
        result = Function(
          'obj',
          `return obj["${key}"] ${jsOp} ${JSON.stringify(parsedValue)};`,
        )(obj);
      }

      results.push(result);
    } else {
      logic.push(tokens[i].toUpperCase());
    }
  }

  // Apply logic left to right
  let finalResult = results[0];
  for (let i = 0; i < logic.length; i++) {
    if (logic[i] === 'AND') {
      finalResult = finalResult && results[i + 1];
    } else if (logic[i] === 'OR') {
      finalResult = finalResult || results[i + 1];
    }
  }

  return finalResult;
}
