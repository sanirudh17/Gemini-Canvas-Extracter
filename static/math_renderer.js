/**
 * Gemini Canvas Extractor — Unified Math, LaTeX & Markdown Renderer
 * Shared single source of truth for Live Preview, Print, and PDF Export.
 *
 * Handles:
 *  - Fenced code blocks (```, ````, ~~~) and multi-backtick inline code spans
 *  - Display math: $$...$$ (including trailing \$ like $$x = \$$$ and Gemini's $$x = \$$),
 *    guarded \[...\] (never mangles escaped Markdown tags like \[MCQ\] or \[CO3\]),
 *    and standalone LaTeX environments (\begin{equation}, \begin{align}, \begin{cases}, etc.)
 *  - Inline math: $...$ (escape-aware for \$ and \\, currency-safe for "$5 and $10",
 *    supports single-line & soft-wrapped multi-line inline formulas) and \(...\)
 *  - Escaped-delimiter recovery (e.g. \$*\$ or \$\Sigma\$) and bare LaTeX math symbol rescue
 *  - Full Unicode math/Greek normalization inside & outside \text{...}
 *  - Extended KaTeX macros & safe callback-based placeholder restoration (immune to $&/$$/$'/$`)
 */
(function (root) {
  'use strict';

  const KATEX_MACROS = {
    '\\R': '\\mathbb{R}',
    '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}',
    '\\Q': '\\mathbb{Q}',
    '\\C': '\\mathbb{C}',
    '\\E': '\\mathbb{E}',
    '\\P': '\\mathbb{P}',
    '\\F': '\\mathbb{F}',
    '\\Var': '\\operatorname{Var}',
    '\\Cov': '\\operatorname{Cov}',
    '\\Corr': '\\operatorname{Corr}',
    '\\argmin': '\\operatorname*{arg\\,min}',
    '\\argmax': '\\operatorname*{arg\\,max}',
    '\\sgn': '\\operatorname{sgn}',
    '\\tr': '\\operatorname{tr}',
    '\\rank': '\\operatorname{rank}',
    '\\diag': '\\operatorname{diag}',
    '\\lcm': '\\operatorname{lcm}',
    '\\bigO': '\\mathcal{O}',
    '\\eps': '\\varepsilon',
    '\\nequiv': '\\not\\equiv',
    '\\napprox': '\\not\\approx',
    '\\nsim': '\\not\\sim',
    '\\llbracket': '[\\![',
    '\\rrbracket': ']\\!]',
    '\\qed': '\\blacksquare',
    '\\dd': '\\mathrm{d}',
    '\\abs': '\\left|#1\\right|',
    '\\norm': '\\left\\|#1\\right\\|',
    '\\ceil': '\\left\\lceil#1\\right\\rceil',
    '\\floor': '\\left\\lfloor#1\\right\\rfloor',
    '\\dv': '\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}',
    '\\pdv': '\\frac{\\partial #1}{\\partial #2}',
    '\\bm': '\\boldsymbol{#1}'
  };

  // Unicode math & Greek characters -> canonical LaTeX commands
  const UNICODE_MATH_MAP = {
    '\u2260': '\\neq',      // ≠
    '\u2264': '\\leq',      // ≤
    '\u2265': '\\geq',      // ≥
    '\u00d7': '\\times',    // ×
    '\u00f7': '\\div',      // ÷
    '\u00b1': '\\pm',       // ±
    '\u2213': '\\mp',       // ∓
    '\u221e': '\\infty',    // ∞
    '\u2208': '\\in',       // ∈
    '\u2209': '\\notin',    // ∉
    '\u220b': '\\ni',       // ∋
    '\u2282': '\\subset',   // ⊂
    '\u2286': '\\subseteq', // ⊆
    '\u2283': '\\supset',   // ⊃
    '\u2287': '\\supseteq', // ⊇
    '\u2284': '\\not\\subset',
    '\u222a': '\\cup',      // ∪
    '\u2229': '\\cap',      // ∩
    '\u2205': '\\emptyset', // ∅
    '\u2200': '\\forall',   // ∀
    '\u2203': '\\exists',   // ∃
    '\u2204': '\\nexists',  // ∄
    '\u00ac': '\\neg',      // ¬
    '\u2227': '\\land',     // ∧
    '\u2228': '\\lor',      // ∨
    '\u2295': '\\oplus',    // ⊕
    '\u2297': '\\otimes',   // ⊗
    '\u2299': '\\odot',     // ⊙
    '\u2192': '\\rightarrow',     // →
    '\u2190': '\\leftarrow',      // ←
    '\u2194': '\\leftrightarrow', // ↔
    '\u21d2': '\\Rightarrow',     // ⇒
    '\u21d0': '\\Leftarrow',      // ⇐
    '\u21d4': '\\Leftrightarrow', // ⇔
    '\u27f6': '\\longrightarrow', // ⟶
    '\u27f5': '\\longleftarrow',  // ⟵
    '\u27f9': '\\Longrightarrow', // ⟹
    '\u27fa': '\\Longleftrightarrow', // ⟺
    '\u21a6': '\\mapsto',   // ↦
    '\u2248': '\\approx',   // ≈
    '\u2261': '\\equiv',    // ≡
    '\u2262': '\\not\\equiv', // ≢
    '\u2245': '\\cong',     // ≅
    '\u223c': '\\sim',      // ∼
    '\u2243': '\\simeq',    // ≃
    '\u221d': '\\propto',   // ∝
    '\u2211': '\\sum',      // ∑
    '\u220f': '\\prod',     // ∏
    '\u222b': '\\int',      // ∫
    '\u222c': '\\iint',     // ∬
    '\u222d': '\\iiint',    // ∭
    '\u222e': '\\oint',     // ∮
    '\u221a': '\\sqrt',     // √
    '\u2202': '\\partial',  // ∂
    '\u2207': '\\nabla',    // ∇
    '\u22a2': '\\vdash',    // ⊢
    '\u22a8': '\\models',   // ⊨
    '\u22a5': '\\perp',     // ⊥
    '\u22a4': '\\top',      // ⊤
    '\u2234': '\\therefore', // ∴
    '\u2235': '\\because',  // ∵
    '\u2212': '-',          // − (minus sign)
    '\u00b7': '\\cdot',     // ·
    '\u22c5': '\\cdot',     // ⋅
    '\u2218': '\\circ',     // ∘
    '\u2217': '\\ast',      // ∗
    '\u2026': '\\dots',     // …
    '\u22ef': '\\cdots',    // ⋯
    '\u22ee': '\\vdots',    // ⋮
    '\u22f1': '\\ddots',    // ⋱
    '\u230a': '\\lfloor',   // ⌊
    '\u230b': '\\rfloor',   // ⌋
    '\u2308': '\\lceil',    // ⌈
    '\u2309': '\\rceil',    // ⌉
    '\u27e8': '\\langle',   // ⟨
    '\u27e9': '\\rangle',   // ⟩
    '\u00b0': '^{\\circ}',  // °
    '\u2032': "'",          // ′
    '\u2033': "''",         // ″
    '\u211d': '\\mathbb{R}', // ℝ
    '\u2115': '\\mathbb{N}', // ℕ
    '\u2124': '\\mathbb{Z}', // ℤ
    '\u211a': '\\mathbb{Q}', // ℚ
    '\u2102': '\\mathbb{C}', // ℂ
    // Lowercase Greek
    '\u03b1': '\\alpha', '\u03b2': '\\beta', '\u03b3': '\\gamma', '\u03b4': '\\delta',
    '\u03b5': '\\varepsilon', '\u03f5': '\\epsilon', '\u03b6': '\\zeta', '\u03b7': '\\eta',
    '\u03b8': '\\theta', '\u03d1': '\\vartheta', '\u03b9': '\\iota', '\u03ba': '\\kappa',
    '\u03bb': '\\lambda', '\u03bc': '\\mu', '\u03bd': '\\nu', '\u03be': '\\xi',
    '\u03c0': '\\pi', '\u03d6': '\\varpi', '\u03c1': '\\rho', '\u03f1': '\\varrho',
    '\u03c3': '\\sigma', '\u03c2': '\\varsigma', '\u03c4': '\\tau', '\u03c5': '\\upsilon',
    '\u03c6': '\\varphi', '\u03d5': '\\phi', '\u03c7': '\\chi', '\u03c8': '\\psi',
    '\u03c9': '\\omega',
    // Uppercase Greek
    '\u0393': '\\Gamma', '\u0394': '\\Delta', '\u0398': '\\Theta', '\u039b': '\\Lambda',
    '\u039e': '\\Xi', '\u03a0': '\\Pi', '\u03a3': '\\Sigma', '\u03a5': '\\Upsilon',
    '\u03a6': '\\Phi', '\u03a8': '\\Psi', '\u03a9': '\\Omega'
  };

  // Standalone display-level LaTeX environments that may appear outside $...$ / $$...$$
  const STANDALONE_ENVS = [
    'equation\\*', 'equation',
    'align\\*', 'align', 'aligned',
    'alignat\\*', 'alignat', 'alignedat',
    'gather\\*', 'gather', 'gathered',
    'multline\\*', 'multline',
    'eqnarray\\*', 'eqnarray',
    'flalign\\*', 'flalign',
    'split', 'cases', 'dcases', 'rcases',
    'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'matrix', 'smallmatrix',
    'array', 'CD'
  ];
  const STANDALONE_ENV_RE = new RegExp(
    '\\\\begin\\{(' + STANDALONE_ENVS.join('|') + ')\\}([\\s\\S]*?)\\\\end\\{\\1\\}',
    'g'
  );

  // Whitelist of unambiguous LaTeX math symbol commands to rescue if Gemini leaves them bare in prose
  const BARE_LATEX_SYMBOLS = [
    'neq', 'ne', 'leq', 'le', 'geq', 'ge', 'approx', 'equiv', 'cong', 'simeq', 'propto',
    'Sigma', 'sigma', 'varsigma', 'sum', 'prod', 'int', 'iint', 'iiint', 'oint',
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
    'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi',
    'rho', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Upsilon', 'Phi', 'Psi', 'Omega',
    'implies', 'impliedby', 'iff', 'Rightarrow', 'Leftarrow', 'Leftrightarrow',
    'longrightarrow', 'longleftarrow', 'longleftrightarrow', 'Longrightarrow', 'Longleftarrow', 'Longleftrightarrow',
    'rightarrow', 'leftarrow', 'leftrightarrow', 'mapsto', 'to',
    'forall', 'exists', 'nexists', 'neg', 'lnot', 'land', 'lor', 'oplus', 'otimes', 'odot',
    'in', 'notin', 'ni', 'subset', 'subseteq', 'supset', 'supseteq', 'cup', 'cap', 'setminus',
    'emptyset', 'varnothing', 'infty', 'partial', 'nabla',
    'times', 'div', 'cdot', 'cdots', 'ldots', 'vdots', 'ddots', 'pm', 'mp', 'ast', 'star', 'circ', 'bullet',
    'vdash', 'models', 'perp', 'top', 'bot', 'therefore', 'because', 'angle', 'triangle',
    'lfloor', 'rfloor', 'lceil', 'rceil', 'langle', 'rangle', 'mid', 'nmid', 'parallel',
    'aleph', 'hbar', 'ell', 'wp', 'Re', 'Im', 'nabla'
  ];
  const BARE_LATEX_RE = new RegExp(
    '(?<![a-zA-Z0-9_:\\\\])\\\\(' + BARE_LATEX_SYMBOLS.join('|') + ')(?![a-zA-Z])',
    'g'
  );

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isEscaped(str, pos) {
    let bs = 0;
    for (let k = pos - 1; k >= 0 && str[k] === '\\'; k--) bs++;
    return (bs % 2) === 1;
  }

  /**
   * Sanitizes text inside \text{...}, \textbf{...}, \textit{...}, \textrm{...}, \mbox{...}
   * with full brace-nesting support:
   *  - escapes bare &, %, #, $
   *  - wraps Unicode math operators (like ≠, ≤, ≥, ∈, ∉, ∑, →) in inline $...$ so KaTeX text-mode doesn't error
   */
  function sanitizeTextCommands(expr) {
    const cmdRe = /\\(text|textbf|textit|textrm|textsf|texttt|mbox|hbox)\{/g;
    let out = '';
    let last = 0;
    let match;

    while ((match = cmdRe.exec(expr)) !== null) {
      out += expr.slice(last, match.index);
      const cmdPrefix = match[0]; // e.g. "\text{"
      const start = match.index + cmdPrefix.length;
      let depth = 1;
      let i = start;
      while (i < expr.length && depth > 0) {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          i += 2;
          continue;
        }
        if (expr[i] === '{') depth++;
        else if (expr[i] === '}') depth--;
        if (depth > 0) i++;
      }

      if (depth === 0) {
        const inner = expr.slice(start, i);
        let sanitized = '';
        let inInnerMath = false;
        for (let k = 0; k < inner.length; k++) {
          const ch = inner[k];
          if (ch === '\\' && k + 1 < inner.length) {
            sanitized += ch + inner[k + 1];
            k++;
            continue;
          }
          if (ch === '$') {
            // Check if there is a matching unescaped $ ahead (embedded math in \text{...})
            let hasPair = false;
            if (!inInnerMath) {
              for (let m = k + 1; m < inner.length; m++) {
                if (inner[m] === '\\') { m++; continue; }
                if (inner[m] === '$') { hasPair = true; break; }
              }
            }
            if (inInnerMath || hasPair) {
              inInnerMath = !inInnerMath;
              sanitized += '$';
            } else {
              sanitized += '\\$';
            }
            continue;
          }
          if (!inInnerMath) {
            if (ch === '&') { sanitized += '\\&'; continue; }
            if (ch === '%') { sanitized += '\\%'; continue; }
            if (ch === '#') { sanitized += '\\#'; continue; }
            if (UNICODE_MATH_MAP[ch]) {
              sanitized += '$' + UNICODE_MATH_MAP[ch] + '$';
              continue;
            }
          }
          sanitized += ch;
        }
        out += cmdPrefix + sanitized + '}';
        last = i + 1;
        cmdRe.lastIndex = last;
      } else {
        out += cmdPrefix;
        last = start;
      }
    }
    out += expr.slice(last);
    return out;
  }

  /**
   * Normalizes Unicode math/Greek characters outside \text{...} commands into canonical LaTeX.
   */
  function normalizeUnicodeInMath(expr) {
    let out = '';
    let i = 0;
    const textCmdRe = /^\\(?:text|textbf|textit|textrm|textsf|texttt|mbox|hbox)\{/;

    while (i < expr.length) {
      if (expr[i] === '\\') {
        const sub = expr.slice(i);
        const tm = sub.match(textCmdRe);
        if (tm) {
          // Copy the entire \text{...} untouched (already handled by sanitizeTextCommands)
          let depth = 1;
          let j = i + tm[0].length;
          while (j < expr.length && depth > 0) {
            if (expr[j] === '\\' && j + 1 < expr.length) { j += 2; continue; }
            if (expr[j] === '{') depth++;
            else if (expr[j] === '}') depth--;
            j++;
          }
          out += expr.slice(i, j);
          i = j;
          continue;
        }
        if (i + 1 < expr.length) {
          out += expr[i] + expr[i + 1];
          i += 2;
          continue;
        }
      }

      const ch = expr[i];
      if (UNICODE_MATH_MAP[ch]) {
        const rep = UNICODE_MATH_MAP[ch];
        // Add space after command if next char is ASCII letter so \neqx doesn't break
        const next = expr[i + 1];
        const needsSpace = rep.startsWith('\\') && /[a-zA-Z]$/.test(rep) && next && /[a-zA-Z]/.test(next);
        out += rep + (needsSpace ? ' ' : '');
      } else {
        out += ch;
      }
      i++;
    }
    return out;
  }

  /**
   * Normalizes LaTeX environments & syntax quirks so KaTeX renders cleanly in both inline & display mode.
   */
  function cleanMath(math, displayMode) {
    let m = (math || '').trim();
    if (!m) return '';

    // If a trailing lone backslash came from a truncated \$$ delimiter, restore \$
    if (m.endsWith('\\') && !isEscaped(m, m.length - 1)) {
      m = m + '$';
    }

    // Normalize non-KaTeX or display-only environments safely
    m = m.replace(/\\begin\{eqnarray\*?\}/g, '\\begin{aligned}')
         .replace(/\\end\{eqnarray\*?\}/g, '\\end{aligned}')
         .replace(/\\begin\{flalign\*?\}/g, '\\begin{aligned}')
         .replace(/\\end\{flalign\*?\}/g, '\\end{aligned}')
         .replace(/\\begin\{multline\*?\}/g, '\\begin{gathered}')
         .replace(/\\end\{multline\*?\}/g, '\\end{gathered}')
         .replace(/\\begin\{split\}/g, '\\begin{aligned}')
         .replace(/\\end\{split\}/g, '\\end{aligned}')
         .replace(/\\begin\{align\*?\}/g, '\\begin{aligned}')
         .replace(/\\end\{align\*?\}/g, '\\end{aligned}')
         .replace(/\\begin\{gather\*?\}/g, '\\begin{gathered}')
         .replace(/\\end\{gather\*?\}/g, '\\end{gathered}');

    if (!displayMode) {
      // {equation} / {equation*} only work in display mode in KaTeX; unwrap if used inline
      m = m.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, '$1');
    }

    // Normalize \not= -> \neq and \not\in -> \notin for cleaner rendering
    m = m.replace(/\\not\s*=/g, '\\neq')
         .replace(/\\not\s*\\in(?![a-zA-Z])/g, '\\notin');

    // Sanitize \text{...} and Unicode math symbols
    m = sanitizeTextCommands(m);
    m = normalizeUnicodeInMath(m);

    return m;
  }

  function renderKatexSafe(rawMath, displayMode) {
    const cleaned = cleanMath(rawMath, displayMode);
    if (!cleaned) return '';
    try {
      const rendered = root.katex.renderToString(cleaned, {
        displayMode: displayMode,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: Object.assign({}, KATEX_MACROS)
      });
      return displayMode
        ? '<div class="katex-display-wrapper">' + rendered + '</div>'
        : rendered;
    } catch (e) {
      return displayMode
        ? '<div class="katex-display-wrapper katex-error">' + escapeHtml(rawMath) + '</div>'
        : '<span class="katex-error">' + escapeHtml(rawMath) + '</span>';
    }
  }

  /**
   * Determines whether \[ ... \] is genuine LaTeX display math vs Gemini's escaped Markdown
   * brackets like \[MCQ\], \[CO3\], \[CONFIRMED 11M\], \[ S \].
   */
  function isBracketDisplayMath(text, openPos, closePos, inner) {
    const trimmed = inner.trim();
    if (!trimmed) return false;

    // Contains an explicit LaTeX command (e.g. \frac, \sum, \neq, \Sigma, \text, \begin, ...)
    if (/\\[a-zA-Z]+/.test(trimmed)) return true;

    // Check if block-level (only spaces/tabs before \[ on its line and after \] on its line)
    const lineStart = text.lastIndexOf('\n', openPos - 1) + 1;
    const beforeOnLine = text.slice(lineStart, openPos);
    const lineEndIdx = text.indexOf('\n', closePos + 2);
    const afterOnLine = text.slice(closePos + 2, lineEndIdx === -1 ? text.length : lineEndIdx);
    const isBlock = /^[ \t>*-]*$/.test(beforeOnLine) && /^[ \t]*$/.test(afterOnLine);

    if (isBlock) {
      // Block-level \[ ... \] with math operators or multi-line math
      if (/[=<>^_{}+*/]/.test(trimmed) || trimmed.includes('\n')) return true;
    }
    return false;
  }

  /**
   * Heuristic to avoid false-positive inline math on currency like "$5 and $10" or "$1,200 to $3,400"
   * while ALWAYS accepting real math like "$5$", "$\$$", "$*\$$", "$a \neq b$", "$\Sigma$".
   */
  function looksLikeCurrencyPair(text, openPos, closePos, inner) {
    if (!inner || !inner.trim()) return true;
    // If inner contains any LaTeX command or math syntax, it is definitely math
    if (/[\\^_{}=<>|]/.test(inner)) return false;
    // Check for "$5 ... $10" pattern: starts with digit, ends with space/word, followed immediately by digit
    const charAfterClose = text[closePos + 1] || '';
    if (/^\d/.test(inner) && /\d/.test(charAfterClose) && /\s/.test(inner)) {
      return true;
    }
    // Check for "$100 and $200" where inner has multiple English words with no operators
    if (/^\d[\d,.]*\s+[a-zA-Z]/.test(inner) && !/[+\-*/()]/.test(inner)) {
      return true;
    }
    return false;
  }

  /**
   * Protects fenced code blocks (```, ````, ~~~) and inline code spans (`...`, ``...``).
   */
  function protectCode(input) {
    const codeBlocks = [];
    const inlineCodes = [];

    // 1. Line-by-line fenced code block scanner (handles 3+ backticks or tildes accurately)
    const lines = input.split('\n');
    const outLines = [];
    let i = 0;
    while (i < lines.length) {
      const m = lines[i].match(/^([ \t]{0,3})(`{3,}|~{3,})/);
      if (m) {
        const fenceChar = m[2][0];
        const fenceLen = m[2].length;
        const blockLines = [lines[i]];
        i++;
        const closeRe = new RegExp('^[ \\t]{0,3}' + fenceChar + '{' + fenceLen + ',}[ \\t]*$');
        while (i < lines.length) {
          blockLines.push(lines[i]);
          if (closeRe.test(lines[i])) {
            i++;
            break;
          }
          i++;
        }
        const id = '%%CODE_BLOCK_' + codeBlocks.length + '%%';
        codeBlocks.push({ id, code: blockLines.join('\n') });
        outLines.push(id);
      } else {
        outLines.push(lines[i]);
        i++;
      }
    }

    let text = outLines.join('\n');

    // 2. Inline code spans (supports ``code with ` inside`` as well as `code`)
    text = text.replace(/(`+)([^\n]*?)\1/g, (match) => {
      const id = '%%INLINE_CODE_' + inlineCodes.length + '%%';
      inlineCodes.push({ id, code: match });
      return id;
    });

    return { text, codeBlocks, inlineCodes };
  }

  /**
   * Character-by-character math delimiter scanner.
   * Properly handles nested escapes (\$ vs \\), trailing \$$$, Gemini's truncated \$$,
   * \[...\], \(...\), standalone \begin{...}...\end{...}, and $...$.
   */
  function extractMath(input) {
    const mathBlocks = [];
    const pushMath = (raw, displayMode) => {
      const id = (displayMode ? '%%KATEX_BLOCK_' : '%%KATEX_INLINE_') + mathBlocks.length + '%%';
      mathBlocks.push({ id, html: renderKatexSafe(raw, displayMode) });
      return id;
    };

    // Pass A: Character-level scan for $$, \[...\], \(...\), and $...$
    let out = '';
    const n = input.length;
    let i = 0;

    while (i < n) {
      // 1. Display math: $$ ... $$
      if (input[i] === '$' && input[i + 1] === '$' && !isEscaped(input, i)) {
        let j = i + 2;
        let closed = false;
        let mathBody = '';
        let nextIdx = i + 2;

        while (j < n) {
          if (input[j] === '\\') {
            // Case 1a: \$$$ -> literal \$ at end of display math, followed by closing $$
            if (input[j + 1] === '$' && input[j + 2] === '$' && input[j + 3] === '$') {
              mathBody = input.slice(i + 2, j + 2);
              nextIdx = j + 4;
              closed = true;
              break;
            }
            // Case 1b: Gemini truncated \$$ (only two $ at end of line/block, no later $$ before blank line)
            if (input[j + 1] === '$' && input[j + 2] === '$' && input[j + 3] !== '$') {
              const after = input[j + 3];
              const atBoundary = (j + 3 >= n) || /[\s.,;:!?)}\]|]/.test(after);
              if (atBoundary) {
                // Check if there's an unescaped $$ later on the same line or before blank line
                const restEnd = input.indexOf('\n\n', j + 3);
                const sliceEnd = restEnd === -1 ? Math.min(n, j + 300) : restEnd;
                const ahead = input.slice(j + 3, sliceEnd);
                if (!/(?<!\\)\$\$/.test(ahead)) {
                  mathBody = input.slice(i + 2, j + 2);
                  nextIdx = j + 3;
                  closed = true;
                  break;
                }
              }
            }
            j += 2;
            continue;
          }
          if (input[j] === '$' && input[j + 1] === '$') {
            mathBody = input.slice(i + 2, j);
            nextIdx = j + 2;
            closed = true;
            break;
          }
          j++;
        }

        if (closed && mathBody.trim()) {
          out += pushMath(mathBody, true);
          i = nextIdx;
          continue;
        }
        // Unclosed $$: emit literally and move past
        out += '$$';
        i += 2;
        continue;
      }

      // 2. Display math: \[ ... \] (guarded against Markdown bracket escapes like \[MCQ\])
      if (input[i] === '\\' && input[i + 1] === '[' && !isEscaped(input, i)) {
        let j = i + 2;
        let closePos = -1;
        while (j < n) {
          if (input[j] === '\n' && input[j + 1] === '\n') break;
          if (input[j] === '\\' && input[j + 1] === ']' && !isEscaped(input, j)) {
            closePos = j;
            break;
          }
          j++;
        }
        if (closePos !== -1) {
          const inner = input.slice(i + 2, closePos);
          if (isBracketDisplayMath(input, i, closePos, inner)) {
            out += pushMath(inner, true);
            i = closePos + 2;
            continue;
          }
        }
      }

      // 3. Inline math: \( ... \)
      if (input[i] === '\\' && input[i + 1] === '(' && !isEscaped(input, i)) {
        let j = i + 2;
        let closePos = -1;
        while (j < n) {
          if (input[j] === '\n' && input[j + 1] === '\n') break;
          if (input[j] === '\\' && input[j + 1] === ')' && !isEscaped(input, j)) {
            closePos = j;
            break;
          }
          j++;
        }
        if (closePos !== -1) {
          const inner = input.slice(i + 2, closePos);
          if (inner.trim()) {
            out += pushMath(inner, false);
            i = closePos + 2;
            continue;
          }
        }
      }

      // 4. Inline math: $ ... $
      if (input[i] === '$' && input[i + 1] !== '$' && !isEscaped(input, i)) {
        let j = i + 1;
        let closePos = -1;
        let newlineCount = 0;

        while (j < n) {
          const ch = input[j];
          if (ch === '\\') {
            // Skip escaped character (\$ stays inside math, \\ skips both so \\$ closes!)
            j += 2;
            continue;
          }
          if (ch === '\n') {
            // Never cross blank lines or markdown block boundaries (headings, lists, tables, code placeholders)
            newlineCount++;
            if (newlineCount > 2 || input[j + 1] === '\n') break;
            const nextLinePeek = input.slice(j + 1, j + 16);
            if (/^\s*(?:[#>*|+-]\s|\d+\.\s|%%CODE_BLOCK_)/.test(nextLinePeek)) break;
            j++;
            continue;
          }
          if (ch === '$') {
            // Don't close on $$ inside an unclosed single $
            if (input[j + 1] === '$') break;
            closePos = j;
            break;
          }
          j++;
        }

        if (closePos !== -1) {
          const inner = input.slice(i + 1, closePos);
          if (!looksLikeCurrencyPair(input, i, closePos, inner)) {
            out += pushMath(inner, false);
            i = closePos + 1;
            continue;
          }
        }
      }

      out += input[i];
      i++;
    }

    // Pass B: Standalone LaTeX display environments outside $...$ / $$...$$
    out = out.replace(STANDALONE_ENV_RE, (match) => {
      return '\n\n' + pushMath(match, true) + '\n\n';
    });

    // Pass C: Recover Gemini double-escaped inline math like \$*\$ or \$\Sigma\$
    out = out.replace(/(?<!\\)\\\$(\*|\+|\\neq|\\ne|\\Sigma|\\sigma|\\sum|\\notin|\\emptyset|\\infty|\\implies|\\iff)\\\$/g, (match, inner) => {
      return pushMath(inner, false);
    });

    // Pass D: Rescue bare LaTeX math symbol commands left outside $...$ in prose (e.g. \neq, \Sigma, \sigma)
    out = out.replace(BARE_LATEX_RE, (match) => {
      return pushMath(match, false);
    });

    return { text: out, mathBlocks };
  }

  function renderMarkdown(markdownText) {
    if (!markdownText) return '';

    const { text: codeProtected, codeBlocks, inlineCodes } = protectCode(markdownText);
    const { text: mathProtected, mathBlocks } = extractMath(codeProtected);

    // Restore code blocks BEFORE marked.parse using callback replacers (immune to $&/$$/$'/$`)
    let text = mathProtected;
    codeBlocks.forEach(({ id, code }) => {
      text = text.replaceAll(id, () => code);
    });
    inlineCodes.forEach(({ id, code }) => {
      text = text.replaceAll(id, () => code);
    });

    root.marked.setOptions({ gfm: true, breaks: true });
    let html = root.marked.parse(text);

    // Restore KaTeX HTML using callback replacers (immune to $&/$$/$'/$`)
    mathBlocks.forEach(({ id, html: mathHtml }) => {
      html = html.replaceAll(id, () => mathHtml);
    });

    return html;
  }

  root.GeminiMathRenderer = {
    renderMarkdown: renderMarkdown,
    cleanMath: cleanMath,
    extractMath: extractMath,
    protectCode: protectCode,
    KATEX_MACROS: KATEX_MACROS
  };
})(typeof window !== 'undefined' ? window : globalThis);
