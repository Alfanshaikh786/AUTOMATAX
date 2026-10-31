from typing import List, Tuple, Set, Optional
from app.models.regular_expression import RegexNode, RegexParseResult
from app.core.exceptions import RegexParseError

class RegexParser:
    """
    Formal recursive-descent parser for regular expressions.
    Grammar:
      E -> T ('|' T)*
      T -> F* (concatenation)
      F -> B ('*' | '+' | '?')*
      B -> SYMBOL | EPSILON | EMPTY | '(' E ')'
    """
    def __init__(self, pattern: str):
        self.raw_pattern = pattern
        self.tokens: List[Tuple[str, str]] = [] # [(type, val)]
        self.pos = 0
        self.alphabet: Set[str] = set()

    def tokenize(self):
        i = 0
        p = self.raw_pattern.strip()
        while i < len(p):
            c = p[i]
            if c.isspace():
                i += 1
                continue
            if c in ('|', '+', '*', '?', '(', ')'):
                if c == '+' and i > 0 and p[i-1] not in ('|', '(', '+', '*', '?'):
                    # Check if '+' is used as union (a + b) or one-or-more (a+)
                    # In formal automata theory, 'a + b' is common notation for union!
                    # If followed by another valid expression token, let's treat '+' as union if preceded by operand and followed by operand,
                    # but standard regex uses '|' for union and '+' for repetition. Let's support '|' as union and '+' as repetition, OR '+' as union when separated by spaces.
                    # Standard CS textbook notation: '|' is union, '*' is star.
                    self.tokens.append(('PLUS', c))
                elif c == '|':
                    self.tokens.append(('UNION', c))
                elif c == '*':
                    self.tokens.append(('STAR', c))
                elif c == '?':
                    self.tokens.append(('OPTION', c))
                elif c == '(':
                    self.tokens.append(('LPAREN', c))
                elif c == ')':
                    self.tokens.append(('RPAREN', c))
                elif c == '+':
                    self.tokens.append(('PLUS', c))
                i += 1
            elif c in ('ε', 'λ'):
                self.tokens.append(('EPSILON', 'ε'))
                i += 1
            elif c == '∅':
                self.tokens.append(('EMPTY', '∅'))
                i += 1
            elif c == '\\':
                if i + 1 < len(p):
                    esc = p[i+1]
                    if esc in ('e', 'eps', 'epsilon'):
                        self.tokens.append(('EPSILON', 'ε'))
                    elif esc in ('0', 'empty', 'null'):
                        self.tokens.append(('EMPTY', '∅'))
                    else:
                        self.tokens.append(('SYMBOL', esc))
                        self.alphabet.add(esc)
                    i += 2
                else:
                    raise RegexParseError("Dangling escape character '\\' at end of regex.")
            else:
                # Ordinary symbol
                self.tokens.append(('SYMBOL', c))
                self.alphabet.add(c)
                i += 1

    def peek(self) -> Optional[Tuple[str, str]]:
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def match(self, expected_type: str) -> Optional[Tuple[str, str]]:
        tok = self.peek()
        if tok and tok[0] == expected_type:
            self.pos += 1
            return tok
        return None

    def parse(self) -> RegexParseResult:
        try:
            self.tokenize()
            if not self.tokens:
                # Empty pattern represents epsilon
                ast = RegexNode(type='EPSILON', value='ε', nullable=True)
                return RegexParseResult(pattern=self.raw_pattern, is_valid=True, ast=ast, alphabet=[])

            ast = self.parse_union()
            if self.pos < len(self.tokens):
                remaining = self.tokens[self.pos:]
                raise RegexParseError(f"Unexpected token '{remaining[0][1]}' at position {self.pos}.")

            return RegexParseResult(
                pattern=self.raw_pattern,
                is_valid=True,
                ast=ast,
                alphabet=sorted(list(self.alphabet))
            )
        except Exception as e:
            return RegexParseResult(
                pattern=self.raw_pattern,
                is_valid=False,
                ast=None,
                error_message=str(e),
                alphabet=[]
            )

    def parse_union(self) -> RegexNode:
        node = self.parse_concat()
        while self.match('UNION'):
            right = self.parse_concat()
            node = RegexNode(type='UNION', left=node, right=right)
        return node

    def parse_concat(self) -> RegexNode:
        factors: List[RegexNode] = []
        while True:
            tok = self.peek()
            if not tok or tok[0] in ('UNION', 'RPAREN'):
                break
            factors.append(self.parse_factor())

        if not factors:
            # Epsilon transition
            return RegexNode(type='EPSILON', value='ε', nullable=True)
        if len(factors) == 1:
            return factors[0]

        # Left-associative concatenation
        res = factors[0]
        for f in factors[1:]:
            res = RegexNode(type='CONCAT', left=res, right=f)
        return res

    def parse_factor(self) -> RegexNode:
        node = self.parse_base()
        while True:
            if self.match('STAR'):
                node = RegexNode(type='STAR', left=node)
            elif self.match('PLUS'):
                node = RegexNode(type='PLUS', left=node)
            elif self.match('OPTION'):
                node = RegexNode(type='OPTION', left=node)
            else:
                break
        return node

    def parse_base(self) -> RegexNode:
        tok = self.peek()
        if not tok:
            raise RegexParseError("Unexpected end of regular expression.")

        if tok[0] == 'LPAREN':
            self.match('LPAREN')
            inner = self.parse_union()
            if not self.match('RPAREN'):
                raise RegexParseError("Mismatched opening parenthesis '('; missing matching ')'.")
            return inner
        elif tok[0] == 'SYMBOL':
            self.match('SYMBOL')
            return RegexNode(type='SYMBOL', value=tok[1])
        elif tok[0] == 'EPSILON':
            self.match('EPSILON')
            return RegexNode(type='EPSILON', value='ε')
        elif tok[0] == 'EMPTY':
            self.match('EMPTY')
            return RegexNode(type='EMPTY', value='∅')
        else:
            raise RegexParseError(f"Unexpected token '{tok[1]}'. Expected symbol, epsilon, or '('")
