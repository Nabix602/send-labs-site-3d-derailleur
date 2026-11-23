/* Générateur de QR code (mode octets, correction d'erreur M, versions 1 à 10) — sans dépendance.
   Usage : SLqr.svg("https://…", { size: 240 }) renvoie une chaîne SVG. */
(function () {
  // [mots de code au total, mots de correction par bloc, [ [nb blocs, mots de données par bloc], … ]]
  var VERS = [
    null,
    [26, 10, [[1, 16]]], [44, 16, [[1, 28]]], [70, 26, [[1, 44]]], [100, 18, [[2, 32]]], [134, 24, [[2, 43]]],
    [172, 16, [[4, 27]]], [196, 18, [[4, 31]]], [242, 22, [[2, 38], [2, 39]]], [292, 22, [[3, 36], [2, 37]]],
    [346, 26, [[4, 43], [1, 44]]]
  ];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function genPoly(n) {
    var p = [1];
    for (var i = 0; i < n; i++) {
      var q = new Array(p.length + 1).fill(0);
      for (var j = 0; j < p.length; j++) { q[j] ^= p[j]; q[j + 1] ^= gmul(p[j], EXP[i]); }
      p = q;
    }
    return p;
  }
  function rsRemainder(data, n) {
    var gp = genPoly(n), res = new Array(n).fill(0);
    for (var i = 0; i < data.length; i++) {
      var f = data[i] ^ res[0];
      res.shift(); res.push(0);
      for (var j = 0; j < n; j++) res[j] ^= gmul(gp[j + 1], f);
    }
    return res;
  }

  function utf8(s) {
    var out = [];
    var enc = unescape(encodeURIComponent(s));
    for (var i = 0; i < enc.length; i++) out.push(enc.charCodeAt(i));
    return out;
  }

  function buildCodewords(bytes, ver) {
    var v = VERS[ver], blocks = v[2], dataTotal = 0, k;
    for (k = 0; k < blocks.length; k++) dataTotal += blocks[k][0] * blocks[k][1];
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, 8);
    for (k = 0; k < bytes.length; k++) put(bytes[k], 8);
    var cap = dataTotal * 8;
    put(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    var pad = [0xec, 0x11], pi = 0;
    while (bits.length < cap) { put(pad[pi++ % 2], 8); }
    var data = [];
    for (k = 0; k < bits.length; k += 8) {
      var b = 0; for (var t = 0; t < 8; t++) b = (b << 1) | bits[k + t];
      data.push(b);
    }
    var dBlocks = [], eBlocks = [], pos = 0;
    for (k = 0; k < blocks.length; k++) {
      for (var c = 0; c < blocks[k][0]; c++) {
        var d = data.slice(pos, pos + blocks[k][1]); pos += blocks[k][1];
        dBlocks.push(d); eBlocks.push(rsRemainder(d, v[1]));
      }
    }
    var out = [], maxD = 0, i;
    for (i = 0; i < dBlocks.length; i++) if (dBlocks[i].length > maxD) maxD = dBlocks[i].length;
    for (i = 0; i < maxD; i++) for (var j = 0; j < dBlocks.length; j++) if (i < dBlocks[j].length) out.push(dBlocks[j][i]);
    for (i = 0; i < v[1]; i++) for (var m = 0; m < eBlocks.length; m++) out.push(eBlocks[m][i]);
    return out;
  }

  function bch(val, poly, bitsLen) {
    var d = val << bitsLen;
    var top = 0; for (var t = poly; t > 0; t >>= 1) top++;
    for (var i = 31; i >= top - 1; i--) if ((d >>> i) & 1) d ^= poly << (i - (top - 1));
    return d;
  }

  function maskFn(m, r, c) {
    switch (m) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function makeMatrix(codewords, ver, mask) {
    var n = ver * 4 + 17, M = [], F = [], r, c;
    for (r = 0; r < n; r++) { M.push(new Array(n).fill(false)); F.push(new Array(n).fill(false)); }
    function set(r0, c0, dark) { M[r0][c0] = dark; F[r0][c0] = true; }
    function finder(r0, c0) {
      for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
        var rr = r0 + dr, cc = c0 + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        var dark = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) || (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) ||
          (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
        set(rr, cc, dark);
      }
    }
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (var i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var al = ALIGN[ver];
    for (var a = 0; a < al.length; a++) for (var b = 0; b < al.length; b++) {
      var ar = al[a], ac = al[b];
      if (F[ar][ac]) continue;
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++)
        set(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
    set(n - 8, 8, true); // module sombre fixe
    // zones réservées aux informations de format et de version
    for (i = 0; i < 9; i++) { if (!F[8][i]) F[8][i] = true; if (!F[i][8]) F[i][8] = true; }
    for (i = 0; i < 8; i++) { F[8][n - 1 - i] = true; F[n - 1 - i][8] = true; }
    F[n - 8][8] = true;
    if (ver >= 7) for (i = 0; i < 6; i++) for (var j = 0; j < 3; j++) { F[i][n - 11 + j] = true; F[n - 11 + j][i] = true; }

    // placement des données en zigzag
    var bitsArr = [];
    for (i = 0; i < codewords.length; i++) for (var t = 7; t >= 0; t--) bitsArr.push((codewords[i] >>> t) & 1);
    var idx = 0, up = true;
    for (c = n - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (var k = 0; k < n; k++) {
        r = up ? n - 1 - k : k;
        for (var w = 0; w < 2; w++) {
          var cc2 = c - w;
          if (F[r][cc2]) continue;
          var bit = idx < bitsArr.length ? bitsArr[idx] === 1 : false; idx++;
          M[r][cc2] = bit !== maskFn(mask, r, cc2);
        }
      }
      up = !up;
    }
    // informations de format (niveau M = 00)
    var fmt = ((0 << 3) | mask);
    var fbits = ((fmt << 10) | bch(fmt, 0x537, 10)) ^ 0x5412;
    function fb(i2) { return ((fbits >>> i2) & 1) === 1; }
    for (i = 0; i <= 5; i++) M[i][8] = fb(i);
    M[7][8] = fb(6); M[8][8] = fb(7); M[8][7] = fb(8);
    for (i = 9; i < 15; i++) M[8][14 - i] = fb(i);
    for (i = 0; i < 8; i++) M[8][n - 1 - i] = fb(i);
    for (i = 8; i < 15; i++) M[n - 15 + i][8] = fb(i);
    M[n - 8][8] = true;
    if (ver >= 7) {
      var vbits = (ver << 12) | bch(ver, 0x1f25, 12);
      for (i = 0; i < 18; i++) {
        var bv = ((vbits >>> i) & 1) === 1, rr2 = Math.floor(i / 3), cc3 = (i % 3) + n - 11;
        M[rr2][cc3] = bv; M[cc3][rr2] = bv;
      }
    }
    return M;
  }

  function penalty(M) {
    var n = M.length, score = 0, r, c, run, i;
    for (var pass = 0; pass < 2; pass++) {
      for (r = 0; r < n; r++) {
        run = 1;
        for (c = 1; c < n; c++) {
          var cur = pass ? M[c][r] : M[r][c], prev = pass ? M[c - 1][r] : M[r][c - 1];
          if (cur === prev) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1;
        }
      }
    }
    for (r = 0; r < n - 1; r++) for (c = 0; c < n - 1; c++) {
      var v = M[r][c];
      if (v === M[r][c + 1] && v === M[r + 1][c] && v === M[r + 1][c + 1]) score += 3;
    }
    var pat1 = [true, false, true, true, true, false, true, false, false, false, false];
    var pat2 = pat1.slice().reverse();
    function match(get, p) { for (var q = 0; q < 11; q++) if (get(q) !== p[q]) return false; return true; }
    for (r = 0; r < n; r++) for (c = 0; c <= n - 11; c++) {
      if (match(function (q) { return M[r][c + q]; }, pat1) || match(function (q) { return M[r][c + q]; }, pat2)) score += 40;
      if (match(function (q) { return M[c + q][r]; }, pat1) || match(function (q) { return M[c + q][r]; }, pat2)) score += 40;
    }
    var dark = 0;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (M[r][c]) dark++;
    score += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return score;
  }

  function encode(text) {
    var bytes = utf8(String(text));
    var ver = 0, i;
    for (i = 1; i <= 10; i++) {
      var dt = 0; for (var k = 0; k < VERS[i][2].length; k++) dt += VERS[i][2][k][0] * VERS[i][2][k][1];
      if (bytes.length <= dt - 2) { ver = i; break; }
    }
    if (!ver) throw new Error("Texte trop long pour le QR code");
    var cw = buildCodewords(bytes, ver), best = null, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      var M = makeMatrix(cw, ver, m), s = penalty(M);
      if (s < bestScore) { bestScore = s; best = M; }
    }
    return best;
  }

  function svg(text, opts) {
    opts = opts || {};
    var M = encode(text), n = M.length, quiet = 4, size = opts.size || 240;
    var d = "";
    for (var r = 0; r < n; r++) {
      var c = 0;
      while (c < n) {
        if (M[r][c]) {
          var s = c; while (c < n && M[r][c]) c++;
          d += "M" + (s + quiet) + " " + (r + quiet) + "h" + (c - s) + "v1h-" + (c - s) + "z";
        } else c++;
      }
    }
    var t = n + quiet * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + " " + t + '" width="' + size + '" height="' + size +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' +
      d + '" fill="' + (opts.color || "#000") + '"/></svg>';
  }

  window.SLqr = { svg: svg, encode: encode };
})();
