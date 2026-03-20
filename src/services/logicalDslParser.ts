/**
 * Logical DSL Parser
 *
 * Parses the human-readable DSL format into a LogicalModel.
 *
 * DSL Format:
 * ```
 * # Comments start with #
 *
 * # Cause definitions (no expression)
 * 入力A: "ユーザーがボタンをクリック"
 * 入力B: "ネットワーク接続あり"
 *
 * # Effect/Intermediate definitions (with expression)
 * 結果 := 入力A AND 入力B
 * エラー := 入力A AND NOT 入力B
 *
 * # Constraints
 * EXCL(結果, エラー)
 * ONE(入力A, 入力B)
 * REQ(入力A -> 結果)
 * MASK(入力A -> 結果, エラー)
 *
 * # Optional layout section
 * @layout {
 *   入力A: (100, 100)
 *   入力B: (100, 200)
 * }
 * ```
 */

import type {
  LogicalModel,
  LogicalNode,
  LogicalConstraint,
  ConstraintMemberRef,
  Expression,
} from '../types/logical';

import { ref, not, and, or } from '../types/logical';

// =============================================================================
// Parse Result
// =============================================================================

export interface ParseResult {
  success: boolean;
  model: LogicalModel;
  errors: ParseError[];
  warnings: string[];
}

export interface ParseError {
  line: number;
  message: string;
  content: string;
}

// =============================================================================
// Tokenizer
// =============================================================================

type TokenType =
  | 'IDENT'      // Identifier (node name)
  | 'STRING'     // Quoted string
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'COLON'      // :
  | 'ASSIGN'     // :=
  | 'ARROW'      // ->
  | 'LPAREN'     // (
  | 'RPAREN'     // )
  | 'LBRACKET'   // [
  | 'RBRACKET'   // ]
  | 'COMMA'      // ,
  | 'NUMBER'     // For positions
  | 'ONE' | 'EXCL' | 'INCL' | 'REQ' | 'MASK'
  | 'OBSERVABLE' // observable flag (backward compat)
  | 'UNOBSERVABLE' // unobservable flag
  | 'LAYOUT'     // @layout
  | 'LBRACE'     // {
  | 'RBRACE'     // }
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

function tokenize(input: string): { tokens: Token[]; errors: ParseError[] } {
  const tokens: Token[] = [];
  const errors: ParseError[] = [];
  const lines = input.split(/\r?\n/);

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let col = 0;

    // Skip comments and empty lines
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    while (col < line.length) {
      // Skip whitespace
      if (/\s/.test(line[col])) {
        col++;
        continue;
      }

      // Check for @layout
      if (line.slice(col).startsWith('@layout')) {
        tokens.push({ type: 'LAYOUT', value: '@layout', line: lineNum + 1, column: col + 1 });
        col += 7;
        continue;
      }

      // Check for :=
      if (line.slice(col, col + 2) === ':=') {
        tokens.push({ type: 'ASSIGN', value: ':=', line: lineNum + 1, column: col + 1 });
        col += 2;
        continue;
      }

      // Check for ->
      if (line.slice(col, col + 2) === '->') {
        tokens.push({ type: 'ARROW', value: '->', line: lineNum + 1, column: col + 1 });
        col += 2;
        continue;
      }

      // Single character tokens
      const char = line[col];
      if (char === ':') {
        tokens.push({ type: 'COLON', value: ':', line: lineNum + 1, column: col + 1 });
        col++;
        continue;
      }
      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(', line: lineNum + 1, column: col + 1 });
        col++;
        continue;
      }
      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')', line: lineNum + 1, column: col + 1 });
        col++;
        continue;
      }
      if (char === ',') {
        tokens.push({ type: 'COMMA', value: ',', line: lineNum + 1, column: col + 1 });
        col++;
        continue;
      }
      if (char === '{') {
        tokens.push({ type: 'LBRACE', value: '{', line: lineNum + 1, column: col + 1 });
        col++;
        continue;
      }
      if (char === '}') {
        tokens.push({ type: 'RBRACE', value: '}', line: lineNum + 1, column: col + 1 });
        col++;
        continue;
      }
      if (char === '[') {
        tokens.push({ type: 'LBRACKET', value: '[', line: lineNum + 1, column: col + 1 });
        col++;
        continue;
      }
      if (char === ']') {
        tokens.push({ type: 'RBRACKET', value: ']', line: lineNum + 1, column: col + 1 });
        col++;
        continue;
      }

      // String literal
      if (char === '"') {
        let str = '';
        col++; // Skip opening quote
        while (col < line.length && line[col] !== '"') {
          if (line[col] === '\\' && col + 1 < line.length) {
            const next = line[col + 1];
            if (next === 'n') str += '\n';
            else if (next === '"') str += '"';
            else if (next === '\\') str += '\\';
            else str += next;
            col += 2;
          } else {
            str += line[col];
            col++;
          }
        }
        if (col < line.length) col++; // Skip closing quote
        tokens.push({ type: 'STRING', value: str, line: lineNum + 1, column: col + 1 });
        continue;
      }

      // Number (for positions)
      if (/[-\d]/.test(char)) {
        let num = '';
        if (char === '-') {
          num += char;
          col++;
        }
        while (col < line.length && /\d/.test(line[col])) {
          num += line[col];
          col++;
        }
        tokens.push({ type: 'NUMBER', value: num, line: lineNum + 1, column: col + 1 });
        continue;
      }

      // Identifier or keyword
      if (/[a-zA-Z_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(char)) {
        let ident = '';
        while (col < line.length && /[a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(line[col])) {
          ident += line[col];
          col++;
        }

        // Check for keywords
        const upper = ident.toUpperCase();
        if (upper === 'AND') {
          tokens.push({ type: 'AND', value: ident, line: lineNum + 1, column: col + 1 });
        } else if (upper === 'OR') {
          tokens.push({ type: 'OR', value: ident, line: lineNum + 1, column: col + 1 });
        } else if (upper === 'NOT') {
          tokens.push({ type: 'NOT', value: ident, line: lineNum + 1, column: col + 1 });
        } else if (upper === 'ONE') {
          tokens.push({ type: 'ONE', value: ident, line: lineNum + 1, column: col + 1 });
        } else if (upper === 'EXCL') {
          tokens.push({ type: 'EXCL', value: ident, line: lineNum + 1, column: col + 1 });
        } else if (upper === 'INCL') {
          tokens.push({ type: 'INCL', value: ident, line: lineNum + 1, column: col + 1 });
        } else if (upper === 'REQ') {
          tokens.push({ type: 'REQ', value: ident, line: lineNum + 1, column: col + 1 });
        } else if (upper === 'MASK') {
          tokens.push({ type: 'MASK', value: ident, line: lineNum + 1, column: col + 1 });
        } else if (upper === 'OBSERVABLE') {
          tokens.push({ type: 'OBSERVABLE', value: ident, line: lineNum + 1, column: col + 1 });
        } else if (upper === 'UNOBSERVABLE') {
          tokens.push({ type: 'UNOBSERVABLE', value: ident, line: lineNum + 1, column: col + 1 });
        } else {
          tokens.push({ type: 'IDENT', value: ident, line: lineNum + 1, column: col + 1 });
        }
        continue;
      }

      // Unknown character
      errors.push({
        line: lineNum + 1,
        message: `Unexpected character: ${char}`,
        content: line,
      });
      col++;
    }
  }

  tokens.push({ type: 'EOF', value: '', line: lines.length, column: 0 });
  return { tokens, errors };
}

// =============================================================================
// Parser
// =============================================================================

class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private errors: ParseError[] = [];
  private warnings: string[] = [];
  private nodes: Map<string, LogicalNode> = new Map();
  private constraints: LogicalConstraint[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ParseResult {
    while (!this.isAtEnd()) {
      this.parseStatement();
    }

    return {
      success: this.errors.length === 0,
      model: {
        nodes: this.nodes,
        constraints: this.constraints,
      },
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  private parseStatement(): void {
    const token = this.peek();

    // Constraint keywords
    if (['ONE', 'EXCL', 'INCL', 'REQ', 'MASK'].includes(token.type)) {
      this.parseConstraint();
      return;
    }

    // Layout section
    if (token.type === 'LAYOUT') {
      this.parseLayout();
      return;
    }

    // Node definition (either cause or effect)
    if (token.type === 'IDENT') {
      this.parseNodeDefinition();
      return;
    }

    // Skip unknown
    if (token.type !== 'EOF') {
      this.errors.push({
        line: token.line,
        message: `Unexpected token: ${token.value}`,
        content: '',
      });
      this.advance();
    }
  }

  private parseNodeDefinition(): void {
    const nameToken = this.consume('IDENT', 'Expected node name');
    if (!nameToken) return;

    const name = nameToken.value;

    // Check for : (cause definition) or := (effect definition)
    if (this.check('COLON')) {
      // Cause definition: name: "label" [unobservable]
      this.advance(); // consume :
      const labelToken = this.consume('STRING', 'Expected label string after :');
      if (!labelToken) return;

      // Check for [observable] or [unobservable] flag
      const observable = this.parseObservableFlag();

      if (this.nodes.has(name)) {
        // Update existing node with label and observable
        const node = this.nodes.get(name)!;
        node.label = labelToken.value;
        if (observable !== undefined) node.observable = observable;
      } else {
        this.nodes.set(name, {
          name,
          label: labelToken.value,
          observable,
        });
      }
    } else if (this.check('ASSIGN')) {
      // Effect definition: name := expression
      this.advance(); // consume :=
      const expr = this.parseExpression();
      if (!expr) return;

      if (this.nodes.has(name)) {
        // Update existing node with expression
        const node = this.nodes.get(name)!;
        node.expression = expr;
      } else {
        // Create new node (label = null for auto mode)
        this.nodes.set(name, {
          name,
          label: null,
          expression: expr,
        });
      }
    } else {
      this.errors.push({
        line: nameToken.line,
        message: `Expected ':' or ':=' after node name`,
        content: '',
      });
    }
  }

  private parseExpression(): Expression | null {
    return this.parseOr();
  }

  private parseOr(): Expression | null {
    let left = this.parseAnd();
    if (!left) return null;

    const operands: Expression[] = [left];
    while (this.check('OR')) {
      this.advance();
      const right = this.parseAnd();
      if (!right) return null;
      operands.push(right);
    }

    if (operands.length === 1) return left;
    return or(...operands);
  }

  private parseAnd(): Expression | null {
    let left = this.parseUnary();
    if (!left) return null;

    const operands: Expression[] = [left];
    while (this.check('AND')) {
      this.advance();
      const right = this.parseUnary();
      if (!right) return null;
      operands.push(right);
    }

    if (operands.length === 1) return left;
    return and(...operands);
  }

  private parseUnary(): Expression | null {
    if (this.check('NOT')) {
      this.advance();
      const operand = this.parseUnary();
      if (!operand) return null;
      return not(operand);
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression | null {
    if (this.check('LPAREN')) {
      this.advance();
      const expr = this.parseExpression();
      this.consume('RPAREN', 'Expected )');
      return expr;
    }

    if (this.check('IDENT')) {
      const token = this.advance();
      return ref(token.value);
    }

    this.errors.push({
      line: this.peek().line,
      message: `Expected expression, got: ${this.peek().value}`,
      content: '',
    });
    return null;
  }

  private parseConstraint(): void {
    const typeToken = this.advance();
    const type = typeToken.type as 'ONE' | 'EXCL' | 'INCL' | 'REQ' | 'MASK';

    this.consume('LPAREN', 'Expected ( after constraint type');

    if (type === 'REQ' || type === 'MASK') {
      // Directional: source/trigger -> targets
      // NOT allowed on source/trigger, prohibited on targets
      const source = this.parseConstraintMember();
      if (!source) return;

      this.consume('ARROW', 'Expected -> in REQ/MASK constraint');

      const targets: ConstraintMemberRef[] = [];
      do {
        if (type === 'MASK' && this.check('NOT')) {
          // MASK targets: NOT prohibited (M value is symmetric under negation)
          const notToken = this.peek();
          this.errors.push({
            message: `NOT is not allowed on target side of MASK constraint`,
            line: notToken.line,
            content: '',
          });
          return;
        }
        // REQ targets: NOT allowed (parsed as constraint member)
        // MASK targets: plain identifier only
        const target = type === 'REQ' ? this.parseConstraintMember() : null;
        if (type !== 'REQ') {
          const targetToken = this.consume('IDENT', 'Expected target node name');
          if (!targetToken) return;
          targets.push({ name: targetToken.value, negated: false });
        } else {
          if (!target) return;
          targets.push(target);
        }
      } while (this.match('COMMA'));

      this.consume('RPAREN', 'Expected )');

      if (type === 'REQ') {
        // Validate: source NOT and target NOT cannot coexist
        const hasTargetNot = targets.some(t => t.negated);
        if (source.negated && hasTargetNot) {
          this.errors.push({
            message: `NOT on both source and target sides of REQ is not allowed`,
            line: this.peek().line,
            content: '',
          });
          return;
        }
        this.constraints.push({ type: 'REQ', source, targets });
      } else {
        this.constraints.push({ type: 'MASK', trigger: source, targets });
      }
    } else {
      // Symmetric: member, member, ...
      const members: ConstraintMemberRef[] = [];
      do {
        const member = this.parseConstraintMember();
        if (!member) return;
        members.push(member);
      } while (this.match('COMMA'));

      this.consume('RPAREN', 'Expected )');

      this.constraints.push({ type, members } as LogicalConstraint);
    }
  }

  private parseConstraintMember(): ConstraintMemberRef | null {
    let negated = false;
    if (this.check('NOT')) {
      this.advance();
      negated = true;
    }

    const nameToken = this.consume('IDENT', 'Expected node name in constraint');
    if (!nameToken) return null;

    return { name: nameToken.value, negated };
  }

  private parseObservableFlag(): boolean | undefined {
    if (this.check('LBRACKET')) {
      this.advance(); // consume [
      if (this.check('OBSERVABLE')) {
        this.advance(); // consume observable
        this.consume('RBRACKET', 'Expected ] after observable');
        return true; // backward compat: [observable] → true
      } else if (this.check('UNOBSERVABLE')) {
        this.advance(); // consume unobservable
        this.consume('RBRACKET', 'Expected ] after unobservable');
        return false; // [unobservable] → false
      } else {
        this.errors.push({
          line: this.peek().line,
          message: `Expected 'observable' or 'unobservable' after [`,
          content: '',
        });
        // Try to recover by consuming until ]
        while (!this.check('RBRACKET') && !this.isAtEnd()) {
          this.advance();
        }
        if (this.check('RBRACKET')) this.advance();
      }
    }
    return undefined; // no flag specified → default (observable)
  }

  private parseLayout(): void {
    this.advance(); // consume @layout

    if (!this.check('LBRACE')) {
      // Single line layout: @layout nodeName: (x, y)
      this.parseSingleLayout();
      return;
    }

    this.advance(); // consume {

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      this.parseSingleLayout();
    }

    this.consume('RBRACE', 'Expected }');
  }

  private parseSingleLayout(): void {
    const nameToken = this.consume('IDENT', 'Expected node or constraint name in layout');
    if (!nameToken) return;

    this.consume('COLON', 'Expected : after name in layout');
    this.consume('LPAREN', 'Expected ( for position');

    const xToken = this.consume('NUMBER', 'Expected x coordinate');
    if (!xToken) return;

    this.consume('COMMA', 'Expected , between coordinates');

    const yToken = this.consume('NUMBER', 'Expected y coordinate');
    if (!yToken) return;

    // Optional width: (x, y, width)
    let width: number | undefined;
    if (this.check('COMMA')) {
      this.advance(); // consume ,
      const wToken = this.consume('NUMBER', 'Expected width value');
      if (wToken) {
        width = parseInt(wToken.value, 10);
      }
    }

    this.consume('RPAREN', 'Expected ) after position');

    const position = {
      x: parseInt(xToken.value, 10),
      y: parseInt(yToken.value, 10),
    };

    // Check if this is a constraint reference (c0, c1, etc.)
    const constraintMatch = nameToken.value.match(/^c(\d+)$/);
    if (constraintMatch) {
      const constraintIndex = parseInt(constraintMatch[1], 10);
      if (constraintIndex < this.constraints.length) {
        this.constraints[constraintIndex].position = position;
      } else {
        this.warnings.push(`Layout references unknown constraint: ${nameToken.value}`);
      }
    } else {
      // It's a node reference
      const node = this.nodes.get(nameToken.value);
      if (node) {
        node.position = position;
        if (width !== undefined) {
          node.width = width;
        }
      } else {
        this.warnings.push(`Layout references unknown node: ${nameToken.value}`);
      }
    }
  }

  // Helper methods
  private peek(): Token {
    return this.tokens[this.pos];
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.tokens[this.pos - 1];
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token | null {
    if (this.check(type)) return this.advance();

    this.errors.push({
      line: this.peek().line,
      message: `${message}, got: ${this.peek().value || this.peek().type}`,
      content: '',
    });
    return null;
  }
}

// =============================================================================
// Circular Reference Detection
// =============================================================================

/**
 * Collect all referenced node names from an expression
 */
function collectReferences(expr: Expression): string[] {
  switch (expr.type) {
    case 'ref':
      return [expr.name];
    case 'not':
      return collectReferences(expr.operand);
    case 'and':
    case 'or':
      return expr.operands.flatMap(collectReferences);
  }
}

/**
 * Detect circular references in the model
 * Returns the circular path if found, or null if no cycle exists
 */
function detectCircularReference(nodes: Map<string, LogicalNode>): { nodeName: string; path: string[] } | null {
  // Build adjacency list from expressions
  const graph = new Map<string, string[]>();

  for (const [name, node] of nodes) {
    if (node.expression) {
      const refs = collectReferences(node.expression);
      graph.set(name, refs);
    }
  }

  // DFS to detect cycle
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeName: string): string[] | null {
    visited.add(nodeName);
    recursionStack.add(nodeName);
    path.push(nodeName);

    const refs = graph.get(nodeName) || [];
    for (const refName of refs) {
      // Direct self-reference
      if (refName === nodeName) {
        return [nodeName, nodeName];
      }

      // Cycle through other nodes
      if (recursionStack.has(refName)) {
        // Found a cycle - extract the cycle path
        const cycleStart = path.indexOf(refName);
        return [...path.slice(cycleStart), refName];
      }

      if (!visited.has(refName) && graph.has(refName)) {
        const cyclePath = dfs(refName);
        if (cyclePath) return cyclePath;
      }
    }

    path.pop();
    recursionStack.delete(nodeName);
    return null;
  }

  // Check all nodes with expressions
  for (const [name] of graph) {
    if (!visited.has(name)) {
      const cyclePath = dfs(name);
      if (cyclePath) {
        return { nodeName: cyclePath[0], path: cyclePath };
      }
    }
  }

  return null;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse DSL string into LogicalModel
 */
export function parseLogicalDSL(input: string): ParseResult {
  const { tokens, errors: tokenErrors } = tokenize(input);

  if (tokenErrors.length > 0) {
    return {
      success: false,
      model: { nodes: new Map(), constraints: [] },
      errors: tokenErrors,
      warnings: [],
    };
  }

  const parser = new Parser(tokens);
  const result = parser.parse();

  // Check for circular references after successful parsing
  if (result.success) {
    const cycle = detectCircularReference(result.model.nodes);
    if (cycle) {
      const pathStr = cycle.path.join(' -> ');
      result.errors.push({
        line: 0,
        message: `Circular reference detected: ${pathStr}`,
        content: '',
      });
      result.success = false;
    }
  }

  return result;
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'UTF-8');
  });
}
