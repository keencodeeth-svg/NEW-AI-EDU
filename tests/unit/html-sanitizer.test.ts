import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeHtml, sanitizeCodeHtml, sanitizeHtmlFragment, sanitizeMathHtml } from "../../lib/html-sanitizer";

test("sanitizeHtmlFragment removes scripts, inline handlers, and javascript urls", () => {
  const sanitized = sanitizeHtmlFragment(
    [
      '<div onclick="alert(1)">',
      '<script>alert(1)</script>',
      '<a href="javascript&#x3A;alert(1)" target="_blank">unsafe</a>',
      '<span style="color: #2563eb; background-image: url(javascript:alert(1));">safe</span>',
      "</div>",
    ].join(""),
  );

  assert.equal(
    sanitized,
    '<div><a target="_blank" rel="noopener noreferrer">unsafe</a><span style="color: #2563eb">safe</span></div>',
  );
});

test("sanitizeMathHtml preserves safe KaTeX and MathML markup", () => {
  const input = [
    '<span class="katex">',
    '<span class="katex-mathml">',
    '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow></math>',
    "</span>",
    '<span class="katex-html" aria-hidden="true"><span class="base">x = 1</span></span>',
    "</span>",
  ].join("");

  assert.equal(sanitizeMathHtml(input), input);
});

test("sanitizeCodeHtml preserves safe highlighting styles but drops blocked tags", () => {
  const sanitized = sanitizeCodeHtml(
    '<pre class="shiki" style="background-color:#fff"><code><span style="color:#0f172a">const a = 1;</span><img src="https://bad.example/x.png" /></code></pre>',
  );

  assert.equal(
    sanitized,
    '<pre class="shiki" style="background-color: #fff"><code><span style="color: #0f172a">const a = 1;</span></code></pre>',
  );
});

test("escapeHtml encodes raw rich text before table rendering", () => {
  assert.equal(escapeHtml('<b>"quoted"</b> & more'), "&lt;b&gt;&quot;quoted&quot;&lt;/b&gt; &amp; more");
});
